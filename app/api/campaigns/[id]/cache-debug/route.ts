import { type NextRequest, NextResponse } from "next/server"
import { getMongoClient } from "@/lib/mongodb-server"
import { ObjectId } from "mongodb"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Get user from database to check if they're a SuperAdmin
    const client = await getMongoClient()
    const db = client.db()
    const user = await db.collection("users").findOne({ email: session.user.email })

    // Allow access if user is a SuperAdmin or has access to the campaign
    const campaignId = params.id
    const isSuperAdmin = user?.isSuperAdmin === true

    if (!isSuperAdmin) {
      // Check if user has access to this campaign
      const hasAccess = await db.collection("userCampaigns").findOne({
        userId: user?._id,
        campaignId: new ObjectId(campaignId),
      })

      if (!hasAccess) {
        return NextResponse.json({ error: "Unauthorized access to this campaign" }, { status: 403 })
      }
    }

    const url = request.nextUrl.searchParams.get("url")

    if (!url) {
      return NextResponse.json({ error: "URL parameter is required" }, { status: 400 })
    }

    // Get the cached page content
    const cachedPage = await db.collection("pageCache").findOne({ url })

    if (!cachedPage) {
      return NextResponse.json({ message: "No cached content found for this URL" }, { status: 404 })
    }

    return NextResponse.json({
      url: cachedPage.url,
      contentLength: cachedPage.content?.length || 0,
      contentPreview: cachedPage.content?.substring(0, 1000) || "",
      fullContent: cachedPage.content || "",
      fetchedAt: cachedPage.fetchedAt,
      expiresAt: cachedPage.expiresAt,
    })
  } catch (error) {
    console.error("Error in cache debug route:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Get user from database to check if they're a SuperAdmin
    const client = await getMongoClient()
    const db = client.db()
    const user = await db.collection("users").findOne({ email: session.user.email })

    // Allow access if user is a SuperAdmin or has access to the campaign
    const campaignId = params.id
    const isSuperAdmin = user?.isSuperAdmin === true

    if (!isSuperAdmin) {
      // Check if user has access to this campaign
      const hasAccess = await db.collection("userCampaigns").findOne({
        userId: user?._id,
        campaignId: new ObjectId(campaignId),
      })

      if (!hasAccess) {
        return NextResponse.json({ error: "Unauthorized access to this campaign" }, { status: 403 })
      }
    }

    const url = request.nextUrl.searchParams.get("url")

    if (!url) {
      return NextResponse.json({ error: "URL parameter is required" }, { status: 400 })
    }

    // Delete the cached page
    const result = await db.collection("pageCache").deleteOne({ url })

    if (result.deletedCount === 0) {
      return NextResponse.json({ message: "No cached content found to delete" }, { status: 404 })
    }

    return NextResponse.json({
      message: "Cache entry deleted successfully",
      url,
    })
  } catch (error) {
    console.error("Error in cache debug route:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
