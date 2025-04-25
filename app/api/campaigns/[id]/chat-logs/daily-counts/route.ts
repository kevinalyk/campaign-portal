import { type NextRequest, NextResponse } from "next/server"
import clientPromise from "@/lib/mongodb"
import { verifyAuth } from "@/lib/auth"
import { ObjectId } from "mongodb"

export const dynamic = "force-dynamic" // Disable caching for this route

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
    const startDate = searchParams.get("startDate") ? new Date(searchParams.get("startDate") as string) : undefined
    const endDate = searchParams.get("endDate") ? new Date(searchParams.get("endDate") as string) : undefined

    if (!startDate || !endDate) {
      return NextResponse.json({ error: "Start date and end date are required" }, { status: 400 })
    }

    console.log(`Fetching chat data from ${startDate.toISOString()} to ${endDate.toISOString()}`)

    const client = await clientPromise
    const db = client.db()

    // Count unique chat sessions per day (conversations) rather than individual messages
    // This counts the number of unique conversations initiated by users each day
    const pipeline = [
      {
        $match: {
          campaignId: new ObjectId(campaignId),
          timestamp: { $gte: startDate, $lte: endDate },
          role: "user", // Only count messages from users
        },
      },
      {
        // Group by sessionId and date to get unique conversations per day
        $group: {
          _id: {
            sessionId: "$sessionId",
            year: { $year: "$timestamp" },
            month: { $month: "$timestamp" },
            day: { $dayOfMonth: "$timestamp" },
          },
          date: { $first: "$timestamp" },
          firstMessage: { $min: "$timestamp" },
        },
      },
      {
        // Now group by date to count unique conversations per day
        $group: {
          _id: {
            year: { $year: "$date" },
            month: { $month: "$date" },
            day: { $dayOfMonth: "$date" },
          },
          count: { $sum: 1 }, // Count unique conversations
          date: { $first: "$date" },
        },
      },
      {
        $sort: { date: 1 },
      },
      {
        $project: {
          _id: 0,
          date: "$date",
          count: 1,
        },
      },
    ]

    const dailyCounts = await db.collection("chatlogs").aggregate(pipeline).toArray()

    // Log what we found to help debug
    console.log(`Found ${dailyCounts.length} days with chat activity`)

    // Fill in missing dates with zero counts
    const filledDailyCounts = fillMissingDates(startDate, endDate, dailyCounts)

    // Set cache control headers to prevent caching
    return new NextResponse(JSON.stringify({ dailyCounts: filledDailyCounts }), {
      headers: {
        "Cache-Control": "no-store, max-age=0",
        "Content-Type": "application/json",
      },
    })
  } catch (error) {
    console.error("Error retrieving daily chat counts:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// Helper function to fill in missing dates with zero counts
function fillMissingDates(startDate: Date, endDate: Date, dailyCounts: any[]) {
  const result = []
  const currentDate = new Date(startDate)

  // Create a map of existing dates with their counts
  const dateMap = new Map()
  dailyCounts.forEach((item) => {
    const dateKey = new Date(item.date).toISOString().split("T")[0]
    dateMap.set(dateKey, item.count)
  })

  // Fill in all dates in the range
  while (currentDate <= endDate) {
    const dateKey = currentDate.toISOString().split("T")[0]
    result.push({
      date: new Date(currentDate),
      count: dateMap.has(dateKey) ? dateMap.get(dateKey) : 0,
    })

    // Move to next day
    currentDate.setDate(currentDate.getDate() + 1)
  }

  return result
}
