import { type NextRequest, NextResponse } from "next/server"
import clientPromise from "@/lib/mongodb"
import { verifyJWT } from "@/lib/auth"
import { CampaignService } from "@/services/campaignService"
import { UserService } from "@/services/userService"

export async function GET(request: NextRequest) {
  try {
    // Get user ID from token
    const token = request.headers.get("Authorization")?.replace("Bearer ", "")
    if (!token) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
    }

    let payload
    try {
      payload = await verifyJWT(token)
    } catch (error) {
      return NextResponse.json({ message: "Invalid token" }, { status: 401 })
    }

    const userId = payload.userId

    // Connect to database
    const client = await clientPromise
    const userService = new UserService(client)
    const campaignService = new CampaignService(client)

    // Get user to check if super admin
    const user = await userService.findUserById(userId)
    if (!user) {
      return NextResponse.json({ message: "User not found" }, { status: 404 })
    }

    let organizations = []

    if (user.isSuperAdmin) {
      // Super admins can see all organizations
      organizations = await campaignService.getAllCampaigns()
    } else {
      // Regular users only see organizations they belong to
      organizations = await campaignService.getCampaignsByUserId(userId)
    }

    return NextResponse.json({
      organizations: organizations.map((org) => ({
        _id: org._id,
        name: org.name,
        logoUrl: org.logoUrl,
        role: org.role, // If returned from getCampaignsByUserId
        url: org.url, // Add the URL field to the response
      })),
    })
  } catch (error) {
    console.error("Error fetching user organizations:", error)
    return NextResponse.json({ message: "Internal server error", error: error.message }, { status: 500 })
  }
}
