import { type NextRequest, NextResponse } from "next/server"
import clientPromise from "@/lib/mongodb"
import { CampaignService } from "@/services/campaignService"
import { verifyJWT } from "@/lib/auth"
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
  const campaignService = new CampaignService(client)
  const userRole = await campaignService.getUserRole(campaignId, userId)

  if (!userRole || !requiredRoles.includes(userRole)) {
    return false
  }

  return true
}

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const userId = await getUserIdFromRequest(request)
    if (!userId) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
    }

    const campaignId = params.id

    // Check if user has permission to add crawler configuration
    const hasPermission = await checkPermission(campaignId, userId, ["owner", "admin", "editor"])
    if (!hasPermission) {
      return NextResponse.json({ message: "You don't have permission to configure the crawler" }, { status: 403 })
    }

    const formData = await request.formData()
    const type = formData.get("type") as string

    if (!type) {
      return NextResponse.json({ message: "Type is required" }, { status: 400 })
    }

    const client = await clientPromise
    const db = client.db()

    // Create a new crawler configuration
    const crawlerConfig: any = {
      campaignId: new ObjectId(campaignId),
      createdBy: new ObjectId(userId),
      createdAt: new Date(),
      status: "pending", // pending, running, completed, failed
      type,
    }

    if (type === "url") {
      const url = formData.get("url") as string
      if (!url) {
        return NextResponse.json({ message: "URL is required" }, { status: 400 })
      }
      crawlerConfig.url = url
    } else if (type === "robots") {
      const robotsTxt = formData.get("robotsTxt") as string
      if (!robotsTxt) {
        return NextResponse.json({ message: "Robots.txt content is required" }, { status: 400 })
      }
      crawlerConfig.robotsTxt = robotsTxt
    } else if (type === "sitemap") {
      const sitemapFile = formData.get("sitemapFile") as File
      if (!sitemapFile) {
        return NextResponse.json({ message: "Sitemap file is required" }, { status: 400 })
      }

      // Read the sitemap file content
      const sitemapContent = await sitemapFile.text()
      crawlerConfig.sitemapContent = sitemapContent
    } else {
      return NextResponse.json({ message: "Invalid type" }, { status: 400 })
    }

    // Save the crawler configuration
    await db.collection("crawlerConfigs").insertOne(crawlerConfig)

    // In a real implementation, you would trigger a background job to start the crawling process
    // For now, we'll just return success

    return NextResponse.json(
      {
        message: "Crawler configuration saved successfully",
        status: "pending",
      },
      { status: 201 },
    )
  } catch (error) {
    console.error("Error setting up crawler:", error)
    return NextResponse.json({ message: "Internal server error", error: error.message }, { status: 500 })
  }
}
