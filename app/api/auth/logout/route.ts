import { NextResponse } from "next/server"
import { serialize } from "cookie"

export async function POST() {
  const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict" as const,
    maxAge: 0,
    path: "/",
  }

  const response = NextResponse.json({ message: "Logged out successfully" })
  response.headers.set("Set-Cookie", serialize("token", "", cookieOptions))
  return response
}
