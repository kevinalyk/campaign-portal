import type { MongoClient } from "mongodb"
import { getMongoClient } from "@/lib/mongodb-server"

export async function addRateLimitFieldToCampaigns() {
  let client: MongoClient | null = null

  try {
    client = await getMongoClient()
    const db = client.db()

    // Find all campaigns that don't have the chatRateLimitEnabled field
    const campaigns = await db
      .collection("campaigns")
      .find({
        chatRateLimitEnabled: { $exists: false },
      })
      .toArray()

    console.log(`Found ${campaigns.length} campaigns that need the chatRateLimitEnabled field`)

    if (campaigns.length === 0) {
      return {
        success: true,
        message: "No campaigns needed updating",
        updated: 0,
        total: 0,
      }
    }

    // Update all campaigns to add the field with default value true
    const result = await db
      .collection("campaigns")
      .updateMany({ chatRateLimitEnabled: { $exists: false } }, { $set: { chatRateLimitEnabled: true } })

    console.log(`Updated ${result.modifiedCount} campaigns`)

    return {
      success: true,
      message: `Successfully added chatRateLimitEnabled field to ${result.modifiedCount} campaigns`,
      updated: result.modifiedCount,
      total: campaigns.length,
    }
  } catch (error) {
    console.error("Error adding rate limit field to campaigns:", error)
    return {
      success: false,
      message: `Error: ${error.message || "Unknown error"}`,
      error: error.message,
      updated: 0,
      total: 0,
    }
  }
}
