import { type NextRequest, NextResponse } from "next/server"
import clientPromise from "@/lib/mongodb"
import { verifyJWT } from "@/lib/auth"
import { checkPermission } from "@/lib/auth"
import { ObjectId } from "mongodb"

// Helper function to get user ID from JWT token
async function getUserIdFromRequest(request: NextRequest): Promise<string | null> {
  const token = request.headers.get("Authorization")?.replace("Bearer ", "")
  if (!token) return null

  try {
    const payload = await verifyJWT(token)
    return payload.userId
  } catch (error) {
    console.error("JWT verification error:", error)
    return null
  }
}

// GET /api/campaigns/[id]/activity-logs - Get activity logs for a campaign
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  console.log("Activity logs GET request received for campaign:", params.id)

  try {
    const userId = await getUserIdFromRequest(request)
    if (!userId) {
      console.log("Unauthorized: No valid user ID from token")
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
    }
    console.log("User ID from token:", userId)

    const campaignId = params.id
    console.log("Campaign ID:", campaignId)

    // Check if user has access to this campaign
    const hasAccess = await checkPermission(campaignId, userId, ["owner", "admin", "editor", "viewer"])
    if (!hasAccess) {
      console.log("Access denied: User does not have permission")
      return NextResponse.json({ message: "You don't have access to this campaign" }, { status: 403 })
    }
    console.log("User has access to campaign")

    // Get query parameters
    const { searchParams } = new URL(request.url)
    const limit = Number.parseInt(searchParams.get("limit") || "50", 10)
    const skip = Number.parseInt(searchParams.get("skip") || "0", 10)
    const entityType = searchParams.get("entityType") || null
    console.log("Query params:", { limit, skip, entityType })

    const client = await clientPromise
    const db = client.db()

    // Check if activityLogs collection exists
    const collections = await db.listCollections({ name: "activityLogs" }).toArray()
    console.log("Collections check:", collections.length > 0 ? "activityLogs exists" : "activityLogs does not exist")

    if (collections.length === 0) {
      // Collection doesn't exist, create it
      await db.createCollection("activityLogs")
      console.log("Created activityLogs collection")

      // Return empty array since there are no logs yet
      return NextResponse.json({ logs: [] })
    }

    // Check if there are any logs in the collection
    const count = await db.collection("activityLogs").countDocuments()
    console.log("Total activity logs in collection:", count)

    // Check if there are any logs for this specific campaign
    const campaignCount = await db.collection("activityLogs").countDocuments({
      campaignId: new ObjectId(campaignId),
    })
    console.log(`Found ${campaignCount} logs for campaign ${campaignId}`)

    // Build the query
    const query: any = { campaignId: new ObjectId(campaignId) }
    if (entityType && entityType !== "all") {
      query.entityType = entityType
    }

    console.log("MongoDB query:", JSON.stringify(query))

    // Execute the query
    const logs = await db
      .collection("activityLogs")
      .find(query)
      .sort({ timestamp: -1 })
      .skip(skip)
      .limit(limit)
      .toArray()

    console.log(`Found ${logs.length} logs for the query`)

    // Format logs for response
    const formattedLogs = logs.map((log) => ({
      ...log,
      _id: log._id.toString(),
      campaignId: log.campaignId.toString(),
      userId: log.userId.toString(),
      entityId: log.entityId ? log.entityId.toString() : undefined,
    }))

    return NextResponse.json({ logs: formattedLogs })
  } catch (error) {
    console.error("Error fetching activity logs:", error)
    return NextResponse.json(
      {
        message: "Internal server error",
        error: error.message,
        stack: error.stack,
      },
      { status: 500 },
    )
  }
}

// POST /api/campaigns/[id]/activity-logs - Create a new activity log
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  console.log("Activity logs POST request received for campaign:", params.id)

  try {
    const userId = await getUserIdFromRequest(request)
    if (!userId) {
      console.log("Unauthorized: No valid user ID from token")
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
    }
    console.log("User ID from token:", userId)

    const campaignId = params.id
    console.log("Campaign ID:", campaignId)

    // Check if user has permission to create logs
    const hasPermission = await checkPermission(campaignId, userId, ["owner", "admin", "editor"])
    if (!hasPermission) {
      console.log("Permission denied: User cannot create logs")
      return NextResponse.json({ message: "You don't have permission to create logs" }, { status: 403 })
    }
    console.log("User has permission to create logs")

    const body = await request.json()
    const { action, entityType, entityId, details, userName } = body
    console.log("Log data:", { action, entityType, entityId, details, userName })

    if (!action || !entityType) {
      console.log("Bad request: Missing required fields")
      return NextResponse.json({ message: "Action and entity type are required" }, { status: 400 })
    }

    const client = await clientPromise
    const db = client.db()

    // Ensure the activityLogs collection exists
    const collections = await db.listCollections({ name: "activityLogs" }).toArray()
    console.log("Collections check:", collections.length > 0 ? "activityLogs exists" : "activityLogs does not exist")

    if (collections.length === 0) {
      // Collection doesn't exist, create it
      await db.createCollection("activityLogs")
      console.log("Created activityLogs collection")
    }

    // Create the log document
    const log = {
      campaignId: new ObjectId(campaignId),
      userId: new ObjectId(userId),
      userName: userName || "Unknown User",
      action,
      entityType,
      entityId: entityId ? new ObjectId(entityId) : undefined,
      details,
      timestamp: new Date(),
    }

    // Insert the log
    const result = await db.collection("activityLogs").insertOne(log)
    console.log("Created activity log with ID:", result.insertedId)

    return NextResponse.json(
      {
        message: "Activity log created successfully",
        log: {
          ...log,
          _id: result.insertedId.toString(),
          campaignId: log.campaignId.toString(),
          userId: log.userId.toString(),
          entityId: log.entityId ? log.entityId.toString() : undefined,
          timestamp: log.timestamp.toISOString(),
        },
      },
      { status: 201 },
    )
  } catch (error) {
    console.error("Error creating activity log:", error)
    return NextResponse.json(
      {
        message: "Internal server error",
        error: error.message,
        stack: error.stack,
      },
      { status: 500 },
    )
  }
}
