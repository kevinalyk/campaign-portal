import { type NextRequest, NextResponse } from "next/server"
import clientPromise from "@/lib/mongodb"
import { CampaignService } from "@/services/campaignService"
import { verifyJWT } from "@/lib/auth"
import { WebsiteResourceService } from "@/services/websiteResourceService"
import { HybridCrawlerService } from "@/services/hybridCrawlerService"
import { ObjectId } from "mongodb"
import { UserService } from "@/services/userService"
import { ActivityLogService } from "@/services/activityLogService"
import { ActivityAction, EntityType } from "@/models/ActivityLog"

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

// Helper function to check if user has permission for a campaign
async function checkPermission(
  campaignId: string,
  userId: string,
  requiredRoles: string[] = ["owner", "admin", "editor"],
) {
  const client = await clientPromise
  const campaignService = new CampaignService(client)

  // First check if user is a super admin
  const userService = new UserService(client)
  const user = await userService.findUserById(userId)
  if (user && user.isSuperAdmin) {
    return true // Super admins have permission for everything
  }

  // Otherwise check campaign-specific role
  const userRole = await campaignService.getUserRole(campaignId, userId)

  if (!userRole || !requiredRoles.includes(userRole)) {
    return false
  }

  return true
}

// GET /api/campaigns/[id] - Get a specific campaign
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const userId = await getUserIdFromRequest(request)
    if (!userId) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
    }

    const campaignIdOrUrl = params.id
    const client = await clientPromise
    const campaignService = new CampaignService(client)

    // Try to parse as ObjectId first
    let campaign
    try {
      // If it looks like a valid ObjectId, try to fetch by ID
      if (campaignIdOrUrl.match(/^[0-9a-fA-F]{24}$/)) {
        campaign = await campaignService.getCampaign(campaignIdOrUrl)
      }
    } catch (error) {
      // If ObjectId parsing fails, continue to URL lookup
    }

    // If not found by ID, try to fetch by URL
    if (!campaign) {
      campaign = await campaignService.getCampaignByUrl(campaignIdOrUrl)
    }

    if (!campaign) {
      return NextResponse.json({ message: "Campaign not found" }, { status: 404 })
    }

    // Check if user has access to this campaign
    const hasAccess = await checkPermission(campaign._id.toString(), userId, ["owner", "admin", "editor", "viewer"])
    if (!hasAccess) {
      return NextResponse.json({ message: "You don't have access to this campaign" }, { status: 403 })
    }

    return NextResponse.json({ campaign })
  } catch (error) {
    return NextResponse.json({ message: "Internal server error", error: error.message }, { status: 500 })
  }
}

// PUT /api/campaigns/[id] - Update a campaign
export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const userId = await getUserIdFromRequest(request)
    if (!userId) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
    }

    const campaignIdOrUrl = params.id
    const client = await clientPromise
    const campaignService = new CampaignService(client)

    // First, get the campaign by ID or URL to get the actual MongoDB ID
    let campaign
    try {
      // If it looks like a valid ObjectId, try to fetch by ID
      if (campaignIdOrUrl.match(/^[0-9a-fA-F]{24}$/)) {
        campaign = await campaignService.getCampaign(campaignIdOrUrl)
      } else {
        // Otherwise, try to fetch by URL
        campaign = await campaignService.getCampaignByUrl(campaignIdOrUrl)
      }
    } catch (error) {
      console.error("Error fetching campaign:", error)
      return NextResponse.json({ message: "Campaign not found" }, { status: 404 })
    }

    if (!campaign) {
      return NextResponse.json({ message: "Campaign not found" }, { status: 404 })
    }

    // Use the actual MongoDB ID for permission check and update
    const campaignId = campaign._id.toString()

    // Check if user has permission to edit this campaign
    const hasPermission = await checkPermission(campaignId, userId, ["owner", "admin", "editor"])
    if (!hasPermission) {
      return NextResponse.json({ message: "You don't have permission to edit this campaign" }, { status: 403 })
    }

    const body = await request.json()
    const updateData = {
      name: body.name,
      url: body.url,
      donationUrl: body.donationUrl,
      websiteUrl: body.websiteUrl,
      description: body.description,
      logoUrl: body.logoUrl,
      chatColor: body.chatColor,
      chatWelcomeMessage: body.chatWelcomeMessage,
      contactEmail: body.contactEmail,
      contactPhone: body.contactPhone,
      contactAddress: body.contactAddress,
      assistantIdentity: body.assistantIdentity,
    }

    // Get the current campaign to check if websiteUrl changed
    const currentCampaign = campaign

    const updatedCampaign = await campaignService.updateCampaign(campaignId, updateData)

    if (!updatedCampaign) {
      return NextResponse.json({ message: "Campaign not found" }, { status: 404 })
    }

    // Get user information for the log
    const userService = new UserService(client)
    const user = await userService.findUserById(userId)
    const userName = user
      ? user.firstName && user.lastName
        ? `${user.firstName} ${user.lastName}`
        : user.email
      : "Unknown User"

    // Log the campaign update activity
    const activityLogService = new ActivityLogService(client)
    await activityLogService.createLog({
      campaignId: new ObjectId(campaignId),
      userId: new ObjectId(userId),
      userName,
      action: ActivityAction.UPDATE,
      entityType: EntityType.CAMPAIGN,
      entityId: new ObjectId(campaignId),
      details: {
        name: updatedCampaign.name,
        description: updatedCampaign.description,
        // Include only non-sensitive fields in the log
        fieldsUpdated: Object.keys(updateData).filter(
          (key) => updateData[key] !== undefined && updateData[key] !== null,
        ),
      },
    })

    // If websiteUrl changed, update or create the website resource
    if (updateData.websiteUrl && updateData.websiteUrl !== currentCampaign.websiteUrl) {
      try {
        const websiteResourceService = new WebsiteResourceService(client)
        const db = client.db()

        // Check if there's already a URL resource for this campaign
        const existingResource = await db.collection("websiteResources").findOne({
          campaignId: new ObjectId(campaignId),
          type: "url",
          url: currentCampaign.websiteUrl,
        })

        if (existingResource) {
          // Update the existing resource
          await websiteResourceService.updateWebsiteResource(existingResource._id.toString(), {
            url: updateData.websiteUrl,
          })

          // Log the website resource update
          await activityLogService.createLog({
            campaignId: new ObjectId(campaignId),
            userId: new ObjectId(userId),
            userName,
            action: ActivityAction.UPDATE,
            entityType: EntityType.WEBSITE,
            entityId: existingResource._id,
            details: {
              url: updateData.websiteUrl,
              previousUrl: currentCampaign.websiteUrl,
            },
          })

          // Restart the crawling process
          const hybridCrawlerService = new HybridCrawlerService(client)
          hybridCrawlerService.startCrawling(existingResource._id.toString()).catch(() => {
            // Error restarting crawler - silently fail
          })
        } else {
          // Create a new resource
          const resource = await websiteResourceService.createWebsiteResource({
            campaignId: campaignId,
            type: "url",
            url: updateData.websiteUrl,
          })

          // Log the website resource creation
          await activityLogService.createLog({
            campaignId: new ObjectId(campaignId),
            userId: new ObjectId(userId),
            userName,
            action: ActivityAction.CREATE,
            entityType: EntityType.WEBSITE,
            entityId: resource._id,
            details: {
              url: updateData.websiteUrl,
            },
          })

          // Start the crawling process
          const hybridCrawlerService = new HybridCrawlerService(client)
          hybridCrawlerService.startCrawling(resource._id.toString()).catch(() => {
            // Error starting crawler - silently fail
          })
        }
      } catch (error) {
        // Error updating website URL resource - silently fail
      }
    }

    return NextResponse.json({ message: "Campaign updated successfully", campaign: updatedCampaign })
  } catch (error) {
    console.error("Error updating campaign:", error)
    return NextResponse.json({ message: "Internal server error", error: error.message }, { status: 500 })
  }
}

// DELETE /api/campaigns/[id] - Delete a campaign
export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const userId = await getUserIdFromRequest(request)
    if (!userId) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
    }

    const campaignId = params.id

    // Only owners can delete campaigns
    const hasPermission = await checkPermission(campaignId, userId, ["owner"])
    if (!hasPermission) {
      return NextResponse.json({ message: "Only the campaign owner can delete it" }, { status: 403 })
    }

    const client = await clientPromise
    const campaignService = new CampaignService(client)

    // Get campaign details before deletion for logging
    const campaign = await campaignService.getCampaign(campaignId)
    if (!campaign) {
      return NextResponse.json({ message: "Campaign not found" }, { status: 404 })
    }

    const deleted = await campaignService.deleteCampaign(campaignId)

    if (!deleted) {
      return NextResponse.json({ message: "Campaign not found" }, { status: 404 })
    }

    // Get user information for the log
    const userService = new UserService(client)
    const user = await userService.findUserById(userId)
    const userName = user
      ? user.firstName && user.lastName
        ? `${user.firstName} ${user.lastName}`
        : user.email
      : "Unknown User"

    // Log the campaign deletion activity
    const activityLogService = new ActivityLogService(client)
    await activityLogService.createLog({
      campaignId: new ObjectId(campaignId),
      userId: new ObjectId(userId),
      userName,
      action: ActivityAction.DELETE,
      entityType: EntityType.CAMPAIGN,
      details: {
        name: campaign.name,
      },
    })

    return NextResponse.json({ message: "Campaign deleted successfully" })
  } catch (error) {
    return NextResponse.json({ message: "Internal server error", error: error.message }, { status: 500 })
  }
}
