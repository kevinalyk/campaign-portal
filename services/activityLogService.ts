import { type MongoClient, ObjectId } from "mongodb"
import type { ActivityLog } from "@/models/ActivityLog"

export class ActivityLogService {
  private client: MongoClient
  private db: any

  constructor(client: MongoClient) {
    this.client = client
    this.db = client.db()
  }

  async createLog(logData: Omit<ActivityLog, "_id" | "timestamp">): Promise<ActivityLog> {
    console.log("ActivityLogService.createLog called with:", logData)

    const log: ActivityLog = {
      ...logData,
      timestamp: new Date(),
    }

    // Ensure the activityLogs collection exists
    const collections = await this.db.listCollections({ name: "activityLogs" }).toArray()
    if (collections.length === 0) {
      await this.db.createCollection("activityLogs")
      console.log("Created activityLogs collection")
      await this.db.collection("activityLogs").createIndex({ campaignId: 1, timestamp: -1 })
      await this.db.collection("activityLogs").createIndex({ userId: 1, timestamp: -1 })
      await this.db.collection("activityLogs").createIndex({ entityType: 1, timestamp: -1 })
    }

    try {
      const result = await this.db.collection("activityLogs").insertOne(log)
      console.log("Activity log created with ID:", result.insertedId)
      return { ...log, _id: result.insertedId }
    } catch (error) {
      console.error("Error inserting activity log:", error)
      throw error
    }
  }

  async getLogsByCampaign(campaignId: string, limit = 100, skip = 0): Promise<ActivityLog[]> {
    console.log(
      `ActivityLogService.getLogsByCampaign called with: campaignId=${campaignId}, limit=${limit}, skip=${skip}`,
    )

    try {
      // Ensure the activityLogs collection exists
      const collections = await this.db.listCollections({ name: "activityLogs" }).toArray()
      if (collections.length === 0) {
        console.log("activityLogs collection does not exist")
        return []
      }

      // Check if there are any logs for this campaign
      const count = await this.db.collection("activityLogs").countDocuments({
        campaignId: new ObjectId(campaignId),
      })
      console.log(`Found ${count} logs for campaign ${campaignId}`)

      if (count === 0) {
        return []
      }

      const logs = await this.db
        .collection("activityLogs")
        .find({ campaignId: new ObjectId(campaignId) })
        .sort({ timestamp: -1 })
        .skip(skip)
        .limit(limit)
        .toArray()

      console.log(`Retrieved ${logs.length} logs for campaign ${campaignId}`)
      return logs
    } catch (error) {
      console.error("Error fetching logs by campaign:", error)
      throw error
    }
  }

  async getLogsByUser(userId: string, limit = 100, skip = 0): Promise<ActivityLog[]> {
    console.log(`ActivityLogService.getLogsByUser called with: userId=${userId}, limit=${limit}, skip=${skip}`)

    try {
      // Ensure the activityLogs collection exists
      const collections = await this.db.listCollections({ name: "activityLogs" }).toArray()
      if (collections.length === 0) {
        console.log("activityLogs collection does not exist")
        return []
      }

      const logs = await this.db
        .collection("activityLogs")
        .find({ userId: new ObjectId(userId) })
        .sort({ timestamp: -1 })
        .skip(skip)
        .limit(limit)
        .toArray()

      console.log(`Retrieved ${logs.length} logs for user ${userId}`)
      return logs
    } catch (error) {
      console.error("Error fetching logs by user:", error)
      throw error
    }
  }

  async getLogsByEntityType(campaignId: string, entityType: string, limit = 100, skip = 0): Promise<ActivityLog[]> {
    console.log(
      `ActivityLogService.getLogsByEntityType called with: campaignId=${campaignId}, entityType=${entityType}, limit=${limit}, skip=${skip}`,
    )

    try {
      // Ensure the activityLogs collection exists
      const collections = await this.db.listCollections({ name: "activityLogs" }).toArray()
      if (collections.length === 0) {
        console.log("activityLogs collection does not exist")
        return []
      }

      const logs = await this.db
        .collection("activityLogs")
        .find({
          campaignId: new ObjectId(campaignId),
          entityType,
        })
        .sort({ timestamp: -1 })
        .skip(skip)
        .limit(limit)
        .toArray()

      console.log(`Retrieved ${logs.length} logs for campaign ${campaignId} and entity type ${entityType}`)
      return logs
    } catch (error) {
      console.error("Error fetching logs by entity type:", error)
      throw error
    }
  }
}
