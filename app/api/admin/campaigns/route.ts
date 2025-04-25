import { type NextRequest, NextResponse } from "next/server"
import clientPromise from "@/lib/mongodb"
import { verifyJWT } from "@/lib/auth"

// Helper function to get user from JWT token
async function getUserFromRequest(request: NextRequest): Promise<{ userId: string; isSuperAdmin: boolean } | null> {
  const token = request.headers.get("Authorization")?.replace("Bearer ", "")
  if (!token) return null

  try {
    const payload = await verifyJWT(token)
    return {
      userId: payload.userId,
      isSuperAdmin: payload.isSuperAdmin || false,
    }
  } catch (error) {
    return null
  }
}

// GET /api/admin/campaigns - Get all campaigns (super admin only)
export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
    }

    if (!user.isSuperAdmin) {
      return NextResponse.json({ message: "Forbidden: Super admin access required" }, { status: 403 })
    }

    const client = await clientPromise
    const db = client.db()

    // Fetch all campaigns from the database
    const campaigns = await db.collection("campaigns").find({}).toArray()

    return NextResponse.json({ campaigns })
  } catch (error) {
    console.error("Error fetching all campaigns:", error)
    return NextResponse.json({ message: "Internal server error", error: error.message }, { status: 500 })
  }
}
