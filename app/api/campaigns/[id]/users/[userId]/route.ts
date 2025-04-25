import { type NextRequest, NextResponse } from "next/server"
import clientPromise from "@/lib/mongodb"
import { CampaignService } from "@/services/campaignService"
import type { UserRole } from "@/models/UserCampaign"
import { verifyJWT } from "@/lib/auth"
import { UserService } from "@/services/userService"

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

// Helper function to check if user has admin permission for a campaign
async function checkAdminPermission(campaignId: string, userId: string) {
  const client = await clientPromise

  // First check if user is a super admin
  const userService = new UserService(client)
  const user = await userService.findUserById(userId)
  if (user && user.isSuperAdmin) {
    return true // Super admins have permission for everything
  }

  // Otherwise check campaign-specific role
  const campaignService = new CampaignService(client)
  const userRole = await campaignService.getUserRole(campaignId, userId)

  if (!userRole || !["owner", "admin"].includes(userRole)) {
    return false
  }

  return true
}

// PUT /api/campaigns/[id]/users/[userId] - Update a user's role in a campaign
export async function PUT(request: NextRequest, { params }: { params: { id: string; userId: string } }) {
  try {
    const currentUserId = await getUserIdFromRequest(request)
    if (!currentUserId) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
    }

    const { id: campaignId, userId: targetUserId } = params

    // Check if current user has admin permission
    const hasPermission = await checkAdminPermission(campaignId, currentUserId)
    if (!hasPermission) {
      return NextResponse.json({ message: "You don't have permission to update user roles" }, { status: 403 })
    }

    const body = await request.json()
    const { role } = body

    if (!role || !["admin", "editor", "viewer"].includes(role)) {
      return NextResponse.json({ message: "Invalid role" }, { status: 400 })
    }

    const client = await clientPromise
    const campaignService = new CampaignService(client)

    // Check if target user is the owner
    const targetUserRole = await campaignService.getUserRole(campaignId, targetUserId)
    if (targetUserRole === "owner") {
      return NextResponse.json({ message: "Cannot change the role of the campaign owner" }, { status: 403 })
    }

    const updatedUserCampaign = await campaignService.updateUserRole(campaignId, targetUserId, role as UserRole)

    if (!updatedUserCampaign) {
      return NextResponse.json({ message: "User not found in this campaign" }, { status: 404 })
    }

    return NextResponse.json({ message: "User role updated successfully", userCampaign: updatedUserCampaign })
  } catch (error) {
    return NextResponse.json({ message: "Internal server error", error: error.message }, { status: 500 })
  }
}

// DELETE /api/campaigns/[id]/users/[userId] - Remove a user from a campaign
export async function DELETE(request: NextRequest, { params }: { params: { id: string; userId: string } }) {
  try {
    const currentUserId = await getUserIdFromRequest(request)
    if (!currentUserId) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
    }

    const { id: campaignId, userId: targetUserId } = params

    // Check if current user has admin permission
    const hasPermission = await checkAdminPermission(campaignId, currentUserId)
    if (!hasPermission) {
      return NextResponse.json({ message: "You don't have permission to remove users" }, { status: 403 })
    }

    const client = await clientPromise
    const campaignService = new CampaignService(client)

    // Check if target user is the owner
    const targetUserRole = await campaignService.getUserRole(campaignId, targetUserId)
    if (targetUserRole === "owner") {
      return NextResponse.json({ message: "Cannot remove the campaign owner" }, { status: 403 })
    }

    const removed = await campaignService.removeUserFromCampaign(campaignId, targetUserId)

    if (!removed) {
      return NextResponse.json({ message: "User not found in this campaign" }, { status: 404 })
    }

    return NextResponse.json({ message: "User removed from campaign successfully" })
  } catch (error) {
    return NextResponse.json({ message: "Internal server error", error: error.message }, { status: 500 })
  }
}
