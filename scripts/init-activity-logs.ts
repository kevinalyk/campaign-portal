import { MongoClient } from "mongodb"
import { config } from "dotenv"

// Load environment variables
config()

async function initActivityLogs() {
  const uri = process.env.MONGODB_URI
  if (!uri) {
    console.error("MONGODB_URI is not defined in environment variables")
    process.exit(1)
  }

  const client = new MongoClient(uri)

  try {
    await client.connect()
    console.log("Connected to MongoDB")

    const db = client.db()

    // Check if activityLogs collection exists
    const collections = await db.listCollections({ name: "activityLogs" }).toArray()

    if (collections.length === 0) {
      // Create activityLogs collection
      await db.createCollection("activityLogs")
      console.log("Created activityLogs collection")

      // Create indexes for better query performance
      await db.collection("activityLogs").createIndex({ campaignId: 1, timestamp: -1 })
      await db.collection("activityLogs").createIndex({ userId: 1, timestamp: -1 })
      await db.collection("activityLogs").createIndex({ entityType: 1, timestamp: -1 })

      console.log("Created indexes for activityLogs collection")
    } else {
      console.log("activityLogs collection already exists")
    }

    console.log("Activity logs initialization complete")
  } catch (error) {
    console.error("Error initializing activity logs:", error)
  } finally {
    await client.close()
    console.log("Disconnected from MongoDB")
  }
}

// Run the initialization
initActivityLogs().catch(console.error)
