import type { ObjectId } from "mongodb"

export type UserRole = "owner" | "admin" | "editor" | "viewer"

export interface UserCampaign {
  _id: ObjectId
  userId: ObjectId
  campaignId: ObjectId
  role: UserRole
  createdAt: Date
  updatedAt: Date
}

export interface UserCampaignInput {
  userId: string
  campaignId: string
  role: UserRole
}
