import { NextResponse } from "next/server"
import { verifyAuth } from "@/lib/auth"
import { getUserById } from "@/services/userService"

export async function GET(request: Request) {
  const { isAuthenticated, user } = await verifyAuth(request)

  if (!isAuthenticated || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const userData = await getUserById(user.userId)
    if (!userData) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    return NextResponse.json({
      email: userData.email,
      id: userData._id,
      firstName: userData.firstName || "",
      lastName: userData.lastName || "",
      isSuperAdmin: userData.isSuperAdmin || false,
    })
  } catch (error) {
    console.error("Error fetching user data:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
