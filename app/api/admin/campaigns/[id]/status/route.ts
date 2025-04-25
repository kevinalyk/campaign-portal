import { type NextRequest, NextResponse } from "next/server"
import clientPromise from "@/lib/mongodb"
import { CampaignService } from "@/services/campaignService"
import { verifyJWT } from "@/lib/auth"

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

// PATCH /api/admin/campaigns/[id]/status - Toggle campaign active status (super admin only)
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
    }

    if (!user.isSuperAdmin) {
      return NextResponse.json({ message: "Forbidden: Super admin access required" }, { status: 403 })
    }

    const campaignId = params.id

    const body = await request.json()
    const { isActive } = body

    if (typeof isActive !== "boolean") {
      return NextResponse.json({ message: "Invalid request: isActive must be a boolean" }, { status: 400 })
    }

    const client = await clientPromise
    const campaignService = new CampaignService(client)

    // Check if campaign exists
    const campaign = await campaignService.getCampaign(campaignId)
    if (!campaign) {
      return NextResponse.json({ message: "Organization not found" }, { status: 404 })
    }

    // Update campaign status
    const updatedCampaign = await campaignService.toggleCampaignStatus(campaignId, isActive)

    if (!updatedCampaign) {
      return NextResponse.json({ message: "Failed to update organization status" }, { status: 500 })
    }

    return NextResponse.json({
      message: `Organization ${isActive ? "activated" : "deactivated"} successfully`,
      campaign: {
        id: updatedCampaign._id,
        name: updatedCampaign.name,
        url: updatedCampaign.url,
        isActive: updatedCampaign.isActive,
      },
    })
  } catch (error) {
    console.error("Error updating organization status:", error)
    return NextResponse.json({ message: "Internal server error", error: error.message }, { status: 500 })
  }
}
