import { type NextRequest, NextResponse } from "next/server"
import clientPromise from "@/lib/mongodb"
import { verifyAuth } from "@/lib/auth"
import { ObjectId } from "mongodb"

// DELETE endpoint to remove a specific chat session and all its messages
export async function DELETE(request: NextRequest, { params }: { params: { id: string; sessionId: string } }) {
  try {
    // Verify authentication
    const authResult = await verifyAuth(request)
    if (!authResult.isAuthenticated) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const campaignId = params.id
    const sessionId = params.sessionId

    if (!sessionId) {
      return NextResponse.json({ error: "Session ID is required" }, { status: 400 })
    }

    const client = await clientPromise
    const db = client.db()

    // Delete all messages for this session
    const result = await db.collection("chatlogs").deleteMany({
      campaignId: new ObjectId(campaignId),
      sessionId: sessionId,
    })

    if (result.deletedCount === 0) {
      return NextResponse.json(
        {
          success: false,
          message: "No chat logs found for this session",
        },
        { status: 404 },
      )
    }

    return NextResponse.json({
      success: true,
      message: `Deleted ${result.deletedCount} messages from session`,
      deletedCount: result.deletedCount,
    })
  } catch (error) {
    console.error("Error deleting chat logs:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
