import { type NextRequest, NextResponse } from "next/server"
import clientPromise from "@/lib/mongodb"
import { ChatLogService } from "@/services/chatLogService"
import { verifyAuth } from "@/lib/auth"

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    // Verify authentication
    const authResult = await verifyAuth(request)
    if (!authResult.isAuthenticated) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Verify user has admin or owner role for this campaign
    // This would require additional checks in a real implementation

    const { retentionDays } = await request.json()

    if (!retentionDays || typeof retentionDays !== "number" || retentionDays < 1) {
      return NextResponse.json({ error: "Invalid retention period" }, { status: 400 })
    }

    const client = await clientPromise
    const chatLogService = new ChatLogService(client)

    const success = await chatLogService.updateRetentionPeriod(retentionDays)

    if (success) {
      return NextResponse.json({ success: true, retentionDays })
    } else {
      return NextResponse.json({ error: "Failed to update retention period" }, { status: 500 })
    }
  } catch (error) {
    console.error("Error updating retention period:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
