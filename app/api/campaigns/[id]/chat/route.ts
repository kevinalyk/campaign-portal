import { type NextRequest, NextResponse } from "next/server"
import clientPromise from "@/lib/mongodb"
import AIService from "@/services/AIService"
import { CampaignService } from "@/services/campaignService"
import { ActivityLogService } from "@/services/activityLogService"
import { ActivityAction, EntityType } from "@/models/ActivityLog"
import { ObjectId } from "mongodb"

// In-memory rate limiting for chat
// Store rate limit records with campaign ID and session ID as the key
const chatRateLimits = new Map<string, { count: number; timestamp: number }>()

// Clean up old rate limit records every 10 minutes
setInterval(
  () => {
    const now = Date.now()
    const windowMs = 5 * 60 * 1000 // 5 minute window

    for (const [key, record] of chatRateLimits.entries()) {
      if (now - record.timestamp > windowMs) {
        chatRateLimits.delete(key)
      }
    }
  },
  10 * 60 * 1000,
)

// Rate limit function for chat
function applyChatRateLimit(
  campaignId: string,
  sessionId: string,
  limit = 30, // Default: 30 messages per 5 minutes
  windowMs = 5 * 60 * 1000, // 5 minutes in milliseconds
): {
  success: boolean
  remaining: number
  reset: number
} {
  const now = Date.now()
  const key = `${campaignId}:${sessionId}`

  // Get or create record
  const record = chatRateLimits.get(key) || { count: 0, timestamp: now }

  // Reset if outside window
  if (now - record.timestamp > windowMs) {
    record.count = 0
    record.timestamp = now
  }

  // Increment count
  record.count++

  // Store updated record
  chatRateLimits.set(key, record)

  // Calculate remaining attempts and reset time
  const remaining = Math.max(0, limit - record.count)
  const reset = record.timestamp + windowMs

  // Return result
  return {
    success: record.count <= limit,
    remaining,
    reset,
  }
}

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const campaignId = params.id
    const requestData = await request.json()

    // Handle both message formats
    let message: string
    const sessionId: string = requestData.sessionId || ""

    if (requestData.message) {
      message = requestData.message
    } else if (requestData.messages && Array.isArray(requestData.messages)) {
      const lastMessage = requestData.messages[requestData.messages.length - 1]
      message = lastMessage.content || ""
    } else {
      return NextResponse.json({ error: "Message is required" }, { status: 400 })
    }

    if (!message) {
      return NextResponse.json({ error: "Message is required" }, { status: 400 })
    }

    if (!sessionId) {
      return NextResponse.json({ error: "Session ID is required" }, { status: 400 })
    }

    console.log(`Processing chat for campaign ${campaignId} with message: ${message.substring(0, 50)}...`)
    console.log(`Session ID: ${sessionId}`)

    // Validate campaign exists and is active
    const client = await clientPromise
    const campaignService = new CampaignService(client)
    const campaign = await campaignService.getCampaign(campaignId)

    if (!campaign) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 })
    }

    if (campaign.isActive === false) {
      return NextResponse.json({ error: "Campaign is inactive" }, { status: 403 })
    }

    // Check if rate limiting is enabled for this campaign
    // Default to true if the setting doesn't exist
    const rateLimitEnabled = campaign.chatRateLimitEnabled !== false

    // Apply rate limiting if enabled
    if (rateLimitEnabled && sessionId) {
      const rateLimitResult = applyChatRateLimit(campaignId, sessionId)

      if (!rateLimitResult.success) {
        // Log the rate limit exceeded event
        try {
          const activityLogService = new ActivityLogService(client)
          await activityLogService.createLog({
            campaignId: new ObjectId(campaignId),
            userId: new ObjectId("000000000000000000000000"), // System user ID
            userName: "System",
            action: ActivityAction.RATE_LIMIT_EXCEEDED,
            entityType: EntityType.RATE_LIMIT,
            details: {
              sessionId,
              requestCount: rateLimitResult.count,
              limit: 30, // Default limit
              windowMinutes: 5, // Default window
            },
          })
        } catch (error) {
          console.error("Error logging rate limit event:", error)
        }

        // Return rate limit exceeded response
        return NextResponse.json(
          { error: "Rate limit exceeded. Please try again later." },
          {
            status: 429,
            headers: {
              "X-RateLimit-Limit": "30",
              "X-RateLimit-Remaining": rateLimitResult.remaining.toString(),
              "X-RateLimit-Reset": rateLimitResult.reset.toString(),
            },
          },
        )
      }
    }

    // Track the person in the people collection
    if (sessionId) {
      try {
        const db = client.db()

        // Check if person exists by sessionId
        const existingPerson = await db.collection("people").findOne({
          campaignId: new ObjectId(campaignId),
          sessionId: sessionId,
        })

        if (existingPerson) {
          // Update existing person
          console.log(`Updating existing person with sessionId ${sessionId}: ${existingPerson._id.toString()}`)
          await db.collection("people").updateOne(
            { sessionId: sessionId, campaignId: new ObjectId(campaignId) },
            {
              $set: { lastInteraction: new Date() },
              $inc: { interactionCount: 1 },
            },
          )
        } else {
          // Create new person
          console.log(`Creating new person with session ID: ${sessionId}`)
          const newPerson = {
            campaignId: new ObjectId(campaignId),
            sessionId: sessionId,
            isDonor: false,
            firstInteraction: new Date(),
            lastInteraction: new Date(),
            interactionCount: 1,
          }

          const result = await db.collection("people").insertOne(newPerson)
          console.log(`New person created with ID: ${result.insertedId}`)
        }
      } catch (error) {
        console.error("Error tracking person:", error)
        // Continue with the chat even if person tracking fails
      }
    }

    // Generate AI response
    const aiService = new AIService(client)
    let response
    try {
      response = await aiService.generateResponse(campaignId, message)
    } catch (error) {
      console.error("Error generating AI response:", error)
      return NextResponse.json({ error: "Failed to generate AI response" }, { status: 500 })
    }

    return NextResponse.json({ response })
  } catch (error) {
    console.error("Error in chat API:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
