import { type NextRequest, NextResponse } from "next/server"
import { getMongoClient } from "@/lib/mongodb"
import { ChatFeedbackService } from "@/services/chatFeedbackService"
import { verifyAuth } from "@/lib/auth"

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const campaignId = params.id
    const { sessionId, rating } = await request.json()

    if (!sessionId || !rating || !["positive", "negative"].includes(rating)) {
      return NextResponse.json(
        { error: "Invalid request. SessionId and rating (positive/negative) are required." },
        { status: 400 },
      )
    }

    const client = await getMongoClient()
    const feedbackService = new ChatFeedbackService(client)

    const feedback = await feedbackService.submitFeedback(campaignId, sessionId, rating as "positive" | "negative")

    return NextResponse.json({ success: true, feedback })
  } catch (error) {
    console.error("Error submitting chat feedback:", error)
    return NextResponse.json({ error: "Failed to submit feedback" }, { status: 500 })
  }
}

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { searchParams } = new URL(request.url)
    const startDateParam = searchParams.get("startDate")
    const endDateParam = searchParams.get("endDate")

    // Verify authentication
    const authResult = await verifyAuth(request)
    if (!authResult.isAuthenticated) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const campaignId = params.id
    const client = await getMongoClient()
    const feedbackService = new ChatFeedbackService(client)

    // Parse date parameters
    const options: { startDate?: Date; endDate?: Date } = {}
    if (startDateParam) options.startDate = new Date(startDateParam)
    if (endDateParam) options.endDate = new Date(endDateParam)

    // Get overall stats
    const stats = await feedbackService.getFeedbackStats(campaignId, options)

    // Get daily trends
    const trends = await feedbackService.getFeedbackTrends(campaignId, options)

    return NextResponse.json({
      stats,
      trends,
    })
  } catch (error) {
    console.error("Error fetching feedback stats:", error)
    return NextResponse.json({ error: "Failed to fetch feedback statistics" }, { status: 500 })
  }
}
