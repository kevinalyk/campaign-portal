import { type NextRequest, NextResponse } from "next/server"
import clientPromise from "@/lib/mongodb"
import { CampaignService } from "@/services/campaignService"

// Helper function to ensure URL doesn't have double slashes
function formatUrl(baseUrl: string, path: string): string {
  // Remove trailing slash from baseUrl if it exists
  const formattedBaseUrl = baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl

  // Ensure path starts with a slash
  const formattedPath = path.startsWith("/") ? path : `/${path}`

  return `${formattedBaseUrl}${formattedPath}`
}

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    // Get campaign ID from URL
    const campaignId = params.id

    // Validate that the campaign ID is in the correct format for MongoDB ObjectId
    if (!campaignId) {
      return NextResponse.json({ error: "Campaign ID is required" }, { status: 400 })
    }

    if (!/^[0-9a-fA-F]{24}$/.test(campaignId)) {
      return NextResponse.json(
        {
          error: "Invalid campaign ID format",
          details: "Campaign ID must be a 24-character hex string",
          providedId: campaignId,
        },
        { status: 400 },
      )
    }

    // Fetch campaign details from database
    const client = await clientPromise
    const campaignService = new CampaignService(client)

    const campaign = await campaignService.getCampaign(campaignId)

    if (!campaign) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 })
    }

    // Generate the script content
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://your-domain.com"
    // Use the new script path
    const scriptUrl = formatUrl(appUrl, "/api/embed-script")

    const scriptContent = `
// Campaign Chatbot Embed Script
(function() {
  try {
    // Create container for the chatbot
    const container = document.createElement('div');
    container.id = 'campaign-chatbot-container';
    container.style.position = 'fixed';
    container.style.zIndex = '9999';
    container.style.bottom = '10px'; // Add 20px margin from bottom
    container.style.right = '10px';  // Add 20px margin from right
    container.style.width = '350px';
    container.style.height = '600px';
    container.style.maxHeight = '80vh';
    container.style.background = 'transparent';
    container.style.border = 'none';
    container.style.boxShadow = 'none';
    container.style.padding = '0';
    container.style.margin = '0';
    container.style.overflow = 'visible';
    document.body.appendChild(container);
    
    // Load the chatbot script
    const script = document.createElement('script');
    script.src = '${scriptUrl}';
    script.async = true;
    script.onerror = function(error) {
      // Failed to load script
    };
    script.onload = function() {
      // Initialize the chatbot with campaign settings
      if (window.CampaignChatbot) {
        window.CampaignChatbot.init({
          campaignId: '${campaign._id}',
          chatColor: '${campaign.chatColor || "#FF0000"}',
          donationUrl: '${campaign.donationUrl}',
          welcomeMessage: '${campaign.chatWelcomeMessage || "Hello! Welcome to our campaign portal. How can I assist you today?"}',
          contactEmail: '${campaign.contactEmail || ""}',
          contactPhone: '${campaign.contactPhone || ""}',
          contactAddress: '${campaign.contactAddress || ""}',
          botName: '${campaign.chatBotName || "Campaign Chat Support"}'
        });
      } else {
        // CampaignChatbot object not found on window
      }
    };
    document.head.appendChild(script);
  } catch (error) {
    // Error in embed script
  }
})();
`

    return new NextResponse(scriptContent, {
      headers: {
        "Content-Type": "application/javascript",
        "X-Debug-Campaign-Id": campaignId,
        "X-Debug-App-Url": appUrl,
        "Cache-Control": "no-store, max-age=0",
        // Add CORS headers to ensure the script can be loaded from any domain
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    })
  } catch (error) {
    // Return detailed error information
    return NextResponse.json(
      {
        error: "Failed to generate embed script",
        details: error.message,
        stack: process.env.NODE_ENV === "development" ? error.stack : undefined,
      },
      {
        status: 500,
        headers: {
          "X-Debug-Error": "true",
          "Cache-Control": "no-store, max-age=0",
          "Access-Control-Allow-Origin": "*",
        },
      },
    )
  }
}
