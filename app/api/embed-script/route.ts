import { type NextRequest, NextResponse } from "next/server"

// Helper function to ensure URL doesn't have double slashes
function formatUrl(baseUrl: string, path: string): string {
  // Remove trailing slash from baseUrl if it exists
  const formattedBaseUrl = baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl

  // Ensure path starts with a slash
  const formattedPath = path.startsWith("/") ? path : `/${path}`

  return `${formattedBaseUrl}${formattedPath}`
}

export async function GET(request: NextRequest) {
  try {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://your-domain.com"

    // This script will be loaded by the embed code and will handle rendering the chatbot
    const scriptContent = `
  // Campaign Chatbot Script
  
  window.CampaignChatbot = {
    init: function(config) {
      try {
        // Validate required parameters
        if (!config) {
          console.warn('Campaign Chatbot: No configuration provided');
          return;
        }
        
        if (!config.campaignId) {
          console.warn('Campaign Chatbot: No campaignId provided');
          return;
        }
        
        // Find the container element
        const containerId = 'campaign-chatbot';
        const container = document.getElementById(containerId);
        
        if (!container) {
          console.warn('Campaign Chatbot: Container element not found with ID: ' + containerId);
          return;
        }
        
        // Create an iframe element
        const iframe = document.createElement('iframe');
        
        // Set iframe source with all parameters
        iframe.src = '${formatUrl(appUrl, "/embed/chatbot")}?campaignId=' + 
          encodeURIComponent(config.campaignId) + 
          '&chatColor=' + encodeURIComponent(config.chatColor || '#FF0000') + 
          '&donationUrl=' + encodeURIComponent(config.donationUrl || '') +
          '&welcomeMessage=' + encodeURIComponent(config.welcomeMessage || '') +
          '&contactEmail=' + encodeURIComponent(config.contactEmail || '') +
          '&contactPhone=' + encodeURIComponent(config.contactPhone || '') +
          '&contactAddress=' + encodeURIComponent(config.contactAddress || '') +
          '&botName=' + encodeURIComponent(config.botName || 'Campaign Chat Support') +
          '&initiallyOpen=false';
        
        // Style the iframe
        iframe.style.border = 'none';
        iframe.style.background = 'transparent';
        iframe.style.width = '100%';
        iframe.style.height = '600px';
        iframe.style.maxWidth = '400px';
        iframe.style.maxHeight = '80vh';
        iframe.style.overflow = 'visible';
        iframe.style.transition = 'all 0.3s ease';
        iframe.id = 'campaign-chatbot-iframe';
        iframe.setAttribute('allow', 'clipboard-write');
        
        // Add message listener for expand/collapse events
        window.addEventListener('message', function(event) {
          // Only accept messages from our iframe
          if (event.source !== iframe.contentWindow) return;
          
          if (event.data.type === 'resize') {
            if (event.data.expanded) {
              iframe.style.height = '100vh';
            } else {
              iframe.style.height = '600px';
            }
          }
        }, false);
        
        // Clear the container and add the iframe
        container.innerHTML = '';
        container.appendChild(iframe);
        
        console.log('Campaign Chatbot: Successfully initialized');
      } catch (error) {
        console.error('Campaign Chatbot: Error initializing', error);
      }
    }
  };
  
  // Auto-initialize if the container exists and has a campaign ID
  document.addEventListener('DOMContentLoaded', function() {
    const container = document.getElementById('campaign-chatbot');
    if (container) {
      const campaignId = container.getAttribute('data-campaign-id');
      if (campaignId) {
        window.CampaignChatbot.init({ campaignId: campaignId });
      }
    }
  });
`

    // Return the script with proper content type and debug headers
    return new NextResponse(scriptContent, {
      headers: {
        "Content-Type": "application/javascript",
        "X-Debug-App-Url": appUrl,
        "Cache-Control": "no-store, max-age=0",
        // Add CORS headers to ensure the script can be loaded from any domain
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    })
  } catch (error) {
    console.error("Error generating script:", error)
    // Return detailed error information
    return NextResponse.json(
      {
        error: "Failed to generate script",
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
