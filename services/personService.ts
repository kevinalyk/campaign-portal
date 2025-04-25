import { type MongoClient, ObjectId } from "mongodb"
import type { Person } from "@/models/Person"

export class PersonService {
  private client: MongoClient
  private dbName = "test" // Changed from "campaign_portal" to "test"
  private collectionName = "people"

  constructor(client: MongoClient) {
    this.client = client
  }

  async findPersonById(id: string): Promise<Person | null> {
    try {
      const db = this.client.db(this.dbName)
      const collection = db.collection<Person>(this.collectionName)

      // Try to find by ObjectId first
      let person: Person | null = null

      try {
        if (ObjectId.isValid(id)) {
          person = await collection.findOne({ _id: new ObjectId(id) })
        }
      } catch (error) {
        console.error("Error finding person by ObjectId:", error)
      }

      // If not found by ObjectId, try to find by sessionId
      if (!person) {
        person = await collection.findOne({ sessionId: id })
      }

      return person
    } catch (error) {
      console.error("Error in findPersonById:", error)
      return null
    }
  }

  async createPerson(personData: Partial<Person>): Promise<Person | null> {
    try {
      const db = this.client.db(this.dbName)
      const collection = db.collection<Person>(this.collectionName)

      // Set default values for required fields if not provided
      const dataWithDefaults = {
        isDonor: false,
        interactionCount: 1,
        firstInteraction: new Date(),
        lastInteraction: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        ...personData,
      }

      const result = await collection.insertOne(dataWithDefaults as any)
      if (result.acknowledged) {
        return {
          _id: result.insertedId,
          ...dataWithDefaults,
        } as Person
      }
      return null
    } catch (error) {
      console.error("Error in createPerson:", error)
      return null
    }
  }

  // Update the updatePersonInfo method to handle the $inc operator
  async updatePersonInfo(
    id: string,
    updateData: Partial<Person> & { $inc?: Record<string, number> },
  ): Promise<Person | null> {
    try {
      const db = this.client.db(this.dbName)
      const collection = db.collection<Person>(this.collectionName)

      // Find the person first
      const person = await this.findPersonById(id)

      // Extract $inc operator if present
      const incrementFields = updateData.$inc || {}
      delete updateData.$inc

      if (!person) {
        // If person doesn't exist, create a new one with the sessionId
        // Initialize interactionCount to 1 for new persons
        return this.createPerson({
          ...updateData,
          interactionCount: 1, // Start with 1 for new persons
          sessionId: id,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
      }

      // Update the existing person
      const filter = person._id ? { _id: person._id } : { sessionId: id }

      // Prepare update operations
      const updateOps: any = {
        $set: {
          ...updateData,
          updatedAt: new Date(),
        },
      }

      // Add $inc operator if there are fields to increment
      if (Object.keys(incrementFields).length > 0) {
        updateOps.$inc = incrementFields
      }

      const result = await collection.updateOne(filter, updateOps)

      if (result.matchedCount > 0) {
        // Get the updated person to return the current state
        const updatedPerson = await this.findPersonById(id)
        return updatedPerson
      }
      return null
    } catch (error) {
      console.error("Error in updatePersonInfo:", error)
      return null
    }
  }

  async deletePerson(id: string): Promise<boolean> {
    try {
      const db = this.client.db(this.dbName)
      const collection = db.collection<Person>(this.collectionName)

      // Find the person first
      const person = await this.findPersonById(id)
      if (!person) {
        return false
      }

      // Delete the person
      const filter = person._id ? { _id: person._id } : { sessionId: id }
      const result = await collection.deleteOne(filter)
      return result.deletedCount > 0
    } catch (error) {
      console.error("Error in deletePerson:", error)
      return false
    }
  }

  async findPeopleByCampaignId(campaignId: string): Promise<Person[]> {
    try {
      const db = this.client.db(this.dbName)
      const collection = db.collection<Person>(this.collectionName)

      // Create a flexible filter that handles both string and ObjectId campaignIds
      const filter = this.createCampaignIdFilter(campaignId)
      return await collection.find(filter).toArray()
    } catch (error) {
      console.error("Error in findPeopleByCampaignId:", error)
      return []
    }
  }

  // Helper method to create a filter that handles different campaignId formats
  private createCampaignIdFilter(campaignId: string) {
    // Create a filter that will match either string or ObjectId format
    const filter: any = {
      $or: [{ campaignId: campaignId }],
    }

    // If it's a valid ObjectId, also try to match as ObjectId
    if (ObjectId.isValid(campaignId)) {
      try {
        filter.$or.push({ campaignId: new ObjectId(campaignId) })
      } catch (e) {
        // Silently handle error
      }
    }

    return filter
  }

  async getPeople(
    campaignId: string,
    options: {
      limit: number
      skip: number
      sortField: string
      sortDirection: "asc" | "desc"
      search?: string
      isDonor?: boolean
    },
  ): Promise<{ people: Person[]; total: number }> {
    try {
      const { limit, skip, sortField, sortDirection, search, isDonor } = options
      const db = this.client.db(this.dbName)
      const collection = db.collection<Person>(this.collectionName)

      // Create a flexible filter that handles both string and ObjectId campaignIds
      const campaignFilter = this.createCampaignIdFilter(campaignId)

      // Build the complete filter
      let filter: any = campaignFilter

      // Add search filter if provided
      if (search) {
        filter = {
          $and: [
            campaignFilter,
            {
              $or: [
                { firstName: { $regex: search, $options: "i" } },
                { lastName: { $regex: search, $options: "i" } },
                { email: { $regex: search, $options: "i" } },
                { sessionId: { $regex: search, $options: "i" } },
              ],
            },
          ],
        }
      }

      // Add isDonor filter ONLY if explicitly provided (not undefined)
      if (isDonor !== undefined) {
        const donorFilter = isDonor
          ? { isDonor: true }
          : {
              $or: [{ isDonor: false }, { isDonor: { $exists: false } }],
            }

        // Combine with existing filter
        if (filter.$and) {
          filter.$and.push(donorFilter)
        } else if (filter.$or) {
          filter = {
            $and: [filter, donorFilter],
          }
        } else {
          filter = {
            $and: [campaignFilter, donorFilter],
          }
        }
      }

      // Get total count
      const total = await collection.countDocuments(filter)

      // Build sort object
      const sort: any = {}
      sort[sortField] = sortDirection === "asc" ? 1 : -1

      // Get people with pagination and sorting
      const people = await collection.find(filter).sort(sort).skip(skip).limit(limit).toArray()

      return { people, total }
    } catch (error) {
      console.error("Error in getPeople:", error)
      return { people: [], total: 0 }
    }
  }

  // Add the exportPeople method
  async exportPeople(campaignId: string, format: "csv" | "json", isDonor?: boolean): Promise<string> {
    try {
      const db = this.client.db(this.dbName)
      const collection = db.collection<Person>(this.collectionName)

      // Create a flexible filter that handles both string and ObjectId campaignIds
      const campaignFilter = this.createCampaignIdFilter(campaignId)

      // Build the complete filter
      let filter: any = campaignFilter

      // Add isDonor filter if provided
      if (isDonor !== undefined) {
        const donorFilter = isDonor
          ? { isDonor: true }
          : {
              $or: [{ isDonor: false }, { isDonor: { $exists: false } }],
            }

        filter = {
          $and: [campaignFilter, donorFilter],
        }
      }

      // Get all people matching the filter
      const people = await collection.find(filter).toArray()

      // Format the data based on the requested format
      if (format === "json") {
        // For JSON, just stringify the array
        return JSON.stringify(people, null, 2)
      } else {
        // For CSV, convert to CSV format
        return this.convertToCSV(people)
      }
    } catch (error) {
      console.error("Error in exportPeople:", error)
      throw error
    }
  }

  // Helper method to convert an array of objects to CSV with ordered columns
  private convertToCSV(data: any[]): string {
    if (data.length === 0) {
      return "No data to export"
    }

    try {
      // Define the preferred column order
      const preferredOrder = [
        // Personal information
        "firstName",
        "lastName",
        "email",
        "address",
        "city",
        "state",
        "zip",

        // Status information
        "isDonor",
        "interactionCount",

        // Time-based information
        "firstInteraction",
        "lastInteraction",
        "createdAt",
        "updatedAt",

        // Technical information
        "sessionId",
        "campaignId",
      ]

      // Get all possible headers from all objects
      const allHeaders = new Set<string>()
      data.forEach((item) => {
        Object.keys(item).forEach((key) => {
          if (key !== "_id") {
            // Skip MongoDB _id field
            allHeaders.add(key)
          }
        })
      })

      // Create the final header array in the preferred order
      const headerArray: string[] = []

      // First add all preferred headers that exist in the data
      preferredOrder.forEach((header) => {
        if (allHeaders.has(header)) {
          headerArray.push(header)
          allHeaders.delete(header)
        }
      })

      // Then add any remaining headers that weren't in the preferred order
      Array.from(allHeaders)
        .sort()
        .forEach((header) => {
          headerArray.push(header)
        })

      // Create CSV header row
      let csv = headerArray.join(",") + "\n"

      // Add data rows
      data.forEach((item) => {
        const row = headerArray
          .map((header) => {
            // Handle different data types
            if (item[header] === undefined || item[header] === null) {
              return ""
            } else if (typeof item[header] === "object") {
              if (item[header] instanceof Date) {
                return item[header].toISOString()
              } else {
                // For other objects, stringify but escape quotes
                return `"${JSON.stringify(item[header]).replace(/"/g, '""')}"`
              }
            } else if (typeof item[header] === "string") {
              // Escape quotes in strings and wrap in quotes
              return `"${item[header].replace(/"/g, '""')}"`
            } else {
              return item[header]
            }
          })
          .join(",")
        csv += row + "\n"
      })

      return csv
    } catch (error) {
      console.error("Error converting to CSV:", error)
      throw new Error("Failed to convert data to CSV format")
    }
  }
}
