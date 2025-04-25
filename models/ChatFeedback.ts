import mongoose from "mongoose"
import type { ObjectId } from "mongodb"

export interface ChatFeedback {
  _id?: ObjectId
  campaignId: ObjectId | string
  sessionId: string
  rating: "positive" | "negative"
  timestamp: Date
}

const ChatFeedbackSchema = new mongoose.Schema(
  {
    campaignId: { type: mongoose.Schema.Types.ObjectId, ref: "Campaign", required: true, index: true },
    sessionId: { type: String, required: true, index: true },
    rating: { type: String, enum: ["positive", "negative"], required: true },
    timestamp: { type: Date, default: Date.now },
  },
  {
    timestamps: true,
  },
)

export default mongoose.models.ChatFeedback || mongoose.model("ChatFeedback", ChatFeedbackSchema, "chatfeedback")
