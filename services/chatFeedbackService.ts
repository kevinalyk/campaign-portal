import { type MongoClient, ObjectId } from "mongodb"
import type { ChatFeedback } from "@/models/ChatFeedback"

export class ChatFeedbackService {
  private client: MongoClient
  private db: any

  constructor(client: MongoClient) {
    this.client = client
    this.db = this.client.db()
  }

  async submitFeedback(campaignId: string, sessionId: string, rating: "positive" | "negative"): Promise<ChatFeedback> {
    const feedback = {
      campaignId: new ObjectId(campaignId),
      sessionId,
      rating,
      timestamp: new Date(),
    }

    await this.db.collection("chatfeedback").insertOne(feedback)
    return feedback
  }

  async getFeedbackStats(
    campaignId: string,
    options: {
      startDate?: Date
      endDate?: Date
    } = {},
  ): Promise<{
    total: number
    positive: number
    negative: number
    positivePercentage: number
  }> {
    const { startDate, endDate } = options

    const query: any = { campaignId: new ObjectId(campaignId) }

    if (startDate || endDate) {
      query.timestamp = {}
      if (startDate) query.timestamp.$gte = startDate
      if (endDate) query.timestamp.$lte = endDate
    }

    const total = await this.db.collection("chatfeedback").countDocuments(query)

    const positive = await this.db.collection("chatfeedback").countDocuments({
      ...query,
      rating: "positive",
    })

    const negative = total - positive
    const positivePercentage = total > 0 ? (positive / total) * 100 : 0

    return {
      total,
      positive,
      negative,
      positivePercentage,
    }
  }

  async getFeedbackTrends(
    campaignId: string,
    options: {
      startDate?: Date
      endDate?: Date
    } = {},
  ): Promise<
    Array<{
      date: string
      positive: number
      negative: number
      total: number
      positivePercentage: number
    }>
  > {
    const { startDate, endDate } = options

    // Create date boundaries
    const start = startDate || new Date(0)
    const end = endDate || new Date()

    // Ensure we're working with ObjectId
    const campaignObjectId = new ObjectId(campaignId)

    // Aggregate feedback by day
    const pipeline = [
      {
        $match: {
          campaignId: campaignObjectId,
          timestamp: { $gte: start, $lte: end },
        },
      },
      {
        $group: {
          _id: {
            year: { $year: "$timestamp" },
            month: { $month: "$timestamp" },
            day: { $dayOfMonth: "$timestamp" },
            rating: "$rating",
          },
          count: { $sum: 1 },
        },
      },
      {
        $group: {
          _id: {
            year: "$_id.year",
            month: "$_id.month",
            day: "$_id.day",
          },
          ratings: {
            $push: {
              rating: "$_id.rating",
              count: "$count",
            },
          },
        },
      },
      {
        $sort: { "_id.year": 1, "_id.month": 1, "_id.day": 1 },
      },
    ]

    const results = await this.db.collection("chatfeedback").aggregate(pipeline).toArray()

    // Transform the results into the desired format
    return results.map((item) => {
      const date = new Date(item._id.year, item._id.month - 1, item._id.day)
      const dateString = date.toISOString().split("T")[0]

      let positive = 0
      let negative = 0

      item.ratings.forEach((r: any) => {
        if (r.rating === "positive") positive = r.count
        if (r.rating === "negative") negative = r.count
      })

      const total = positive + negative
      const positivePercentage = total > 0 ? (positive / total) * 100 : 0

      return {
        date: dateString,
        positive,
        negative,
        total,
        positivePercentage,
      }
    })
  }
}
