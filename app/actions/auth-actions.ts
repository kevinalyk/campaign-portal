"use server"

import { cookies } from "next/headers"
import { MongoClient, ObjectId } from "mongodb"
import bcrypt from "bcryptjs"
import { createJWT, verifyJWT } from "@/lib/auth"

// Connect to MongoDB (server-side only)
let client: MongoClient | null = null

async function getMongoClient() {
  if (!process.env.MONGODB_URI) {
    throw new Error("Missing MONGODB_URI environment variable")
  }

  if (!client) {
    client = new MongoClient(process.env.MONGODB_URI)
    await client.connect()
  }
  return client
}

export async function loginUser(formData: FormData) {
  const email = formData.get("email") as string
  const password = formData.get("password") as string
  const redirectPath = (formData.get("redirect") as string) || "/dashboard"

  if (!email || !password) {
    return { success: false, message: "Email and password are required" }
  }

  try {
    const client = await getMongoClient()
    const db = client.db()
    const users = db.collection("users")

    const user = await users.findOne({ email })

    if (!user || !(await bcrypt.compare(password, user.password))) {
      return { success: false, message: "Invalid credentials" }
    }

    // Update last login time
    await users.updateOne({ _id: user._id }, { $set: { lastLogin: new Date() } })

    // Generate JWT token
    const token = await createJWT({
      userId: user._id.toString(),
      email: user.email,
      isSuperAdmin: user.isSuperAdmin || false,
    })

    // Get user's organizations to find default organization
    const userCampaigns = db.collection("userCampaigns")
    const userOrgs = await userCampaigns.find({ userId: user._id.toString() }).toArray()
    const defaultOrgId = userOrgs.length > 0 ? userOrgs[0].campaignId : null

    // Set cookies
    const cookieStore = cookies()

    cookieStore.set("auth_token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 7 * 24 * 60 * 60, // 7 days
      path: "/",
    })

    cookieStore.set(
      "user_info",
      JSON.stringify({
        email: user.email,
        id: user._id.toString(),
        firstName: user.firstName || "",
        lastName: user.lastName || "",
      }),
      {
        httpOnly: false,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        maxAge: 7 * 24 * 60 * 60, // 7 days
        path: "/",
      },
    )

    if (defaultOrgId) {
      cookieStore.set("default_org_id", defaultOrgId, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        maxAge: 7 * 24 * 60 * 60, // 7 days
        path: "/",
      })
    }

    return {
      success: true,
      user: {
        id: user._id.toString(),
        email: user.email,
        firstName: user.firstName || "",
        lastName: user.lastName || "",
        isSuperAdmin: user.isSuperAdmin || false,
      },
      defaultOrganizationId: defaultOrgId,
      redirectPath: redirectPath,
    }
  } catch (error) {
    return { success: false, message: "An error occurred during login" }
  }
}

export async function registerUser(formData: FormData) {
  const email = formData.get("email") as string
  const password = formData.get("password") as string
  const firstName = formData.get("firstName") as string
  const lastName = formData.get("lastName") as string

  if (!email || !password) {
    return { success: false, message: "Email and password are required" }
  }

  try {
    const client = await getMongoClient()
    const db = client.db()
    const users = db.collection("users")

    // Check if user already exists
    const existingUser = await users.findOne({ email })
    if (existingUser) {
      return { success: false, message: "User already exists" }
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10)

    // Check if this is the super admin email
    const isSuperAdmin = email === "kevinalyk@gmail.com"

    // Create new user
    const newUser = {
      email,
      password: hashedPassword,
      firstName: firstName || "",
      lastName: lastName || "",
      createdAt: new Date(),
      lastLogin: new Date(),
      isActive: true,
      isSuperAdmin,
    }

    const result = await users.insertOne(newUser)

    return {
      success: true,
      message: "Registration successful",
      userId: result.insertedId.toString(),
    }
  } catch (error) {
    return { success: false, message: "An error occurred during registration" }
  }
}

export async function logoutUser() {
  const cookieStore = cookies()

  cookieStore.set("auth_token", "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: 0, // Expire immediately
    path: "/",
  })

  cookieStore.set("user_info", "", {
    httpOnly: false,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: 0,
    path: "/",
  })

  cookieStore.set("default_org_id", "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: 0,
    path: "/",
  })

  return { success: true }
}

export async function getCurrentUser() {
  const cookieStore = cookies()
  const token = cookieStore.get("auth_token")?.value

  if (!token) {
    return null
  }

  try {
    const payload = await verifyJWT(token)

    if (!payload || !payload.userId) {
      return null
    }

    const client = await getMongoClient()
    const db = client.db()
    const users = db.collection("users")

    const user = await users.findOne({ _id: new ObjectId(payload.userId) })

    if (!user) {
      return null
    }

    return {
      id: user._id.toString(),
      email: user.email,
      firstName: user.firstName || "",
      lastName: user.lastName || "",
      isSuperAdmin: user.isSuperAdmin || false,
    }
  } catch (error) {
    return null
  }
}

export async function getDefaultOrganization() {
  const cookieStore = cookies()
  const defaultOrgId = cookieStore.get("default_org_id")?.value

  if (!defaultOrgId) {
    return null
  }

  try {
    const client = await getMongoClient()
    const db = client.db()
    const campaigns = db.collection("campaigns")

    const campaign = await campaigns.findOne({ _id: new ObjectId(defaultOrgId) })

    if (!campaign) {
      return null
    }

    return {
      id: campaign._id.toString(),
      name: campaign.name,
    }
  } catch (error) {
    return null
  }
}
