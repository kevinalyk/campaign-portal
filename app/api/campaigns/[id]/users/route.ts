import { type NextRequest, NextResponse } from "next/server"
import clientPromise from "@/lib/mongodb"
import { CampaignService } from "@/services/campaignService"
import type { UserRole } from "@/models/UserCampaign"
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

// GET /api/campaigns/[id]/users - Get all users for a campaign
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    console.log("GET /api/campaigns/[id]/users - Fetching users for campaign:", params.id)
    const userId = await getUserIdFromRequest(request)
    if (!userId) {
      console.log("Unauthorized: No user ID found in token")
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
    }
    console.log("User ID from token:", userId)

    const campaignId = params.id

    // Check if user has access to this campaign
    console.log("Checking user permission for campaign")
    const hasAccess = await checkPermission(campaignId, userId, ["owner", "admin", "editor", "viewer"])
    if (!hasAccess) {
      console.log("Access denied: User doesn't have permission")
      return NextResponse.json({ message: "You don't have access to this campaign" }, { status: 403 })
    }
    console.log("User has access to campaign")

    const client = await clientPromise
    const campaignService = new CampaignService(client)
    const campaignUsers = await campaignService.getCampaignUsers(campaignId)
    console.log("Campaign users fetched:", campaignUsers.length)
    return NextResponse.json({ users: campaignUsers })
  } catch (error) {
    console.error("Error fetching campaign users:", error)
    return NextResponse.json({ message: "Internal server error", error: error.message }, { status: 500 })
  }
}

// POST /api/campaigns/[id]/users - Add a user to a campaign
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const currentUserId = await getUserIdFromRequest(request)
    if (!currentUserId) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
    }

    const campaignId = params.id

    // Check if current user has admin permission
    const hasPermission = await checkPermission(campaignId, currentUserId, ["owner", "admin"])
    if (!hasPermission) {
      return NextResponse.json({ message: "You don't have permission to add users to this campaign" }, { status: 403 })
    }

    const body = await request.json()
    const { userId, role } = body

    if (!userId || !role || !["admin", "editor", "viewer"].includes(role)) {
      return NextResponse.json({ message: "Invalid user ID or role" }, { status: 400 })
    }

    const client = await clientPromise
    const campaignService = new CampaignService(client)

    try {
      const userCampaign = await campaignService.addUserToCampaign(campaignId, userId, role as UserRole)
      return NextResponse.json({ message: "User added to campaign successfully", userCampaign }, { status: 201 })
    } catch (error) {
      return NextResponse.json({ message: error.message }, { status: 400 })
    }
  } catch (error) {
    console.error("Error adding user to campaign:", error)
    return NextResponse.json({ message: "Internal server error", error: error.message }, { status: 500 })
  }
}
