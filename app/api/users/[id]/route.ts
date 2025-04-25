import { type NextRequest, NextResponse } from "next/server"
import clientPromise from "@/lib/mongodb"
import { UserService } from "@/services/userService"
import { verifyJWT } from "@/lib/auth"

// Helper function to get user ID from JWT token
async function getUserIdFromRequest(request: NextRequest): Promise<string | null> {
  const token = request.headers.get("Authorization")?.replace("Bearer ", "")
  if (!token) return null

  try {
    const payload = await verifyJWT(token)
    return payload.userId
  } catch (error) {
    return null
  }
}

// GET /api/users/[id] - Get user information
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const currentUserId = await getUserIdFromRequest(request)
    if (!currentUserId) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
    }

    const userId = params.id
    const client = await clientPromise
    const userService = new UserService(client)
    const user = await userService.findUserById(userId)

    if (!user) {
      return NextResponse.json({ message: "User not found" }, { status: 404 })
    }

    // Return only safe user information (no password)
    return NextResponse.json({
      user: {
        id: user._id,
        email: user.email,
        firstName: user.firstName || "",
        lastName: user.lastName || "",
      },
    })
  } catch (error) {
    return NextResponse.json({ message: "Internal server error", error: error.message }, { status: 500 })
  }
}
