import { type MongoClient, ObjectId } from "mongodb"
import bcrypt from "bcryptjs"

export interface User {
  _id: ObjectId
  email: string
  password: string
  firstName: string
  lastName: string
  createdAt: Date
  lastLogin: Date
  isActive: boolean
  isSuperAdmin?: boolean
}

export interface UserInput {
  email: string
  password: string
  firstName: string
  lastName: string
  isSuperAdmin?: boolean
}

export class UserService {
  private client: MongoClient
  private db: any

  constructor(client: MongoClient) {
    this.client = client
    this.db = this.client.db()
  }

  async createUser(user: UserInput): Promise<User> {
    const hashedPassword = await bcrypt.hash(user.password, 10)
    const newUser: User = {
      _id: new ObjectId(),
      email: user.email,
      password: hashedPassword,
      firstName: user.firstName,
      lastName: user.lastName,
      createdAt: new Date(),
      lastLogin: new Date(),
      isActive: true,
      isSuperAdmin: user.isSuperAdmin || false,
    }
    await this.db.collection("users").insertOne(newUser)
    return newUser
  }

  async findUserByEmail(email: string): Promise<User | null> {
    return this.db.collection("users").findOne({ email })
  }

  async findUserById(id: string): Promise<User | null> {
    return this.db.collection("users").findOne({ _id: new ObjectId(id) })
  }

  async validateUser(email: string, password: string): Promise<User | null> {
    const user = await this.findUserByEmail(email)
    if (user && (await bcrypt.compare(password, user.password))) {
      return user
    }
    return null
  }

  async getAllUsers(): Promise<User[]> {
    return this.db.collection("users").find({}).toArray()
  }

  async updateUser(userId: string, updateData: Partial<User>): Promise<User | null> {
    const result = await this.db
      .collection("users")
      .findOneAndUpdate(
        { _id: new ObjectId(userId) },
        { $set: { ...updateData, updatedAt: new Date() } },
        { returnDocument: "after" },
      )
    return result
  }

  async toggleSuperAdmin(userId: string, isSuperAdmin: boolean): Promise<User | null> {
    return this.updateUser(userId, { isSuperAdmin })
  }

  async deleteUser(userId: string): Promise<boolean> {
    const result = await this.db.collection("users").deleteOne({ _id: new ObjectId(userId) })
    return result.deletedCount === 1
  }

  // Initialize the first super admin if none exists
  async initializeSuperAdmin(email: string): Promise<void> {
    const existingSuperAdmin = await this.db.collection("users").findOne({ isSuperAdmin: true })

    if (!existingSuperAdmin) {
      const user = await this.findUserByEmail(email)
      if (user) {
        await this.toggleSuperAdmin(user._id.toString(), true)
      }
    }
  }
}

export async function getUserById(id: string): Promise<User | null> {
  const mongoUri = process.env.MONGODB_URI
  if (!mongoUri) {
    throw new Error('Invalid/Missing environment variable: "MONGODB_URI"')
  }

  const client = new MongoClient(mongoUri)

  try {
    await client.connect()
    const userService = new UserService(client)
    return await userService.findUserById(id)
  } catch (error) {
    console.error("Error in getUserById:", error)
    return null
  } finally {
    await client.close()
  }
}

export async function getUserOrganization(userId: string): Promise<any> {
  const mongoUri = process.env.MONGODB_URI
  if (!mongoUri) {
    throw new Error('Invalid/Missing environment variable: "MONGODB_URI"')
  }

  const client = new MongoClient(mongoUri)

  try {
    await client.connect()
    const db = client.db()
    // Get the user's organization from the UserCampaign collection
    const userOrg = await db.collection("userOrganizations").findOne({ userId: new ObjectId(userId) })
    return userOrg
  } catch (error) {
    return null
  } finally {
    await client.close()
  }
}
