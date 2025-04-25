import { type NextRequest, NextResponse } from "next/server"
import clientPromise from "@/lib/mongodb"
import { UserService } from "@/services/userService"
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

// GET /api/admin/users/[id] - Get a specific user (super admin only)
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
    }

    if (!user.isSuperAdmin) {
      return NextResponse.json({ message: "Forbidden: Super admin access required" }, { status: 403 })
    }

    const userId = params.id

    const client = await clientPromise
    const userService = new UserService(client)
    const targetUser = await userService.findUserById(userId)

    if (!targetUser) {
      return NextResponse.json({ message: "User not found" }, { status: 404 })
    }

    // Return user without sensitive information
    return NextResponse.json({
      user: {
        id: targetUser._id,
        email: targetUser.email,
        firstName: targetUser.firstName,
        lastName: targetUser.lastName,
        createdAt: targetUser.createdAt,
        lastLogin: targetUser.lastLogin,
        isActive: targetUser.isActive,
        isSuperAdmin: targetUser.isSuperAdmin || false,
      },
    })
  } catch (error) {
    console.error("Error fetching user:", error)
    return NextResponse.json({ message: "Internal server error", error: error.message }, { status: 500 })
  }
}

// DELETE /api/admin/users/[id] - Delete a user (super admin only)
export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const currentUser = await getUserFromRequest(request)
    if (!currentUser) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
    }

    if (!currentUser.isSuperAdmin) {
      return NextResponse.json({ message: "Forbidden: Super admin access required" }, { status: 403 })
    }

    const userId = params.id

    // Prevent deleting yourself
    if (userId === currentUser.userId) {
      return NextResponse.json({ message: "Cannot delete your own account" }, { status: 400 })
    }

    const client = await clientPromise
    const userService = new UserService(client)

    // Check if user exists and is not a super admin
    const targetUser = await userService.findUserById(userId)
    if (!targetUser) {
      return NextResponse.json({ message: "User not found" }, { status: 404 })
    }

    // Prevent deleting other super admins
    if (targetUser.isSuperAdmin) {
      return NextResponse.json({ message: "Cannot delete another super admin" }, { status: 400 })
    }

    // Delete the user
    const deleted = await userService.deleteUser(userId)

    if (!deleted) {
      return NextResponse.json({ message: "Failed to delete user" }, { status: 500 })
    }

    // Delete all user-campaign relationships
    const db = client.db()
    await db.collection("userCampaigns").deleteMany({ userId: targetUser._id })

    return NextResponse.json({ message: "User deleted successfully" })
  } catch (error) {
    console.error("Error deleting user:", error)
    return NextResponse.json({ message: "Internal server error", error: error.message }, { status: 500 })
  }
}

// PATCH /api/admin/users/[id]/status - Update user active status (super admin only)
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const currentUser = await getUserFromRequest(request)
    if (!currentUser) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
    }

    if (!currentUser.isSuperAdmin) {
      return NextResponse.json({ message: "Forbidden: Super admin access required" }, { status: 403 })
    }

    const userId = params.id

    // Prevent modifying yourself
    if (userId === currentUser.userId) {
      return NextResponse.json({ message: "Cannot modify your own account status" }, { status: 400 })
    }

    const body = await request.json()
    const { isActive } = body

    if (typeof isActive !== "boolean") {
      return NextResponse.json({ message: "Invalid request: isActive must be a boolean" }, { status: 400 })
    }

    const client = await clientPromise
    const userService = new UserService(client)

    // Check if user exists
    const targetUser = await userService.findUserById(userId)
    if (!targetUser) {
      return NextResponse.json({ message: "User not found" }, { status: 404 })
    }

    // Update user status
    const updatedUser = await userService.updateUser(userId, { isActive })

    if (!updatedUser) {
      return NextResponse.json({ message: "Failed to update user status" }, { status: 500 })
    }

    return NextResponse.json({
      message: `User ${isActive ? "activated" : "deactivated"} successfully`,
      user: {
        id: updatedUser._id,
        email: updatedUser.email,
        firstName: updatedUser.firstName,
        lastName: updatedUser.lastName,
        isActive: updatedUser.isActive,
      },
    })
  } catch (error) {
    console.error("Error updating user status:", error)
    return NextResponse.json({ message: "Internal server error", error: error.message }, { status: 500 })
  }
}
