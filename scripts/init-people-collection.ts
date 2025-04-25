import { ObjectId } from "mongodb"
import clientPromise from "@/lib/mongodb"

async function initPeopleCollection() {
  try {
    console.log("Connecting to MongoDB...")
    const client = await clientPromise
    const db = client.db()

    // Check if people collection exists
    const collections = await db.listCollections({ name: "people" }).toArray()
    if (collections.length === 0) {
      console.log("Creating people collection...")
      await db.createCollection("people")
      console.log("People collection created successfully")
    } else {
      console.log("People collection already exists")
    }

    // Add a test person
    const testPerson = {
      campaignId: new ObjectId("65c7e5c5e5c5e5c5e5c5e5c5"), // Replace with an actual campaign ID
      sessionId: "test-session-id",
      firstName: "Test",
      lastName: "User",
      email: "test@example.com",
      isDonor: false,
      firstInteraction: new Date(),
      lastInteraction: new Date(),
      interactionCount: 1,
    }

    const result = await db.collection("people").insertOne(testPerson)
    console.log(`Test person added with ID: ${result.insertedId}`)

    console.log("People collection initialization complete")
  } catch (error) {
    console.error("Error initializing people collection:", error)
  }
}

// Run the initialization
initPeopleCollection()
