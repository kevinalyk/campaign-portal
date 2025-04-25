import { type NextRequest, NextResponse } from "next/server"
import clientPromise from "@/lib/mongodb"
import { CampaignService } from "@/services/campaignService"
import { verifyJWT, checkPermission } from "@/lib/auth"

// Helper function to get user ID from JWT token
async function getUserIdFromRequest(request: NextRequest): Promise<string | null> {
  const token = request.headers.get("Authorization")?.replace("Bearer ", "")
  if (!token) return null

  try {
    const payload = await verifyJWT(token)
    return payload.userId
  } catch (error) {
    return null
  }
}

// PATCH /api/campaigns/[id]/contact-info - Update only contact information
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const userId = await getUserIdFromRequest(request)
    if (!userId) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
    }

    const campaignId = params.id

    // Check if user has permission to edit this campaign
    const hasPermission = await checkPermission(campaignId, userId, ["owner", "admin", "editor"])
    if (!hasPermission) {
      return NextResponse.json({ message: "You don't have permission to edit this campaign" }, { status: 403 })
    }

    const body = await request.json()

    // Only allow updating contact information fields
    const updateData = {
      contactEmail: body.contactEmail,
      contactPhone: body.contactPhone,
      contactAddress: body.contactAddress, // Keep for backward compatibility
      addressStreet: body.addressStreet,
      addressCity: body.addressCity,
      addressState: body.addressState,
      addressZip: body.addressZip,
    }

    const client = await clientPromise
    const campaignService = new CampaignService(client)
    const updatedCampaign = await campaignService.updateCampaign(campaignId, updateData)

    if (!updatedCampaign) {
      return NextResponse.json({ message: "Campaign not found" }, { status: 404 })
    }

    return NextResponse.json({
      message: "Contact information updated successfully",
      contactInfo: {
        contactEmail: updatedCampaign.contactEmail,
        contactPhone: updatedCampaign.contactPhone,
        contactAddress: updatedCampaign.contactAddress,
        addressStreet: updatedCampaign.addressStreet,
        addressCity: updatedCampaign.addressCity,
        addressState: updatedCampaign.addressState,
        addressZip: updatedCampaign.addressZip,
      },
    })
  } catch (error) {
    return NextResponse.json({ message: "Internal server error", error: error.message }, { status: 500 })
  }
}
