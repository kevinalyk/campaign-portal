import { type NextRequest, NextResponse } from "next/server"
import { del } from "@vercel/blob"
import clientPromise from "@/lib/mongodb"
import { WebsiteResourceService } from "@/services/websiteResourceService"
import { CampaignService } from "@/services/campaignService"
import { verifyJWT } from "@/lib/auth"
import { UserService } from "@/services/userService"
import { HybridCrawlerService } from "@/services/hybridCrawlerService"

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

// Helper function to fetch website content
async function fetchWebsiteContent(url: string): Promise<string> {
  try {
    // Add http:// if not present
    if (!url.startsWith("http://") && !url.startsWith("https://")) {
      url = "https://" + url
    }

    const response = await fetch(url)
    if (!response.ok) {
      throw new Error(`Failed to fetch website: ${response.statusText}`)
    }

    const html = await response.text()
    return html
  } catch (error) {
    console.error("Error fetching website:", error)
    throw new Error(`Failed to fetch website: ${error.message}`)
  }
}

// GET /api/campaigns/[id]/website-resources/[resourceId] - Get a specific website resource
export async function GET(request: NextRequest, { params }: { params: { id: string; resourceId: string } }) {
  try {
    const userId = await getUserIdFromRequest(request)
    if (!userId) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
    }

    const { id: campaignId, resourceId } = params

    // Check if user has access to this campaign
    const hasAccess = await checkPermission(campaignId, userId, ["owner", "admin", "editor", "viewer"])
    if (!hasAccess) {
      return NextResponse.json({ message: "You don't have access to this campaign" }, { status: 403 })
    }

    const client = await clientPromise
    const websiteResourceService = new WebsiteResourceService(client)
    const resource = await websiteResourceService.getWebsiteResource(resourceId)

    if (!resource) {
      return NextResponse.json({ message: "Resource not found" }, { status: 404 })
    }

    // Verify the resource belongs to the specified campaign
    if (resource.campaignId.toString() !== campaignId) {
      return NextResponse.json({ message: "Resource not found in this campaign" }, { status: 404 })
    }

    return NextResponse.json({ resource })
  } catch (error) {
    console.error("Error fetching website resource:", error)
    return NextResponse.json({ message: "Internal server error", error: error.message }, { status: 500 })
  }
}

// DELETE /api/campaigns/[id]/website-resources/[resourceId] - Delete a website resource
export async function DELETE(request: NextRequest, { params }: { params: { id: string; resourceId: string } }) {
  try {
    const userId = await getUserIdFromRequest(request)
    if (!userId) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
    }

    const { id: campaignId, resourceId } = params

    // Check if user has permission to delete website resources
    const hasPermission = await checkPermission(campaignId, userId, ["owner", "admin"])
    if (!hasPermission) {
      return NextResponse.json({ message: "You don't have permission to delete website resources" }, { status: 403 })
    }

    const client = await clientPromise
    const websiteResourceService = new WebsiteResourceService(client)

    // Get the resource to retrieve the file URL
    const resource = await websiteResourceService.getWebsiteResource(resourceId)

    if (!resource) {
      return NextResponse.json({ message: "Resource not found" }, { status: 404 })
    }

    // Verify the resource belongs to the specified campaign
    if (resource.campaignId.toString() !== campaignId) {
      return NextResponse.json({ message: "Resource not found in this campaign" }, { status: 404 })
    }

    // REMOVED: Check for main website URL resource

    // Delete the file from Vercel Blob if it exists
    if (resource.fileUrl && resource.fileKey) {
      await del(resource.fileKey)
    }

    // Delete any associated sitemap
    const crawlerService = new HybridCrawlerService(client)
    await crawlerService.deleteSiteMapByResourceId(resourceId)

    // Delete the resource metadata from the database
    const deleted = await websiteResourceService.deleteWebsiteResource(resourceId)

    if (!deleted) {
      return NextResponse.json({ message: "Failed to delete resource" }, { status: 500 })
    }

    return NextResponse.json({ message: "Website resource deleted successfully" })
  } catch (error) {
    console.error("Error deleting website resource:", error)
    return NextResponse.json({ message: "Internal server error", error: error.message }, { status: 500 })
  }
}

// PATCH /api/campaigns/[id]/website-resources/[resourceId] - Update a website resource
export async function PATCH(request: NextRequest, { params }: { params: { id: string; resourceId: string } }) {
  try {
    const userId = await getUserIdFromRequest(request)
    if (!userId) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
    }

    const { id: campaignId, resourceId } = params

    // Check if user has permission to update website resources
    const hasPermission = await checkPermission(campaignId, userId, ["owner", "admin", "editor"])
    if (!hasPermission) {
      return NextResponse.json({ message: "You don't have permission to update website resources" }, { status: 403 })
    }

    const client = await clientPromise
    const websiteResourceService = new WebsiteResourceService(client)

    // Get the resource to verify it exists and belongs to the campaign
    const existingResource = await websiteResourceService.getWebsiteResource(resourceId)

    if (!existingResource) {
      return NextResponse.json({ message: "Resource not found" }, { status: 404 })
    }

    // Verify the resource belongs to the specified campaign
    if (existingResource.campaignId.toString() !== campaignId) {
      return NextResponse.json({ message: "Resource not found in this campaign" }, { status: 404 })
    }

    // Get update data from request
    const body = await request.json()

    // For URL resources, re-fetch content if URL changed
    if (existingResource.type === "url" && body.url && body.url !== existingResource.url) {
      try {
        const content = await fetchWebsiteContent(body.url)
        body.content = content
      } catch (error) {
        return NextResponse.json({ message: error.message }, { status: 400 })
      }
    }

    // Update the resource
    const updatedResource = await websiteResourceService.updateWebsiteResource(resourceId, body)

    if (!updatedResource) {
      return NextResponse.json({ message: "Failed to update resource" }, { status: 500 })
    }

    return NextResponse.json({
      message: "Website resource updated successfully",
      resource: updatedResource,
    })
  } catch (error) {
    console.error("Error updating website resource:", error)
    return NextResponse.json({ message: "Internal server error", error: error.message }, { status: 500 })
  }
}
