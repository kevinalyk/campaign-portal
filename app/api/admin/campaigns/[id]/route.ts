import { type NextRequest, NextResponse } from "next/server"
import clientPromise from "@/lib/mongodb"
import { verifyJWT } from "@/lib/auth"
import { ObjectId } from "mongodb"

// Helper function to get user from JWT token
async function getUserFromRequest(request: NextRequest): Promise<{ userId: string; isSuperAdmin: boolean } | null> {
  const token = request.headers.get("Authorization")?.replace("Bearer ", "")
  if (!token) return null

  try {
    const payload = await verifyJWT(token)
    return {
      userId: payload.userId,
      isSuperAdmin: payload.isSuperAdmin || false,
    }
  } catch (error) {
    return null
  }
}

// DELETE /api/admin/campaigns/[id] - Delete a campaign (super admin only)
export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
    }

    if (!user.isSuperAdmin) {
      return NextResponse.json({ message: "Forbidden: Super admin access required" }, { status: 403 })
    }

    const campaignId = params.id

    const client = await clientPromise
    const db = client.db()

    // Delete the campaign
    const result = await db.collection("campaigns").deleteOne({ _id: new ObjectId(campaignId) })

    if (result.deletedCount === 0) {
      return NextResponse.json({ message: "Organization not found" }, { status: 404 })
    }

    // Delete all user-campaign relationships
    await db.collection("userCampaigns").deleteMany({ campaignId: new ObjectId(campaignId) })

    // Delete all documents associated with the campaign
    await db.collection("documents").deleteMany({ campaignId: new ObjectId(campaignId) })

    // Delete all website resources associated with the campaign
    await db.collection("websiteResources").deleteMany({ campaignId: new ObjectId(campaignId) })

    return NextResponse.json({ message: "Organization deleted successfully" })
  } catch (error) {
    console.error("Error deleting campaign:", error)
    return NextResponse.json({ message: "Internal server error", error: error.message }, { status: 500 })
  }
}
