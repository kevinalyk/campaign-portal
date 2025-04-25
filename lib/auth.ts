import { SignJWT, jwtVerify } from "jose"
import type { NextRequest } from "next/server"
import { UserService } from "@/services/userService"
import clientPromise from "@/lib/mongodb"
import { CampaignService } from "@/services/campaignService"

interface JWTPayload {
  userId: string
  email: string
  isSuperAdmin?: boolean
  iat: number
  exp: number
}

// Create a JWT token
export async function createJWT(payload: { userId: string; email: string; isSuperAdmin?: boolean }): Promise<string> {
  const iat = Math.floor(Date.now() / 1000)
  const exp = iat + 60 * 60 * 24 * 7 // 7 days

  const secret = new TextEncoder().encode(process.env.JWT_SECRET)

  return new SignJWT({ ...payload, iat, exp })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt(iat)
    .setExpirationTime(exp)
    .sign(secret)
}

// Verify a JWT token
export async function verifyJWT(token: string): Promise<JWTPayload> {
  const secret = new TextEncoder().encode(process.env.JWT_SECRET)

  const { payload } = await jwtVerify(token, secret)
  return payload as JWTPayload
}

// Verify JWT and return user info
export async function verifyAuth(request: NextRequest): Promise<{ isAuthenticated: boolean; user?: JWTPayload }> {
  const token = request.headers.get("Authorization")?.replace("Bearer ", "")

  if (!token) {
    return { isAuthenticated: false }
  }

  try {
    const payload = await verifyJWT(token)
    return { isAuthenticated: true, user: payload }
  } catch (error) {
    return { isAuthenticated: false }
  }
}

export const authOptions = {
  secret: process.env.JWT_SECRET,
  session: {
    strategy: "jwt",
  },
  providers: [],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.userId = user.id
        token.email = user.email
        token.isSuperAdmin = user.isSuperAdmin
      }
      return token
    },
    async session({ session, token }) {
      if (token) {
        session.user.id = token.userId
        session.user.email = token.email
        session.user.isSuperAdmin = token.isSuperAdmin
      }
      return session
    },
  },
}

// Find the checkPermission function and update it to handle URL slugs
export async function checkPermission(
  campaignIdOrUrl: string,
  userId: string,
  requiredRoles: string[] = ["owner", "admin", "editor"],
): Promise<boolean> {
  try {
    const client = await clientPromise
    const campaignService = new CampaignService(client)

    // First check if user is a super admin
    const userService = new UserService(client)
    const user = await userService.findUserById(userId)
    if (user && user.isSuperAdmin) {
      return true // Super admins have permission for everything
    }

    // Determine if we have a campaign ID or URL
    let campaignId = campaignIdOrUrl

    // If it doesn't look like an ObjectId, assume it's a URL and look up the campaign
    if (!campaignIdOrUrl.match(/^[0-9a-fA-F]{24}$/)) {
      const campaign = await campaignService.getCampaignByUrl(campaignIdOrUrl)
      if (!campaign) return false
      campaignId = campaign._id.toString()
    }

    // Check user's role for this campaign
    const userRole = await campaignService.getUserRole(campaignId, userId)

    if (!userRole || !requiredRoles.includes(userRole)) {
      return false
    }

    return true
  } catch (error) {
    console.error("Error checking permission:", error)
    return false
  }
}

export async function verifyJwtToken(token: string): Promise<any> {
  try {
    const secret = new TextEncoder().encode(process.env.JWT_SECRET)
    const { payload } = await jwtVerify(token, secret)
    return payload
  } catch (error) {
    return null
  }
}

// Add the missing verifyToken export function after the verifyJwtToken function

export async function verifyToken(token: string): Promise<JWTPayload | null> {
  try {
    const secret = new TextEncoder().encode(process.env.JWT_SECRET)
    const { payload } = await jwtVerify(token, secret)
    return payload as JWTPayload
  } catch (error) {
    return null
  }
}
