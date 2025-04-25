import { type MongoClient, ObjectId } from "mongodb"
import type {
  WebsiteResource,
  WebsiteResourceInput,
  WebsiteResourceType,
  WebsiteResourceStatus,
} from "@/models/WebsiteResource"

export class WebsiteResourceService {
  private client: MongoClient
  private db: any

  constructor(client: MongoClient) {
    this.client = client
    this.db = this.client.db()
  }

  async createWebsiteResource(resourceData: WebsiteResourceInput): Promise<WebsiteResource> {
    const now = new Date()
    const resource: WebsiteResource = {
      _id: new ObjectId(),
      campaignId: new ObjectId(resourceData.campaignId),
      type: resourceData.type,
      url: resourceData.url,
      // Remove content field to avoid duplication
      fileUrl: resourceData.fileUrl,
      fileKey: resourceData.fileKey,
      lastFetched: resourceData.type === "url" ? now : undefined,
      createdAt: now,
      updatedAt: now,
      status: resourceData.status || "pending",
    }

    await this.db.collection("websiteResources").insertOne(resource)
    return resource
  }

  async getWebsiteResourcesByCampaign(campaignId: string): Promise<WebsiteResource[]> {
    return this.db
      .collection("websiteResources")
      .find({ campaignId: new ObjectId(campaignId) })
      .sort({ createdAt: -1 })
      .toArray()
  }

  async getWebsiteResource(resourceId: string): Promise<WebsiteResource | null> {
    return this.db.collection("websiteResources").findOne({ _id: new ObjectId(resourceId) })
  }

  async deleteWebsiteResource(resourceId: string): Promise<boolean> {
    const result = await this.db.collection("websiteResources").deleteOne({ _id: new ObjectId(resourceId) })
    return result.deletedCount === 1
  }

  async updateWebsiteResource(
    resourceId: string,
    updateData: Partial<WebsiteResourceInput>,
  ): Promise<WebsiteResource | null> {
    const updateObj: any = { ...updateData, updatedAt: new Date() }

    // If updating a URL resource, update lastFetched
    if (updateData.type === "url" || updateData.url) {
      updateObj.lastFetched = new Date()
    }

    const result = await this.db
      .collection("websiteResources")
      .findOneAndUpdate({ _id: new ObjectId(resourceId) }, { $set: updateObj }, { returnDocument: "after" })
    return result
  }

  async getLatestWebsiteResourceByType(campaignId: string, type: WebsiteResourceType): Promise<WebsiteResource | null> {
    return this.db
      .collection("websiteResources")
      .findOne({ campaignId: new ObjectId(campaignId), type }, { sort: { createdAt: -1 } })
  }

  async updateWebsiteResourceStatus(
    resourceId: string,
    status: WebsiteResourceStatus,
    error?: string,
  ): Promise<WebsiteResource | null> {
    const updateObj: any = {
      status,
      updatedAt: new Date(),
    }

    if (error) {
      updateObj.error = error
    }

    const result = await this.db
      .collection("websiteResources")
      .findOneAndUpdate({ _id: new ObjectId(resourceId) }, { $set: updateObj }, { returnDocument: "after" })
    return result
  }
}

export async function getWebsiteResourcesForCampaign(campaignId: string): Promise<any[]> {
  const mongoUri = process.env.MONGODB_URI
  if (!mongoUri) {
    throw new Error('Invalid/Missing environment variable: "MONGODB_URI"')
  }

  const { MongoClient } = require("mongodb")
  const client = new MongoClient(mongoUri)

  try {
    await client.connect()
    const service = new WebsiteResourceService(client)
    return await service.getWebsiteResourcesByCampaign(campaignId)
  } catch (error) {
    return []
  } finally {
    await client.close()
  }
}
