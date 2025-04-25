import { type NextRequest, NextResponse } from "next/server"
import clientPromise from "@/lib/mongodb"
import { CampaignService } from "@/services/campaignService"
import type { CampaignInput } from "@/models/Campaign"
import { verifyJWT } from "@/lib/auth"
import { WebsiteResourceService } from "@/services/websiteResourceService"
import { HybridCrawlerService } from "@/services/hybridCrawlerService"
// Import the UserService
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

// GET /api/campaigns - Get all campaigns for the current user
export async function GET(request: NextRequest) {
  try {
    const userId = await getUserIdFromRequest(request)
    if (!userId) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
    }

    const client = await clientPromise
    const campaignService = new CampaignService(client)

    // Check if user is a super admin
    const userService = new UserService(client)
    const user = await userService.findUserById(userId)

    let campaigns
    if (user && user.isSuperAdmin) {
      // Super admins get all campaigns
      campaigns = await campaignService.getAllCampaigns()
    } else {
      // Regular users only get their campaigns
      campaigns = await campaignService.getUserCampaigns(userId)
    }

    return NextResponse.json({ campaigns })
  } catch (error) {
    return NextResponse.json({ message: "Internal server error", error: error.message }, { status: 500 })
  }
}

// POST /api/campaigns - Create a new campaign
export async function POST(request: NextRequest) {
  try {
    const userId = await getUserIdFromRequest(request)
    if (!userId) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const campaignData: CampaignInput = {
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
    }

    const client = await clientPromise
    const campaignService = new CampaignService(client)
    const campaign = await campaignService.createCampaign(campaignData, userId)

    // Automatically add the website URL as a resource for the AI bot
    if (campaignData.websiteUrl) {
      try {
        // Create website resource
        const websiteResourceService = new WebsiteResourceService(client)
        const resource = await websiteResourceService.createWebsiteResource({
          campaignId: campaign._id.toString(),
          type: "url",
          url: campaignData.websiteUrl,
        })

        // Start the crawling process asynchronously
        const hybridCrawlerService = new HybridCrawlerService(client)
        hybridCrawlerService.startCrawling(resource._id.toString()).catch(() => {
          // Error starting crawler - silently fail
        })
      } catch (error) {
        // Error adding website URL as resource - silently fail
      }
    }

    return NextResponse.json({ message: "Campaign created successfully", campaign }, { status: 201 })
  } catch (error) {
    return NextResponse.json({ message: "Internal server error", error: error.message }, { status: 500 })
  }
}
