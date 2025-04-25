import { type NextRequest, NextResponse } from "next/server"
import clientPromise from "@/lib/mongodb"
import { verifyAuth } from "@/lib/auth"
import { ObjectId } from "mongodb"

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    // Verify authentication
    const authResult = await verifyAuth(request)
    if (!authResult.isAuthenticated) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const campaignId = params.id
    const searchParams = request.nextUrl.searchParams

    // Parse query parameters
    const format = searchParams.get("format") || "csv"
    const sessionIds = searchParams.get("sessionIds")?.split(",") || []
    const startDate = searchParams.get("startDate") ? new Date(searchParams.get("startDate") as string) : undefined
    const endDate = searchParams.get("endDate") ? new Date(searchParams.get("endDate") as string) : undefined

    const client = await clientPromise
    const db = client.db()

    // Build the query
    const query: any = { campaignId: new ObjectId(campaignId) }

    if (sessionIds.length > 0) {
      query.sessionId = { $in: sessionIds }
    }

    if (startDate || endDate) {
      query.timestamp = {}
      if (startDate) {
        query.timestamp.$gte = startDate
      }
      if (endDate) {
        query.timestamp.$lte = endDate
      }
    }

    // Get the logs
    const logs = await db
      .collection("chatlogs")
      .find(query)
      .sort({ sessionId: 1, timestamp: 1 })
      .limit(10000) // Reasonable limit for exports
      .toArray()

    // Format the logs
    if (format === "csv") {
      const headers = "sessionId,timestamp,role,message,userIdentifier\n"
      const rows = logs
        .map((log) => {
          return `"${log.sessionId}","${log.timestamp}","${log.role}","${(log.message || "").replace(/"/g, '""')}","${log.userIdentifier || ""}"`
        })
        .join("\n")

      const csv = headers + rows

      return new Response(csv, {
        headers: {
          "Content-Type": "text/csv",
          "Content-Disposition": `attachment; filename="chat-logs-${campaignId}-${new Date().toISOString().split("T")[0]}.csv"`,
        },
      })
    } else {
      return NextResponse.json({ error: "Unsupported format" }, { status: 400 })
    }
  } catch (error) {
    console.error("Error exporting chat logs:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
