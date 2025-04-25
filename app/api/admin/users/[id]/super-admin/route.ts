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

// PATCH /api/admin/users/[id]/super-admin - Toggle super admin status
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
    }

    if (!user.isSuperAdmin) {
      return NextResponse.json({ message: "Forbidden: Super admin access required" }, { status: 403 })
    }

    const targetUserId = params.id
    const body = await request.json()
    const { isSuperAdmin } = body

    if (typeof isSuperAdmin !== "boolean") {
      return NextResponse.json({ message: "Invalid request: isSuperAdmin must be a boolean" }, { status: 400 })
    }

    const client = await clientPromise
    const userService = new UserService(client)

    // Don't allow removing super admin status from yourself
    if (targetUserId === user.userId && !isSuperAdmin) {
      return NextResponse.json(
        {
          message: "Cannot remove super admin status from yourself",
        },
        { status: 400 },
      )
    }

    const updatedUser = await userService.toggleSuperAdmin(targetUserId, isSuperAdmin)

    if (!updatedUser) {
      return NextResponse.json({ message: "User not found" }, { status: 404 })
    }

    return NextResponse.json({
      message: `Super admin status ${isSuperAdmin ? "granted" : "revoked"} successfully`,
      user: {
        id: updatedUser._id,
        email: updatedUser.email,
        firstName: updatedUser.firstName,
        lastName: updatedUser.lastName,
        isSuperAdmin: updatedUser.isSuperAdmin,
      },
    })
  } catch (error) {
    console.error("Error updating super admin status:", error)
    return NextResponse.json({ message: "Internal server error", error: error.message }, { status: 500 })
  }
}
