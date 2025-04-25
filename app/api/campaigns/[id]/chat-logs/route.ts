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
    const sessionId = searchParams.get("sessionId")
    const startDate = searchParams.get("startDate") ? new Date(searchParams.get("startDate") as string) : undefined
    const endDate = searchParams.get("endDate") ? new Date(searchParams.get("endDate") as string) : undefined
    const limit = searchParams.get("limit") ? Number.parseInt(searchParams.get("limit") as string) : 100
    const skip = searchParams.get("skip") ? Number.parseInt(searchParams.get("skip") as string) : 0
    const sort = searchParams.get("sort") || "desc"

    if (!sessionId) {
      return NextResponse.json({ error: "Session ID is required" }, { status: 400 })
    }

    const client = await clientPromise
    const db = client.db()

    // Build the query
    const query: any = {
      campaignId: new ObjectId(campaignId),
      sessionId,
    }

    if (startDate || endDate) {
      query.timestamp = {}
      if (startDate) {
        query.timestamp.$gte = startDate
      }
      if (endDate) {
        query.timestamp.$lte = endDate
      }
    }

    // Get the total count
    const total = await db.collection("chatlogs").countDocuments(query)

    // Get the logs
    const logs = await db
      .collection("chatlogs")
      .find(query)
      .sort({ timestamp: sort === "asc" ? 1 : -1 })
      .skip(skip)
      .limit(limit)
      .toArray()

    return NextResponse.json({ logs, total })
  } catch (error) {
    console.error("Error retrieving chat logs:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// Add POST endpoint to log chat messages
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const campaignId = params.id
    const { sessionId, message, role, userIdentifier, metadata } = await request.json()

    if (!sessionId || !message || !role) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    const client = await clientPromise
    const db = client.db()

    // Get IP address for logging (optional)
    const ip = request.headers.get("x-forwarded-for") || request.ip
    const ipHash = ip ? Buffer.from(ip).toString("base64") : undefined

    // Get user agent for logging (optional)
    const userAgent = request.headers.get("user-agent")

    // Combine provided metadata with request metadata
    const combinedMetadata = {
      ...metadata,
      ipHash,
      userAgent,
      timestamp: new Date(),
    }

    // Create the chat log
    const chatLog = {
      campaignId: new ObjectId(campaignId),
      sessionId,
      userIdentifier,
      message,
      role,
      timestamp: new Date(),
      metadata: combinedMetadata,
    }

    await db.collection("chatlogs").insertOne(chatLog)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error logging chat message:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
