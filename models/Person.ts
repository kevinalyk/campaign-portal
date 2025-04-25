import type { ObjectId } from "mongodb"

export interface Person {
  _id?: ObjectId
  campaignId: string
  sessionId: string
  firstName?: string
  lastName?: string
  email?: string
  phone?: string
  address?: string
  city?: string
  state?: string
  zip?: string
  isDonor?: boolean
  donationAmount?: number
  donationDate?: Date
  interactionCount: number
  firstInteraction: Date
  lastInteraction: Date
  createdAt: Date
  updatedAt: Date
  notes?: string
}
