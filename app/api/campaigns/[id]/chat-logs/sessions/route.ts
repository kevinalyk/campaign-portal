import { type NextRequest, NextResponse } from "next/server"
import clientPromise from "@/lib/mongodb"
import { verifyAuth } from "@/lib/auth"
import { ObjectId } from "mongodb"

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    // Verify authentication
    const authResult = await verifyAuth(request)
    if (!authResult.isAuthenticated) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const campaignId = params.id
    const searchParams = request.nextUrl.searchParams

    // Parse query parameters
    const startDate = searchParams.get("startDate") ? new Date(searchParams.get("startDate") as string) : undefined
    const endDate = searchParams.get("endDate") ? new Date(searchParams.get("endDate") as string) : undefined
    const limit = searchParams.get("limit") ? Number.parseInt(searchParams.get("limit") as string) : 10
    const skip = searchParams.get("skip") ? Number.parseInt(searchParams.get("skip") as string) : 0
    const search = searchParams.get("search") || undefined

    const client = await clientPromise
    const db = client.db()

    // Build the query
    const query: any = { campaignId: new ObjectId(campaignId) }

    if (startDate || endDate) {
      query.timestamp = {}
      if (startDate) {
        query.timestamp.$gte = startDate
      }
      if (endDate) {
        query.timestamp.$lte = endDate
      }
    }

    // Add search functionality
    if (search) {
      query.message = { $regex: search, $options: "i" }
    }

    console.log("Query:", JSON.stringify(query))

    // Get all unique session IDs that match the query
    const matchingLogs = await db.collection("chatlogs").find(query).project({ sessionId: 1, _id: 0 }).toArray()

    console.log(`Found ${matchingLogs.length} matching logs`)

    const uniqueSessionIds = [...new Set(matchingLogs.map((log) => log.sessionId))]

    console.log(`Found ${uniqueSessionIds.length} unique session IDs`)

    // Get the total count
    const total = uniqueSessionIds.length

    // Get the paginated sessions with their first message and count
    const paginatedSessionIds = uniqueSessionIds.slice(skip, skip + limit)

    const sessions = []

    for (const sessionId of paginatedSessionIds) {
      // Get the first message timestamp
      const firstMessage = await db
        .collection("chatlogs")
        .find({ campaignId: new ObjectId(campaignId), sessionId })
        .sort({ timestamp: 1 })
        .limit(1)
        .toArray()

      // Get the message count
      const messageCount = await db
        .collection("chatlogs")
        .countDocuments({ campaignId: new ObjectId(campaignId), sessionId })

      // Get a preview of the conversation (first user message)
      const preview = await db
        .collection("chatlogs")
        .find({ campaignId: new ObjectId(campaignId), sessionId, role: "user" })
        .sort({ timestamp: 1 })
        .limit(1)
        .toArray()

      sessions.push({
        _id: sessionId,
        firstMessage: firstMessage[0]?.timestamp || new Date(),
        messageCount,
        preview:
          preview[0]?.message.substring(0, 50) + (preview[0]?.message.length > 50 ? "..." : "") || "Chat session",
      })
    }

    // Sort sessions by most recent first
    sessions.sort((a, b) => new Date(b.firstMessage).getTime() - new Date(a.firstMessage).getTime())

    return NextResponse.json({ sessions, total })
  } catch (error) {
    console.error("Error retrieving chat sessions:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
