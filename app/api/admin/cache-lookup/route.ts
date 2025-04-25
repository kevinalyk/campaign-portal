import { type NextRequest, NextResponse } from "next/server"
import { getMongoClient } from "@/lib/mongodb-server"
import { verifyJWT } from "@/lib/auth"
import { ObjectId } from "mongodb"

// Skip middleware for this route
export const config = {
  matcher: ["/((?!api/admin/cache-lookup).*)"],
}

export async function POST(req: NextRequest) {
  try {
    // Verify authentication
    const token = req.headers.get("authorization")?.replace("Bearer ", "")
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    let payload
    try {
      payload = await verifyJWT(token)
    } catch (error) {
      console.error("JWT verification error:", error)
      return NextResponse.json({ error: "Invalid token" }, { status: 401 })
    }

    if (!payload || !payload.userId) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 })
    }

    // Check if user is a super admin
    const client = await getMongoClient()
    const db = client.db()

    const user = await db.collection("users").findOne({
      _id: new ObjectId(payload.userId),
    })

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    console.log("User found:", user.email, "isSuperAdmin:", user.isSuperAdmin)

    if (!user.isSuperAdmin) {
      return NextResponse.json({ error: "Unauthorized: Super admin access required" }, { status: 403 })
    }

    // Get URL from request body
    const { url } = await req.json()
    if (!url) {
      return NextResponse.json({ error: "URL is required" }, { status: 400 })
    }

    // Look up cache entry
    const cacheEntry = await db.collection("pageCache").findOne({ url })

    if (!cacheEntry) {
      return NextResponse.json({ notFound: true, message: "No cache entry found for this URL" }, { status: 200 })
    }

    // Return the cache entry
    return NextResponse.json(
      {
        url: cacheEntry.url,
        content: cacheEntry.content,
        fetchedAt: cacheEntry.fetchedAt,
        expiresAt: cacheEntry.expiresAt,
      },
      { status: 200 },
    )
  } catch (error) {
    console.error("Error in cache lookup:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    // Verify authentication
    const token = req.headers.get("authorization")?.replace("Bearer ", "")
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    let payload
    try {
      payload = await verifyJWT(token)
    } catch (error) {
      console.error("JWT verification error:", error)
      return NextResponse.json({ error: "Invalid token" }, { status: 401 })
    }

    if (!payload || !payload.userId) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 })
    }

    // Check if user is a super admin
    const client = await getMongoClient()
    const db = client.db()

    const user = await db.collection("users").findOne({
      _id: new ObjectId(payload.userId),
    })

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    if (!user.isSuperAdmin) {
      return NextResponse.json({ error: "Unauthorized: Super admin access required" }, { status: 403 })
    }

    // Get URL from request body
    const { url } = await req.json()
    if (!url) {
      return NextResponse.json({ error: "URL is required" }, { status: 400 })
    }

    // Delete the cache entry
    const result = await db.collection("pageCache").deleteOne({ url })

    if (result.deletedCount === 0) {
      return NextResponse.json({ message: "No cache entry found to delete" }, { status: 200 })
    }

    // Return success
    return NextResponse.json({ message: "Cache entry deleted successfully" }, { status: 200 })
  } catch (error) {
    console.error("Error in cache deletion:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
