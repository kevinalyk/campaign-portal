import mongoose from "mongoose"
import type { ObjectId } from "mongodb"

export interface ChatLog {
  _id: ObjectId
  campaignId: ObjectId | string
  sessionId: string
  userIdentifier?: string
  message: string
  role: "user" | "assistant"
  timestamp: Date
  metadata?: {
    userAgent?: string
    ipHash?: string
    location?: string
    referrer?: string
  }
}

const ChatLogSchema = new mongoose.Schema(
  {
    campaignId: { type: mongoose.Schema.Types.ObjectId, ref: "Campaign", required: true, index: true },
    sessionId: { type: String, required: true, index: true },
    userIdentifier: { type: String, index: true },
    message: { type: String, required: true },
    role: { type: String, enum: ["user", "assistant"], required: true },
    timestamp: { type: Date, default: Date.now, index: true },
    metadata: {
      userAgent: String,
      ipHash: String,
      location: String,
      referrer: String,
    },
  },
  {
    timestamps: true,
  },
)

// Add TTL index for automatic deletion after X days (e.g., 30 days)
// This will automatically delete documents older than the specified time
ChatLogSchema.index({ timestamp: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 }) // 30 days

export default mongoose.models.ChatLog || mongoose.model("ChatLog", ChatLogSchema, "chatlogs")
