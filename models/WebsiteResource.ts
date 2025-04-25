import type { ObjectId } from "mongodb"

export type WebsiteResourceType = "url" | "html" | "screenshot"
export type WebsiteResourceStatus =
  | "pending"
  | "queued"
  | "processing"
  | "crawling"
  | "completed"
  | "failed"
  | "unknown"

export interface WebsiteResource {
  _id: ObjectId
  campaignId: ObjectId
  type: WebsiteResourceType
  url?: string
  // Remove content field to avoid duplication
  fileUrl?: string
  fileKey?: string
  lastFetched?: Date
  createdAt: Date
  updatedAt: Date
  status: WebsiteResourceStatus
  error?: string
  pagesCrawled?: number
  contentSize?: number
  keywords?: string[]
  sitemapId?: ObjectId
}

export interface WebsiteResourceInput {
  campaignId: string
  type: WebsiteResourceType
  url?: string
  // Remove content field to avoid duplication
  fileUrl?: string
  fileKey?: string
  status?: WebsiteResourceStatus
  error?: string
  pagesCrawled?: number
  contentSize?: number
  keywords?: string[]
  sitemapId?: string
}
