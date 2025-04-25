import { type NextRequest, NextResponse } from "next/server"
import { MongoClient } from "mongodb"
import bcrypt from "bcryptjs"
import { createJWT } from "@/lib/auth"
import { initializeSuperAdmin } from "@/scripts/init-super-admin"
import { applyLoginRateLimit } from "@/lib/rate-limit"

if (!process.env.MONGODB_URI) {
  throw new Error('Invalid/Missing environment variable: "MONGODB_URI"')
}

const uri = process.env.MONGODB_URI
const options = {}

let client
let clientPromise: Promise<MongoClient>

if (process.env.NODE_ENV === "development") {
  if (!global._mongoClientPromise) {
    client = new MongoClient(uri, options)
    global._mongoClientPromise = client.connect()
  }
  clientPromise = global._mongoClientPromise
} else {
  client = new MongoClient(uri, options)
  clientPromise = client.connect()
}

export async function GET() {
  return NextResponse.json({ message: "API is working" })
}

export async function POST(request: NextRequest) {
  const body = await request.json()
  const { action, email, password, firstName, lastName, termsAccepted } = body

  // Only apply rate limiting for login attempts
  if (action === "login") {
    const ip = request.ip || "127.0.0.1"
    // Use both IP and email for more precise rate limiting
    const identifier = `${ip}:${email}`

    // Apply rate limiting - 5 attempts per minute
    const rateLimitResult = applyLoginRateLimit(identifier, 5, 60 * 1000)

    if (!rateLimitResult.success) {
      return NextResponse.json(
        { message: "Too many login attempts. Please try again later." },
        {
          status: 429,
          headers: {
            "Retry-After": Math.ceil((rateLimitResult.reset - Date.now()) / 1000).toString(),
          },
        },
      )
    }
  }

  try {
    const client = await clientPromise
    const db = client.db()
    const users = db.collection("users")

    // Initialize super admin on each auth request (will only run once)
    await initializeSuperAdmin()

    if (action === "login") {
      const user = await users.findOne({ email })
      if (user && (await bcrypt.compare(password, user.password))) {
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

        // Create response
        const response = NextResponse.json(
          {
            message: "Login successful",
            user: {
              email: user.email,
              id: user._id,
              firstName: user.firstName || "",
              lastName: user.lastName || "",
              isSuperAdmin: user.isSuperAdmin || false,
            },
            token,
          },
          { status: 200 },
        )

        // Set cookies directly in the response
        response.cookies.set("auth_token", token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "lax", // Changed from strict to lax for better cross-site compatibility
          maxAge: 7 * 24 * 60 * 60, // 7 days
          path: "/",
        })

        response.cookies.set(
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
            sameSite: "lax",
            maxAge: 7 * 24 * 60 * 60, // 7 days
            path: "/",
          },
        )

        if (defaultOrgId) {
          response.cookies.set("default_org_id", defaultOrgId, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax",
            maxAge: 7 * 24 * 60 * 60, // 7 days
            path: "/",
          })
        }

        return response
      } else {
        return NextResponse.json({ message: "Invalid credentials" }, { status: 401 })
      }
    } else if (action === "register") {
      const existingUser = await users.findOne({ email })
      if (existingUser) {
        return NextResponse.json({ message: "User already exists" }, { status: 400 })
      }
      const hashedPassword = await bcrypt.hash(password, 10)

      const isSuperAdmin = email === "kevinalyk@gmail.com"
      const newUser = {
        email,
        password: hashedPassword,
        firstName: firstName || "",
        lastName: lastName || "",
        createdAt: new Date(),
        lastLogin: new Date(),
        isActive: true,
        isSuperAdmin: isSuperAdmin, // This will be true for kevinalyk@gmail.com
        termsAccepted: new Date(),
      }

      const result = await users.insertOne(newUser)

      // Generate JWT token
      const token = await createJWT({
        userId: result.insertedId.toString(),
        email,
        isSuperAdmin: isSuperAdmin,
      })

      return NextResponse.json(
        {
          message: "User created successfully",
          user: {
            email,
            id: result.insertedId,
            firstName: firstName || "",
            lastName: lastName || "",
            isSuperAdmin: isSuperAdmin,
          },
          token,
        },
        { status: 201 },
      )
    } else {
      return NextResponse.json({ message: "Invalid action" }, { status: 400 })
    }
  } catch (error) {
    return NextResponse.json({ message: "Internal server error", error: error.message }, { status: 500 })
  }
}
