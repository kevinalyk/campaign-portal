import { type NextRequest, NextResponse } from "next/server"
import { put } from "@vercel/blob"
import clientPromise from "@/lib/mongodb"
import { WebsiteResourceService } from "@/services/websiteResourceService"
import { CampaignService } from "@/services/campaignService"
import { verifyJWT } from "@/lib/auth"
import { AwsScraperService } from "@/services/awsScraperService"
import { UserService } from "@/services/userService"
import { ActivityLogService } from "@/services/activityLogService"
import { ActivityAction, EntityType } from "@/models/ActivityLog"
import { ObjectId } from "mongodb"

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

  // First check if user is a super admin
  const userService = new UserService(client)
  const user = await userService.findUserById(userId)
  if (user && user.isSuperAdmin) {
    return true // Super admins have permission for everything
  }

  // Otherwise check campaign-specific role
  const campaignService = new CampaignService(client)
  const userRole = await campaignService.getUserRole(campaignId, userId)

  if (!userRole || !requiredRoles.includes(userRole)) {
    return false
  }

  return true
}

// GET /api/campaigns/[id]/website-resources - Get all website resources for a campaign
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const userId = await getUserIdFromRequest(request)
    if (!userId) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
    }

    const campaignId = params.id

    // Check if user has access to this campaign
    const hasAccess = await checkPermission(campaignId, userId, ["owner", "admin", "editor", "viewer"])
    if (!hasAccess) {
      return NextResponse.json({ message: "You don't have access to this campaign" }, { status: 403 })
    }

    const client = await clientPromise
    const websiteResourceService = new WebsiteResourceService(client)
    const resources = await websiteResourceService.getWebsiteResourcesByCampaign(campaignId)

    return NextResponse.json({ resources })
  } catch (error) {
    console.error("Error fetching website resources:", error)
    return NextResponse.json({ message: "Internal server error", error: error.message }, { status: 500 })
  }
}

// POST /api/campaigns/[id]/website-resources - Add a new website resource
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const userId = await getUserIdFromRequest(request)
    if (!userId) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
    }

    const campaignId = params.id

    // Check if user has permission to add website resources
    const hasPermission = await checkPermission(campaignId, userId, ["owner", "admin", "editor"])
    if (!hasPermission) {
      return NextResponse.json({ message: "You don't have permission to add website resources" }, { status: 403 })
    }

    // Handle different types of website resources
    const formData = await request.formData()
    const type = formData.get("type") as "url" | "html" | "screenshot"

    if (!type) {
      return NextResponse.json({ message: "Resource type is required" }, { status: 400 })
    }

    const client = await clientPromise
    const websiteResourceService = new WebsiteResourceService(client)

    // Get user information for the log
    const userService = new UserService(client)
    const user = await userService.findUserById(userId)
    const userName = user
      ? user.firstName && user.lastName
        ? `${user.firstName} ${user.lastName}`
        : user.email
      : "Unknown User"

    const resourceData: any = {
      campaignId,
      type,
      status: "pending",
    }

    if (type === "url") {
      const url = formData.get("url") as string
      if (!url) {
        return NextResponse.json({ message: "URL is required" }, { status: 400 })
      }

      // Store the URL
      resourceData.url = url

      // Create the resource
      const resource = await websiteResourceService.createWebsiteResource(resourceData)
      const resourceId = resource._id.toString()

      // Initialize AWS Scraper Service
      const awsScraperService = new AwsScraperService(client)
      console.log(`🔍 Initializing website resource scraping: ${resourceId}`)

      // Test AWS connectivity before queueing
      try {
        console.log("🧪 Testing AWS SQS connectivity...")
        await awsScraperService.testSQSConnection()
        console.log("✅ AWS SQS connectivity test passed")
      } catch (testError) {
        console.error("❌ AWS SQS connectivity test failed:", testError)
        // Continue with the process despite the test failure
      }

      // Update status to processing before queueing to prevent double-queueing
      await websiteResourceService.updateWebsiteResourceStatus(resourceId, "processing")

      // Now queue for processing
      try {
        await awsScraperService.queueWebsiteForScraping(resourceId)
        console.log(`✅ Website resource queued successfully: ${resourceId}`)
      } catch (error) {
        console.error(`❌ Error queueing website for scraping: ${error.message}`, error)
        // Update the resource status to reflect the error
        await websiteResourceService.updateWebsiteResourceStatus(
          resourceId,
          "error",
          `Failed to queue for scraping: ${error.message}`,
        )

        // Don't throw here to prevent application failure
      }

      // Log the website URL addition activity
      const activityLogService = new ActivityLogService(client)
      await activityLogService.createLog({
        campaignId: new ObjectId(campaignId),
        userId: new ObjectId(userId),
        userName,
        action: ActivityAction.ADD,
        entityType: EntityType.WEBSITE,
        entityId: resource._id,
        details: {
          url: url,
          type: "url",
        },
      })

      return NextResponse.json(
        {
          message: "Website URL added successfully. Scraping has been queued.",
          resource,
        },
        { status: 201 },
      )
    } else if (type === "html") {
      const file = formData.get("file") as File
      if (!file) {
        return NextResponse.json({ message: "HTML file is required" }, { status: 400 })
      }

      // Validate file type
      if (file.type !== "text/html") {
        return NextResponse.json({ message: "File must be HTML" }, { status: 400 })
      }

      // Validate file size (5MB max)
      const maxSize = 5 * 1024 * 1024 // 5MB
      if (file.size > maxSize) {
        return NextResponse.json({ message: "File too large (max 5MB)" }, { status: 400 })
      }

      // Read file content
      const content = await file.text()

      // Upload file to Vercel Blob
      const blob = await put(`campaigns/${campaignId}/website-html/${file.name}`, file, {
        access: "public",
      })

      resourceData.content = content
      resourceData.fileUrl = blob.url
      resourceData.fileKey = blob.url
      resourceData.status = "completed" // HTML uploads are considered complete immediately
    } else if (type === "screenshot") {
      const file = formData.get("file") as File
      if (!file) {
        return NextResponse.json({ message: "Screenshot file is required" }, { status: 400 })
      }

      // Validate file type
      if (!file.type.startsWith("image/")) {
        return NextResponse.json({ message: "File must be an image" }, { status: 400 })
      }

      // Validate file size (5MB max)
      const maxSize = 5 * 1024 * 1024 // 5MB
      if (file.size > maxSize) {
        return NextResponse.json({ message: "File too large (max 5MB)" }, { status: 400 })
      }

      // Upload file to Vercel Blob
      const blob = await put(`campaigns/${campaignId}/website-screenshot/${file.name}`, file, {
        access: "public",
      })

      resourceData.fileUrl = blob.url
      resourceData.fileKey = blob.url
      resourceData.status = "completed" // Screenshot uploads are considered complete immediately
    } else {
      return NextResponse.json({ message: "Invalid resource type" }, { status: 400 })
    }

    // Save resource to database (for non-URL types)
    if (type !== "url") {
      const resource = await websiteResourceService.createWebsiteResource(resourceData)

      // Log the website resource addition activity
      const activityLogService = new ActivityLogService(client)
      await activityLogService.createLog({
        campaignId: new ObjectId(campaignId),
        userId: new ObjectId(userId),
        userName,
        action: ActivityAction.UPLOAD,
        entityType: EntityType.WEBSITE,
        entityId: resource._id,
        details: {
          type: type,
          name: (formData.get("file") as File).name,
        },
      })

      return NextResponse.json(
        {
          message: "Website resource added successfully",
          resource,
        },
        { status: 201 },
      )
    }
  } catch (error) {
    console.error("Error adding website resource:", error)
    return NextResponse.json({ message: "Internal server error", error: error.message }, { status: 500 })
  }
}
