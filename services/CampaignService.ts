import { type MongoClient, ObjectId } from "mongodb"
import type { Campaign, CampaignInput } from "@/models/Campaign"
import type { UserCampaign, UserRole } from "@/models/UserCampaign"

export class CampaignService {
  private client: MongoClient
  private db: any

  constructor(client: MongoClient) {
    this.client = client
    this.db = this.client.db()
  }

  // Campaign CRUD operations
  async createCampaign(campaignData: CampaignInput, userId: string): Promise<Campaign> {
    // Check if a campaign with the same URL already exists
    const existingCampaign = await this.db.collection("campaigns").findOne({ url: campaignData.url })
    if (existingCampaign) {
      throw new Error("A campaign with this URL already exists")
    }

    const now = new Date()
    const campaign: Campaign = {
      _id: new ObjectId(),
      ...campaignData,
      isActive: campaignData.isActive !== undefined ? campaignData.isActive : true, // Default to true if not specified
      createdAt: now,
      updatedAt: now,
    }

    await this.db.collection("campaigns").insertOne(campaign)

    // Create the user-campaign relationship with owner role
    const userCampaign: UserCampaign = {
      _id: new ObjectId(),
      userId: new ObjectId(userId),
      campaignId: campaign._id,
      role: "owner" as UserRole,
      createdAt: now,
      updatedAt: now,
    }

    await this.db.collection("userCampaigns").insertOne(userCampaign)

    return campaign
  }

  async getCampaign(campaignId: string): Promise<Campaign | null> {
    return this.db.collection("campaigns").findOne({ _id: new ObjectId(campaignId) })
  }

  async getCampaignByUrl(url: string): Promise<Campaign | null> {
    return this.db.collection("campaigns").findOne({ url })
  }

  // Add a console.log to debug the updateCampaign method
  async updateCampaign(campaignId: string, updateData: Partial<Campaign>): Promise<Campaign | null> {
    console.log("Updating campaign with data:", JSON.stringify(updateData, null, 2))

    try {
      const db = this.client.db()
      const result = await db
        .collection("campaigns")
        .findOneAndUpdate(
          { _id: new ObjectId(campaignId) },
          { $set: { ...updateData, updatedAt: new Date() } },
          { returnDocument: "after" },
        )

      console.log("Update result:", result ? "Success" : "Failed")
      return result
    } catch (error) {
      console.error("Error in updateCampaign:", error)
      throw error
    }
  }

  async toggleCampaignStatus(campaignId: string, isActive: boolean): Promise<Campaign | null> {
    return this.updateCampaign(campaignId, { isActive })
  }

  async deleteCampaign(campaignId: string): Promise<boolean> {
    const result = await this.db.collection("campaigns").deleteOne({ _id: new ObjectId(campaignId) })

    // Also delete all user-campaign relationships
    await this.db.collection("userCampaigns").deleteMany({ campaignId: new ObjectId(campaignId) })

    return result.deletedCount === 1
  }

  // User-Campaign relationship operations
  async getUserCampaigns(userId: string): Promise<Campaign[]> {
    const userCampaigns = await this.db
      .collection("userCampaigns")
      .find({ userId: new ObjectId(userId) })
      .toArray()

    const campaignIds = userCampaigns.map((uc) => uc.campaignId)

    if (campaignIds.length === 0) {
      return []
    }

    return this.db
      .collection("campaigns")
      .find({ _id: { $in: campaignIds } })
      .toArray()
  }

  async getCampaignUsers(campaignId: string): Promise<{ userId: ObjectId; role: UserRole }[]> {
    const userCampaigns = await this.db
      .collection("userCampaigns")
      .find({ campaignId: new ObjectId(campaignId) })
      .toArray()

    return userCampaigns.map((uc) => ({ userId: uc.userId, role: uc.role }))
  }

  async addUserToCampaign(campaignId: string, userId: string, role: UserRole): Promise<UserCampaign> {
    // Check if the user already has access to this campaign
    const existingRelationship = await this.db.collection("userCampaigns").findOne({
      userId: new ObjectId(userId),
      campaignId: new ObjectId(campaignId),
    })

    if (existingRelationship) {
      throw new Error("User already has access to this campaign")
    }

    const now = new Date()
    const userCampaign: UserCampaign = {
      _id: new ObjectId(),
      userId: new ObjectId(userId),
      campaignId: new ObjectId(campaignId),
      role,
      createdAt: now,
      updatedAt: now,
    }

    await this.db.collection("userCampaigns").insertOne(userCampaign)
    return userCampaign
  }

  async updateUserRole(campaignId: string, userId: string, role: UserRole): Promise<UserCampaign | null> {
    const result = await this.db.collection("userCampaigns").findOneAndUpdate(
      {
        userId: new ObjectId(userId),
        campaignId: new ObjectId(campaignId),
      },
      {
        $set: {
          role,
          updatedAt: new Date(),
        },
      },
      { returnDocument: "after" },
    )

    return result
  }

  async removeUserFromCampaign(campaignId: string, userId: string): Promise<boolean> {
    const result = await this.db.collection("userCampaigns").deleteOne({
      userId: new ObjectId(userId),
      campaignId: new ObjectId(campaignId),
    })

    return result.deletedCount === 1
  }

  async getUserRole(campaignId: string, userId: string): Promise<UserRole | null> {
    const userCampaign = await this.db.collection("userCampaigns").findOne({
      userId: new ObjectId(userId),
      campaignId: new ObjectId(campaignId),
    })

    return userCampaign ? userCampaign.role : null
  }
}
