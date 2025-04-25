import { generateText } from "ai"
import { openai } from "@ai-sdk/openai"
import { WebsiteResourceService } from "@/services/websiteResourceService"
import { DocumentService } from "@/services/documentService"
import type { MongoClient } from "mongodb"
import { DocumentProcessingService } from "@/services/documentProcessingService"
import type { Campaign } from "@/models/Campaign"
import { ObjectId as ObjectIdClass } from "mongodb"
import { HybridCrawlerService } from "@/services/hybridCrawlerService"

interface WebsiteSource {
  url: string
  content: string
}

export class AIService {
  private client: MongoClient
  private websiteResourceService: WebsiteResourceService
  private documentService: DocumentService
  // Maximum context length to prevent timeouts
  private MAX_CONTEXT_LENGTH = 8000

  constructor(client: MongoClient) {
    this.client = client
    this.websiteResourceService = new WebsiteResourceService(client)
    this.documentService = new DocumentService(client)
  }

  async generateResponse(campaignId: string, query: string | any): Promise<string> {
    try {
      // Handle both string and message object formats
      let userQuery: string
      if (typeof query === "string") {
        userQuery = query
      } else if (Array.isArray(query) && query.length > 0) {
        // If it's an array of messages, get the last one
        const lastMessage = query[query.length - 1]
        userQuery = lastMessage.content || ""
      } else if (query && typeof query === "object" && query.content) {
        // If it's a single message object
        userQuery = query.content
      } else {
        console.error("Invalid query format:", query)
        throw new Error("Invalid query format")
      }

      // Get campaign data to retrieve assistant identity
      const campaign = await this.getCampaignData(campaignId)

      // Retrieve campaign-specific content for context
      const { contextContent, websiteSources } = await this.retrieveContext(campaignId, userQuery)

      // Log the context content for debugging
      console.log("Context content length:", contextContent.length)
      console.log("Context content preview:", contextContent.substring(0, 200) + "...")

      // Generate system prompt with context
      const systemPrompt = this.createSystemPrompt(contextContent, campaign?.assistantIdentity, websiteSources)

      // Generate response using AI SDK with timeout handling
      try {
        const { text } = await Promise.race([
          generateText({
            model: openai("gpt-4o"),
            prompt: userQuery,
            system: systemPrompt,
            maxTokens: 500,
            temperature: 0.7, // Adding temperature for more reliable responses
          }),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error("AI response generation timed out")), 25000),
          ),
        ])

        return text
      } catch (error) {
        console.error("Error in AI response generation:", error)
        if (error.message.includes("timed out")) {
          return "I'm sorry, it's taking me longer than expected to process your request. Could you try asking your question again, perhaps with more specific details?"
        }
        throw error
      }
    } catch (error) {
      console.error("Error generating AI response:", error)
      return "I'm sorry, I encountered an error while processing your request. Please try again later."
    }
  }

  private async getCampaignData(campaignId: string): Promise<Campaign | null> {
    try {
      const campaign = await this.client
        .db()
        .collection("campaigns")
        .findOne({ _id: new ObjectIdClass(campaignId) })

      console.log("Retrieved campaign data:", {
        id: campaignId,
        hasAssistantIdentity: !!campaign?.assistantIdentity,
        assistantIdentity: campaign?.assistantIdentity,
      })

      return campaign
    } catch (error) {
      console.error("Error fetching campaign data:", error)
      return null
    }
  }

  private formatAddress(campaign: Campaign): string {
    if (!campaign) return ""

    // Check if we have the new format fields
    if (campaign.addressStreet || campaign.addressCity || campaign.addressState || campaign.addressZip) {
      const parts = [
        campaign.addressStreet,
        campaign.addressCity,
        campaign.addressState && campaign.addressZip
          ? `${campaign.addressState} ${campaign.addressZip}`
          : campaign.addressState || campaign.addressZip,
      ].filter(Boolean)

      return parts.join(", ")
    }

    // Fall back to the old format if available
    return campaign.contactAddress || ""
  }

  private async retrieveContext(
    campaignId: string,
    query: string,
  ): Promise<{ contextContent: string; websiteSources: WebsiteSource[] }> {
    let contextContent = ""
    const websiteSources: WebsiteSource[] = []

    try {
      // Retrieve website content
      const hybridCrawlerService = new HybridCrawlerService(this.client)
      const websiteContentResult = await hybridCrawlerService.getRelevantContent(campaignId, query, true)

      if (websiteContentResult && websiteContentResult.content) {
        // Log the retrieved website content for debugging
        console.log("Retrieved website content length:", websiteContentResult.content.length)
        console.log("Website content preview:", websiteContentResult.content.substring(0, 200) + "...")

        // Format website content for better AI consumption
        contextContent += `WEBSITE CONTENT:\n\n`

        // Store website sources for citation and better content organization
        if (websiteContentResult.sources && websiteContentResult.sources.length > 0) {
          console.log(`Found ${websiteContentResult.sources.length} website sources`)

          // Process each source and add it to the context with clear section headers
          // Limit to top 3 most relevant sources to prevent context overflow
          const topSources = websiteContentResult.sources.slice(0, 3)

          topSources.forEach((source, index) => {
            console.log(`Source ${index + 1}: ${source.url} (snippet length: ${source.snippet?.length || 0})`)

            // Extract page title from URL if not available
            const urlParts = source.url.split("/")
            const pageName = urlParts[urlParts.length - 2] || "Page"
            const formattedPageName = pageName.replace(/-/g, " ").replace(/^\w/, (c) => c.toUpperCase())

            // Add source to context with clear formatting
            // Limit snippet size to prevent context overflow
            const limitedSnippet = source.snippet ? source.snippet.substring(0, 1000) : ""

            contextContent += `--- ${formattedPageName} Information ---\n`
            contextContent += `${limitedSnippet}\n\n`
            contextContent += `Source: ${source.url}\n\n`

            websiteSources.push({
              url: source.url,
              content: limitedSnippet,
            })
          })
        } else {
          // If no sources but we have content, add it directly (with length limit)
          const limitedContent = websiteContentResult.content.substring(0, 2000)
          contextContent += limitedContent + "\n\n"
        }
      } else {
        console.log("No website content retrieved")
      }

      // Get relevant document content - only use this for now
      const documentProcessingService = new DocumentProcessingService(this.client)
      const documentContent = await documentProcessingService.getRelevantDocumentContent(campaignId, query)

      if (documentContent) {
        console.log("Retrieved document content length:", documentContent.length)
        // Limit document content size
        const limitedDocContent = documentContent.substring(0, 2000)
        contextContent += `DOCUMENT CONTENT:\n${limitedDocContent}\n\n`
      } else {
        console.log("No document content retrieved")
      }

      // Add contact information if available
      const campaign = await this.getCampaignData(campaignId)
      if (campaign) {
        const formattedAddress = this.formatAddress(campaign)

        contextContent += `CONTACT INFORMATION:\n`
        if (campaign.contactEmail) {
          contextContent += `Email: ${campaign.contactEmail}\n`
        }
        if (campaign.contactPhone) {
          contextContent += `Phone: ${campaign.contactPhone}\n`
        }
        if (formattedAddress) {
          contextContent += `Address: ${formattedAddress}\n`
        }
        contextContent += `\n`
      }

      // Ensure context doesn't exceed maximum length
      if (contextContent.length > this.MAX_CONTEXT_LENGTH) {
        console.log(`Context exceeds max length (${contextContent.length}), truncating...`)
        contextContent = contextContent.substring(0, this.MAX_CONTEXT_LENGTH)
      }
    } catch (error) {
      console.error("Error retrieving context:", error)
    }

    return { contextContent, websiteSources }
  }

  private createSystemPrompt(context: string, assistantIdentity?: string, websiteSources?: WebsiteSource[]): string {
    console.log("Creating system prompt with assistantIdentity:", assistantIdentity)

    const identityText = assistantIdentity
      ? `When asked about your identity, say you are "${assistantIdentity}".`
      : `When asked about your identity, say you're the AI assistant for the organization, trained to provide information about their positions and initiatives.`

    console.log("Identity instruction:", identityText)

    // Add debugging information to check if context is being included
    console.log("System prompt context length:", context.length)

    return `You are a helpful assistant for an organization. 
Use ONLY the following information to answer user questions:

${context}

IMPORTANT GUIDELINES:

1. NEVER identify yourself as an AI unless directly asked who you are or what you are.
2. ${identityText}
3. ALWAYS provide direct answers using the specific information in the context above.
4. When answering questions, extract and present the relevant information directly rather than just referring to sources.
5. Include specific details, names, and facts from the context in your responses.
6. ONLY after providing a direct answer, you may mention the source URL as additional information.
7. Format URLs as clickable links using HTML anchor tags with blue styling and opening in a new tab: <a href="URL" style="color: #0066cc; text-decoration: underline;" target="_blank" rel="noopener noreferrer">text</a>
8. Example of a good response format:
   "Wisconsin GOP elected officials include Senator Ron Johnson, Congressman Bryan Steil, and others. In the State Senate, we have members like André Jacque (District 1) and Eric Wimberger (District 2). You can find more information on our website at <a href="https://wisgop.org/elected-officials/" style="color: #0066cc; text-decoration: underline;" target="_blank" rel="noopener noreferrer">Elected Officials</a>."
9. If you don't have enough information to answer a question based on the provided context:
   - Acknowledge the question
   - State that you don't have specific information on that topic
   - Suggest contacting the organization directly for more information
   - DO NOT suggest visiting the website (users are already there)
10. Always be polite, helpful, and politically neutral in your responses.
11. For questions about donations or volunteering, provide the information if available in the context.
12. Speak as a representative of the organization, using "we" and "our" when referring to positions and initiatives.
13. Keep your responses concise and to the point.`
  }
}

export default AIService
