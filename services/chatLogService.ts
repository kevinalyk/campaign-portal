import { type MongoClient, ObjectId } from "mongodb"
import type { ChatLog } from "@/models/ChatLog"

export class ChatLogService {
  private client: MongoClient
  private db: any

  constructor(client: MongoClient) {
    this.client = client
    this.db = this.client.db()
  }

  async logChat(
    campaignId: string,
    sessionId: string,
    message: string,
    role: "user" | "assistant",
    userIdentifier?: string,
    metadata?: any,
  ): Promise<ChatLog> {
    const chatLog = {
      campaignId: new ObjectId(campaignId),
      sessionId,
      userIdentifier,
      message,
      role,
      timestamp: new Date(),
      metadata,
    }

    await this.db.collection("chatlogs").insertOne(chatLog)
    return chatLog
  }

  async getChatLogs(
    campaignId: string,
    options: {
      startDate?: Date
      endDate?: Date
      sessionId?: string
      userIdentifier?: string
      limit?: number
      skip?: number
      sortDirection?: "asc" | "desc"
    } = {},
  ): Promise<{ logs: ChatLog[]; total: number }> {
    const { startDate, endDate, sessionId, userIdentifier, limit = 100, skip = 0, sortDirection = "desc" } = options

    const query: any = { campaignId: new ObjectId(campaignId) }

    if (startDate || endDate) {
      query.timestamp = {}
      if (startDate) query.timestamp.$gte = startDate
      if (endDate) query.timestamp.$lte = endDate
    }

    if (sessionId) query.sessionId = sessionId
    if (userIdentifier) query.userIdentifier = userIdentifier

    const total = await this.db.collection("chatlogs").countDocuments(query)

    const logs = await this.db
      .collection("chatlogs")
      .find(query)
      .sort({ timestamp: sortDirection === "asc" ? 1 : -1 })
      .skip(skip)
      .limit(limit)
      .toArray()

    return { logs, total }
  }

  async getSessionList(
    campaignId: string,
    options: {
      startDate?: Date
      endDate?: Date
      limit?: number
      skip?: number
    } = {},
  ): Promise<{ sessions: any[]; total: number }> {
    const { startDate, endDate, limit = 20, skip = 0 } = options

    const matchStage: any = { campaignId: new ObjectId(campaignId) }

    if (startDate || endDate) {
      matchStage.timestamp = {}
      if (startDate) matchStage.timestamp.$gte = startDate
      if (endDate) matchStage.timestamp.$lte = endDate
    }

    const pipeline = [
      { $match: matchStage },
      {
        $group: {
          _id: "$sessionId",
          firstMessage: { $min: "$timestamp" },
          lastMessage: { $max: "$timestamp" },
          messageCount: { $sum: 1 },
          userIdentifier: { $first: "$userIdentifier" },
          // Get the first user message as a preview
          preview: {
            $first: {
              $cond: [{ $eq: ["$role", "user"] }, "$message", null],
            },
          },
        },
      },
      { $sort: { lastMessage: -1 } },
      { $skip: skip },
      { $limit: limit },
    ]

    const countPipeline = [{ $match: matchStage }, { $group: { _id: "$sessionId" } }, { $count: "total" }]

    const sessions = await this.db.collection("chatlogs").aggregate(pipeline).toArray()
    const countResult = await this.db.collection("chatlogs").aggregate(countPipeline).toArray()
    const total = countResult.length > 0 ? countResult[0].total : 0

    return { sessions, total }
  }

  async updateRetentionPeriod(days: number): Promise<boolean> {
    try {
      // This would require admin privileges in MongoDB
      // In a real implementation, you might need to use a different approach
      // such as a scheduled job that deletes old records
      await this.db.command({
        collMod: "chatlogs",
        index: {
          keyPattern: { timestamp: 1 },
          expireAfterSeconds: days * 24 * 60 * 60,
        },
      })
      return true
    } catch (error) {
      console.error("Error updating retention period:", error)
      return false
    }
  }

  async exportChatLogs(
    campaignId: string,
    format: "json" | "csv",
    options: {
      startDate?: Date
      endDate?: Date
      sessionId?: string
    } = {},
  ): Promise<string> {
    const { startDate, endDate, sessionId } = options

    const { logs } = await this.getChatLogs(campaignId, {
      startDate,
      endDate,
      sessionId,
      limit: 10000, // Set a reasonable limit for exports
    })

    if (format === "json") {
      return JSON.stringify(logs, null, 2)
    } else if (format === "csv") {
      // Simple CSV conversion
      const headers = "timestamp,sessionId,role,message,userIdentifier\n"
      const rows = logs
        .map((log) => {
          return `"${log.timestamp}","${log.sessionId}","${log.role}","${log.message.replace(/"/g, '""')}","${log.userIdentifier || ""}"`
        })
        .join("\n")
      return headers + rows
    }

    throw new Error(`Unsupported format: ${format}`)
  }
}
