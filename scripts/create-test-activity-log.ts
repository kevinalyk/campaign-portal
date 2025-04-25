import { MongoClient } from "mongodb"
import dotenv from "dotenv"

dotenv.config()

async function createTestLog() {
  const uri = process.env.MONGODB_URI
  if (!uri) {
    console.error("MONGODB_URI environment variable is not set")
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
      // Collection doesn't exist, create it
      await db.createCollection("activityLogs")
      console.log("Created activityLogs collection")
    }

    // Get a campaign ID to use
    const campaigns = await db.collection("campaigns").find({}).limit(1).toArray()
    if (campaigns.length === 0) {
      console.error("No campaigns found in the database")
      process.exit(1)
    }

    const campaignId = campaigns[0]._id
    console.log("Using campaign ID:", campaignId)

    // Get a user ID to use
    const users = await db.collection("users").find({}).limit(1).toArray()
    if (users.length === 0) {
      console.error("No users found in the database")
      process.exit(1)
    }

    const userId = users[0]._id
    const userName = users[0].email || "Test User"
    console.log("Using user ID:", userId)

    // Create a test log
    const log = {
      campaignId: campaignId,
      userId: userId,
      userName: userName,
      action: "create",
      entityType: "test",
      details: {
        name: "Test Log",
        description: "This is a test log created directly via script",
      },
      timestamp: new Date(),
    }

    const result = await db.collection("activityLogs").insertOne(log)
    console.log("Created test log with ID:", result.insertedId)

    // Verify the log was created
    const createdLog = await db.collection("activityLogs").findOne({ _id: result.insertedId })
    console.log("Created log:", createdLog)

    // Count logs for this campaign
    const count = await db.collection("activityLogs").countDocuments({ campaignId })
    console.log(`Total logs for campaign ${campaignId}: ${count}`)
  } catch (error) {
    console.error("Error creating test log:", error)
  } finally {
    await client.close()
    console.log("Disconnected from MongoDB")
  }
}

createTestLog().catch(console.error)
