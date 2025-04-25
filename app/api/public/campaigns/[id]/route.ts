import { type NextRequest, NextResponse } from "next/server"
import clientPromise from "@/lib/mongodb"
import { ObjectId } from "mongodb"

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const campaignId = params.id

    // Validate that the campaign ID is in the correct format for MongoDB ObjectId
    if (!campaignId || !/^[0-9a-fA-F]{24}$/.test(campaignId)) {
      console.log(`Invalid campaign ID format: ${campaignId}`)
      return NextResponse.json({ error: "Invalid campaign ID format" }, { status: 400 })
    }

    const client = await clientPromise
    const db = client.db()

    // Fetch the campaign
    const campaign = await db.collection("campaigns").findOne({
      _id: new ObjectId(campaignId),
      isActive: { $ne: false }, // Only return active campaigns
    })

    if (!campaign) {
      console.log(`Campaign not found or inactive: ${campaignId}`)
      return NextResponse.json({ error: "Campaign not found or inactive" }, { status: 404 })
    }

    // Return only the necessary fields for the chatbot
    return NextResponse.json({
      campaign: {
        _id: campaign._id,
        name: campaign.name,
        chatColor: campaign.chatColor || "#FF0000",
        accentColor: campaign.accentColor || "#192745",
        chatWelcomeMessage:
          campaign.chatWelcomeMessage || "Hello! Welcome to our organization portal. How can I assist you today?",
        donationUrl: campaign.donationUrl,
        contactEmail: campaign.contactEmail || "",
        contactPhone: campaign.contactPhone || "",
        contactAddress: campaign.contactAddress || "",
        chatBotName: campaign.chatBotName || "Campaign Chat Support",
        botTextColor: campaign.botTextColor || "#FFFFFF",
        chatBotIcon: campaign.chatBotIcon || "",
        enableDropShadow: campaign.enableDropShadow || false,
        headerTextColor: campaign.headerTextColor || "#FFFFFF",
        actionButtons: campaign.actionButtons, // Add this line to include action buttons
      },
    })
  } catch (error) {
    console.error("Error fetching campaign:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
