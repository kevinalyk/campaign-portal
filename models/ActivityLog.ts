import type { ObjectId } from "mongodb"

export interface ActivityLog {
  _id?: ObjectId
  campaignId: ObjectId
  userId: ObjectId
  userName: string
  action: string
  entityType: string
  entityId?: ObjectId
  details?: any
  timestamp: Date
}

export enum ActivityAction {
  CREATE = "create",
  UPDATE = "update",
  DELETE = "delete",
  UPLOAD = "upload",
  DOWNLOAD = "download",
  ADD = "add",
  REMOVE = "remove",
  RATE_LIMIT_ENABLED = "rate_limit_enabled",
  RATE_LIMIT_DISABLED = "rate_limit_disabled",
  RATE_LIMIT_EXCEEDED = "rate_limit_exceeded",
}

export enum EntityType {
  DOCUMENT = "document",
  WEBSITE = "website",
  USER = "user",
  CAMPAIGN = "campaign",
  CHAT_SETTINGS = "chat_settings",
  CONTACT_INFO = "contact_info",
  RATE_LIMIT = "rate_limit",
}
