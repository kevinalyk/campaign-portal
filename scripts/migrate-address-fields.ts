import { MongoClient } from "mongodb"

async function migrateAddressFields() {
  const mongoUri = process.env.MONGODB_URI
  if (!mongoUri) {
    throw new Error('Invalid/Missing environment variable: "MONGODB_URI"')
  }

  const client = new MongoClient(mongoUri)

  try {
    await client.connect()
    const db = client.db()
    const campaignsCollection = db.collection("campaigns")

    // Find all campaigns with the old address format
    const campaigns = await campaignsCollection
      .find({
        contactAddress: { $exists: true, $ne: null },
      })
      .toArray()

    console.log(`Found ${campaigns.length} campaigns with addresses to migrate`)

    let migratedCount = 0

    for (const campaign of campaigns) {
      const address = campaign.contactAddress
      if (!address) continue

      // Simple parsing logic - this is a basic example
      // You might need more sophisticated parsing based on your data
      const parts = address.split(",").map((part) => part.trim())

      const updateData: any = {}

      // Basic parsing logic - adjust as needed for your data format
      if (parts.length >= 1) updateData.contactAddressStreet = parts[0]
      if (parts.length >= 2) updateData.contactAddressCity = parts[1]
      if (parts.length >= 3) {
        // Try to extract state and zip from the last part
        const stateZip = parts[2].split(" ")
        if (stateZip.length >= 1) updateData.contactAddressState = stateZip[0]
        if (stateZip.length >= 2) updateData.contactAddressZip = stateZip[1]
      }

      // Update the campaign with the parsed address fields
      await campaignsCollection.updateOne({ _id: campaign._id }, { $set: updateData })

      migratedCount++
    }

    console.log(`Successfully migrated ${migratedCount} campaigns`)
  } catch (error) {
    console.error("Error migrating address fields:", error)
  } finally {
    await client.close()
  }
}

// Run the migration
migrateAddressFields()
  .then(() => console.log("Migration completed"))
  .catch((err) => console.error("Migration failed:", err))
