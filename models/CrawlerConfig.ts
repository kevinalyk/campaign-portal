import type { ObjectId } from "mongodb"

export type CrawlerType = "url" | "robots" | "sitemap"
export type CrawlerStatus = "pending" | "running" | "completed" | "failed"

export interface CrawlerConfig {
  _id: ObjectId
  campaignId: ObjectId
  createdBy: ObjectId
  createdAt: Date
  updatedAt?: Date
  status: CrawlerStatus
  type: CrawlerType
  url?: string
  robotsTxt?: string
  sitemapContent?: string
  error?: string
  completedAt?: Date
  pagesProcessed?: number
}

export interface CrawlerConfigInput {
  campaignId: string
  type: CrawlerType
  url?: string
  robotsTxt?: string
  sitemapContent?: string
}
