import { type MongoClient, ObjectId } from "mongodb"
import type { Document, DocumentInput } from "@/models/Document"
import { DocumentProcessingService } from "./documentProcessingService"

export class DocumentService {
  private client: MongoClient
  private db: any
  private processingService: DocumentProcessingService

  constructor(client: MongoClient) {
    this.client = client
    this.db = this.client.db()
    this.processingService = new DocumentProcessingService(client)
  }

  async createDocument(documentData: DocumentInput): Promise<Document> {
    const now = new Date()
    const document: Document = {
      _id: new ObjectId(),
      campaignId: new ObjectId(documentData.campaignId),
      name: documentData.name,
      description: documentData.description || "",
      fileUrl: documentData.fileUrl,
      fileKey: documentData.fileKey,
      fileType: documentData.fileType,
      fileSize: documentData.fileSize,
      uploadedBy: new ObjectId(documentData.uploadedBy),
      createdAt: now,
      updatedAt: now,
      processingStatus: "pending",
      textProcessed: false,
    }

    await this.db.collection("documents").insertOne(document)

    // Trigger document processing (don't await to avoid blocking)
    this.processDocumentAsync(document._id.toString())

    return document
  }

  async getDocumentsByCampaign(campaignId: string): Promise<Document[]> {
    return this.db
      .collection("documents")
      .find({ campaignId: new ObjectId(campaignId) })
      .sort({ createdAt: -1 })
      .toArray()
  }

  async getDocument(documentId: string): Promise<Document | null> {
    return this.db.collection("documents").findOne({ _id: new ObjectId(documentId) })
  }

  async deleteDocument(documentId: string): Promise<boolean> {
    const result = await this.db.collection("documents").deleteOne({ _id: new ObjectId(documentId) })
    return result.deletedCount === 1
  }

  async updateDocument(documentId: string, updateData: Partial<DocumentInput>): Promise<Document | null> {
    const result = await this.db
      .collection("documents")
      .findOneAndUpdate(
        { _id: new ObjectId(documentId) },
        { $set: { ...updateData, updatedAt: new Date() } },
        { returnDocument: "after" },
      )
    return result
  }

  // Add this new method to trigger document processing
  async processDocumentAsync(documentId: string): Promise<void> {
    try {
      await this.processingService.processDocument(documentId)
    } catch (error) {
      console.error(`Error processing document ${documentId}:`, error)
      // Update document with error status
      await this.db.collection("documents").updateOne(
        { _id: new ObjectId(documentId) },
        {
          $set: {
            processingStatus: "failed",
            processingError: error.message,
            updatedAt: new Date(),
          },
        },
      )
    }
  }
}

// Add the missing getDocumentsForCampaign export at the end of the file

export async function getDocumentsForCampaign(campaignId: string): Promise<any[]> {
  const mongoUri = process.env.MONGODB_URI
  if (!mongoUri) {
    throw new Error('Invalid/Missing environment variable: "MONGODB_URI"')
  }

  const { MongoClient } = require("mongodb") // Import MongoClient

  const client = new MongoClient(mongoUri)

  try {
    await client.connect()
    const service = new DocumentService(client)
    return await service.getDocumentsByCampaign(campaignId)
  } catch (error) {
    console.error("Error getting documents for campaign:", error)
    return []
  } finally {
    await client.close()
  }
}
