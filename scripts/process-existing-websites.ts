import { MongoClient } from "mongodb"
import { WebsiteResourceService } from "../services/websiteResourceService"
import { HybridCrawlerService } from "../services/hybridCrawlerService"

// This script adds website resources for all campaigns that have a websiteUrl but no corresponding website resource

async function processExistingWebsites() {
  console.log("Processing existing websites...")

  // Connect to MongoDB
  const mongoUri = process.env.MONGODB_URI
  if (!mongoUri) {
    console.error("MONGODB_URI environment variable is not set")
    throw new Error("MONGODB_URI environment variable is not set")
  }

  const client = new MongoClient(mongoUri)

  try {
    await client.connect()
    console.log("Connected to MongoDB")

    const db = client.db()
    const websiteResourceService = new WebsiteResourceService(client)
    // Pass the MongoDB client to the HybridCrawlerService
    const crawlerService = new HybridCrawlerService(client)

    // Get all campaigns with a websiteUrl
    const campaigns = await db
      .collection("campaigns")
      .find({ websiteUrl: { $exists: true, $ne: "" } })
      .toArray()
    console.log(`Found ${campaigns.length} campaigns with website URLs`)

    const results = {
      total: campaigns.length,
      processed: 0,
      skipped: 0,
      errors: 0,
      details: [],
    }

    for (const campaign of campaigns) {
      console.log(`Processing campaign: ${campaign.name} (${campaign._id})`)

      try {
        // Check if this campaign already has a website resource for the main URL
        const resources = await websiteResourceService.getWebsiteResourcesByCampaign(campaign._id.toString())
        const mainUrlResource = resources.find((r) => r.url === campaign.websiteUrl)

        if (mainUrlResource) {
          console.log(`Campaign already has a website resource for ${campaign.websiteUrl}`)
          results.skipped++
          results.details.push({
            campaignId: campaign._id.toString(),
            campaignName: campaign.name,
            url: campaign.websiteUrl,
            status: "skipped",
            reason: "Resource already exists",
          })
        } else if (campaign.websiteUrl) {
          console.log(`Adding website resource for ${campaign.websiteUrl}`)

          // Add the website resource
          const resource = await websiteResourceService.createWebsiteResource({
            campaignId: campaign._id.toString(),
            type: "url",
            url: campaign.websiteUrl,
          })

          // Start crawling the website
          console.log(`Starting crawler for ${campaign.websiteUrl}`)
          try {
            await crawlerService.startCrawling(resource._id.toString())
            console.log(`Crawler started for ${campaign.websiteUrl}`)

            results.processed++
            results.details.push({
              campaignId: campaign._id.toString(),
              campaignName: campaign.name,
              url: campaign.websiteUrl,
              status: "processed",
              resourceId: resource._id.toString(),
            })
          } catch (error) {
            console.error(`Error starting crawler for ${campaign.websiteUrl}:`, error)
            results.errors++
            results.details.push({
              campaignId: campaign._id.toString(),
              campaignName: campaign.name,
              url: campaign.websiteUrl,
              status: "error",
              error: error.message || "Error starting crawler",
            })
          }
        }
      } catch (error) {
        console.error(`Error processing campaign ${campaign.name}:`, error)
        results.errors++
        results.details.push({
          campaignId: campaign._id.toString(),
          campaignName: campaign.name,
          url: campaign.websiteUrl || "N/A",
          status: "error",
          error: error.message || "Unknown error",
        })
      }
    }

    console.log("Finished processing existing websites")
    console.log(
      `Summary: Total: ${results.total}, Processed: ${results.processed}, Skipped: ${results.skipped}, Errors: ${results.errors}`,
    )

    return results
  } catch (error) {
    console.error("Error processing existing websites:", error)
    throw error
  } finally {
    await client.close()
    console.log("Disconnected from MongoDB")
  }
}

// Run the script if executed directly
if (require.main === module) {
  processExistingWebsites()
    .then((results) => {
      console.log("Results:", JSON.stringify(results, null, 2))
      process.exit(0)
    })
    .catch((error) => {
      console.error("Error:", error)
      process.exit(1)
    })
}

export { processExistingWebsites }
