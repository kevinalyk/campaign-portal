import { type NextRequest, NextResponse } from "next/server"
import clientPromise from "@/lib/mongodb"
import { UserService } from "@/services/userService"
import { verifyJWT } from "@/lib/auth"

// Helper function to get user ID from JWT token
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

// GET /api/admin/users - Get all users (super admin only)
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
    const userService = new UserService(client)
    const users = await userService.getAllUsers()

    // Remove sensitive information
    const safeUsers = users.map((user) => ({
      id: user._id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      createdAt: user.createdAt,
      lastLogin: user.lastLogin,
      isActive: user.isActive,
      isSuperAdmin: user.isSuperAdmin || false,
    }))

    return NextResponse.json({ users: safeUsers })
  } catch (error) {
    console.error("Error fetching users:", error)
    return NextResponse.json({ message: "Internal server error", error: error.message }, { status: 500 })
  }
}
