import { type NextRequest, NextResponse } from "next/server"
import clientPromise from "@/lib/mongodb"
import { ObjectId } from "mongodb"
import { verifyJWT, checkPermission } from "@/lib/auth"

// PATCH /api/campaigns/[id]/chat-settings - Update only chat settings
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  console.log("API ENDPOINT CALLED: /api/campaigns/[id]/chat-settings")

  try {
    // Get the authorization token
    const token = request.headers.get("Authorization")?.replace("Bearer ", "")
    if (!token) {
      console.log("NO AUTH TOKEN PROVIDED")
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
    }

    // Verify the token and get the user ID
    let userId
    try {
      const payload = await verifyJWT(token)
      userId = payload.userId
      console.log("USER ID FROM TOKEN:", userId)
    } catch (error) {
      console.error("TOKEN VERIFICATION FAILED:", error)
      return NextResponse.json({ message: "Invalid token" }, { status: 401 })
    }

    const campaignId = params.id
    console.log("CAMPAIGN ID:", campaignId)

    // Check if user has permission to edit this campaign
    try {
      const hasPermission = await checkPermission(campaignId, userId, ["owner", "admin", "editor"])
      if (!hasPermission) {
        console.log("USER DOES NOT HAVE PERMISSION")
        return NextResponse.json({ message: "You don't have permission to edit this campaign" }, { status: 403 })
      }
    } catch (error) {
      console.error("PERMISSION CHECK FAILED:", error)
      return NextResponse.json({ message: "Error checking permissions" }, { status: 500 })
    }

    // Parse the request body
    let body
    try {
      const text = await request.text()
      console.log("REQUEST BODY LENGTH:", text.length)
      body = JSON.parse(text)

      // Log the keys in the body
      console.log("BODY KEYS:", Object.keys(body))

      // Log the icon length if present
      if (body.chatBotIcon) {
        console.log("ICON DATA LENGTH:", body.chatBotIcon.length)
        console.log("ICON DATA PREFIX:", body.chatBotIcon.substring(0, 30))
      }
    } catch (error) {
      console.error("BODY PARSING FAILED:", error)
      return NextResponse.json({ message: "Invalid request body" }, { status: 400 })
    }

    // Create the update data object
    const updateData: Record<string, any> = {}

    // Only include fields that are present in the request
    if (body.chatColor !== undefined) updateData.chatColor = body.chatColor
    if (body.accentColor !== undefined) updateData.accentColor = body.accentColor
    if (body.chatWelcomeMessage !== undefined) updateData.chatWelcomeMessage = body.chatWelcomeMessage
    if (body.chatBotName !== undefined) updateData.chatBotName = body.chatBotName
    if (body.chatBotIcon !== undefined) updateData.chatBotIcon = body.chatBotIcon
    if (body.enableDropShadow !== undefined) updateData.enableDropShadow = body.enableDropShadow
    if (body.headerTextColor !== undefined) updateData.headerTextColor = body.headerTextColor
    if (body.actionButtons !== undefined) updateData.actionButtons = body.actionButtons

    console.log("UPDATE DATA KEYS:", Object.keys(updateData))

    // Connect to MongoDB
    let client
    try {
      client = await clientPromise
      console.log("MONGODB CONNECTION ESTABLISHED")
    } catch (error) {
      console.error("MONGODB CONNECTION FAILED:", error)
      return NextResponse.json({ message: "Database connection failed" }, { status: 500 })
    }

    // Update the campaign
    try {
      const db = client.db()
      const result = await db.collection("campaigns").updateOne({ _id: new ObjectId(campaignId) }, { $set: updateData })

      console.log("UPDATE RESULT:", {
        matchedCount: result.matchedCount,
        modifiedCount: result.modifiedCount,
        acknowledged: result.acknowledged,
      })

      if (result.matchedCount === 0) {
        console.log("CAMPAIGN NOT FOUND")
        return NextResponse.json({ message: "Campaign not found" }, { status: 404 })
      }

      if (result.modifiedCount === 0) {
        console.log("NO CHANGES MADE")
      }
    } catch (error) {
      console.error("DATABASE UPDATE FAILED:", error)
      return NextResponse.json({ message: "Database update failed" }, { status: 500 })
    }

    // Fetch the updated campaign
    let updatedCampaign
    try {
      const db = client.db()
      updatedCampaign = await db.collection("campaigns").findOne({ _id: new ObjectId(campaignId) })

      if (!updatedCampaign) {
        console.log("FAILED TO RETRIEVE UPDATED CAMPAIGN")
        return NextResponse.json({ message: "Failed to retrieve updated campaign" }, { status: 500 })
      }

      console.log("UPDATED CAMPAIGN RETRIEVED")

      // Log the icon length if present in the updated campaign
      if (updatedCampaign.chatBotIcon) {
        console.log("UPDATED ICON LENGTH:", updatedCampaign.chatBotIcon.length)
      }
    } catch (error) {
      console.error("RETRIEVING UPDATED CAMPAIGN FAILED:", error)
      return NextResponse.json({ message: "Failed to retrieve updated campaign" }, { status: 500 })
    }

    // Return the updated chat settings
    return NextResponse.json({
      message: "Chat settings updated successfully",
      chatSettings: {
        chatColor: updatedCampaign.chatColor,
        accentColor: updatedCampaign.accentColor,
        chatWelcomeMessage: updatedCampaign.chatWelcomeMessage,
        chatBotName: updatedCampaign.chatBotName,
        chatBotIcon: updatedCampaign.chatBotIcon,
        enableDropShadow: updatedCampaign.enableDropShadow,
        headerTextColor: updatedCampaign.headerTextColor,
        actionButtons: updatedCampaign.actionButtons,
      },
    })
  } catch (error) {
    console.error("UNHANDLED ERROR:", error)
    return NextResponse.json({ message: "Internal server error", error: String(error) }, { status: 500 })
  }
}
