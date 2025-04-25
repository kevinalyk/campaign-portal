import { type NextRequest, NextResponse } from "next/server"
import clientPromise from "@/lib/mongodb"
import AIService from "@/services/AIService"
import { CampaignService } from "@/services/campaignService"
import { ObjectId } from "mongodb"

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
