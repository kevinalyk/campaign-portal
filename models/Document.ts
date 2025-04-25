import type { ObjectId } from "mongodb"

export interface Document {
  _id: ObjectId
  campaignId: ObjectId
  name: string
  description?: string
  fileUrl: string
  fileKey: string
  fileType: string
  fileSize: number
  uploadedBy: ObjectId
  createdAt: Date
  updatedAt: Date
  extractedText?: string
  textProcessed?: boolean
  vectorEmbedding?: number[]
  processingStatus?: "pending" | "processing" | "completed" | "failed"
  processingError?: string
}

export interface DocumentInput {
  campaignId: string
  name: string
  description?: string
  fileUrl: string
  fileKey: string
  fileType: string
  fileSize: number
  uploadedBy: string
}
