import { type NextRequest, NextResponse } from "next/server"
import clientPromise from "@/lib/mongodb"
import { verifyJWT, checkPermission } from "@/lib/auth"
import { AwsScraperService } from "@/services/awsScraperService"
import { WebsiteResourceService } from "@/services/websiteResourceService"

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

// GET /api/campaigns/[id]/website-resources/[resourceId]/status - Get the status of a website resource
export async function GET(request: NextRequest, { params }: { params: { id: string; resourceId: string } }) {
  try {
    const userId = await getUserIdFromRequest(request)
    if (!userId) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
    }

    const campaignId = params.id
    const resourceId = params.resourceId

    // Check if user has access to this campaign
    const hasAccess = await checkPermission(campaignId, userId, ["owner", "admin", "editor", "viewer"])
    if (!hasAccess) {
      return NextResponse.json({ message: "You don't have access to this campaign" }, { status: 403 })
    }

    const client = await clientPromise
    const awsScraperService = new AwsScraperService(client)
    const status = await awsScraperService.checkScrapingStatus(resourceId)

    return NextResponse.json({ status })
  } catch (error) {
    console.error("Error checking website resource status:", error)
    return NextResponse.json({ message: "Internal server error", error: error.message }, { status: 500 })
  }
}

// POST /api/campaigns/[id]/website-resources/[resourceId]/status - Trigger re-indexing of a website resource
export async function POST(request: NextRequest, { params }: { params: { id: string; resourceId: string } }) {
  console.log("🔍 POST request received to re-index website resource:", params.resourceId)

  try {
    const userId = await getUserIdFromRequest(request)
    if (!userId) {
      console.log("❌ Authentication failed: No valid user ID found in token")
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
    }
    console.log("✅ User authenticated:", userId)

    const { id: campaignId, resourceId } = params

    // Check if user has permission to re-index website resources
    const hasPermission = await checkPermission(campaignId, userId, ["owner", "admin"])
    if (!hasPermission) {
      console.log("❌ Permission denied: User does not have required role")
      return NextResponse.json({ message: "You don't have permission to re-index website resources" }, { status: 403 })
    }

    console.log("🔄 Initializing AWS SQS connection test...")

    const client = await clientPromise
    console.log("✅ MongoDB connection established")

    const awsScraperService = new AwsScraperService(client)
    console.log("✅ AWS Scraper Service initialized")

    const websiteResourceService = new WebsiteResourceService(client)

    // Test AWS connectivity before queueing
    try {
      console.log("🧪 Testing AWS SQS connectivity...")
      await awsScraperService.testSQSConnection()
      console.log("✅ AWS SQS connectivity test passed")
    } catch (testError) {
      console.error("❌ AWS SQS connectivity test failed:", testError)
      // Continue with the process despite the test failure
    }

    // Queue the website for re-scraping with debouncing
    console.log("📋 Queueing website resource for scraping:", resourceId)

    // First check if this resource is already being processed
    const resource = await websiteResourceService.getWebsiteResource(resourceId)
    if (!resource) {
      return NextResponse.json({ message: "Resource not found" }, { status: 404 })
    }

    // If the resource is already processing, don't queue it again
    if (resource.status === "processing") {
      console.log("⚠️ Resource is already being processed, skipping re-queue")
      return NextResponse.json({
        message: "Website is already being processed",
        status: resource.status,
      })
    }

    // Update status to processing before queueing to prevent double-queueing
    await websiteResourceService.updateWebsiteResourceStatus(resourceId, "processing")

    // Now queue for processing
    await awsScraperService.queueWebsiteForScraping(resourceId)
    console.log("✅ Website resource queued successfully")

    return NextResponse.json({ message: "Website re-indexing has been queued" })
  } catch (error) {
    console.error("❌ Error triggering website re-indexing:", error)
    return NextResponse.json({ message: "Internal server error", error: error.message }, { status: 500 })
  }
}
