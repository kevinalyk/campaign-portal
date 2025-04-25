import type { ObjectId } from "mongodb"

export interface SiteMapEntry {
  url: string
  title: string
  description: string
  keywords: string[]
  lastCrawled: Date
  lastModified?: Date
}

export interface SiteMap {
  _id: ObjectId
  campaignId: ObjectId
  websiteResourceId: ObjectId
  baseUrl: string
  entries: SiteMapEntry[]
  createdAt: Date
  updatedAt: Date
  status: "pending" | "crawling" | "completed" | "failed"
  error?: string
  pagesCrawled: number
  respectsRobotsTxt: boolean
}

export interface PageCache {
  _id: ObjectId
  url: string
  content: string
  fetchedAt: Date
  expiresAt: Date
}
