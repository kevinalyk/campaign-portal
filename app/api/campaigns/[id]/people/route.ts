import { type NextRequest, NextResponse } from "next/server"
import clientPromise from "@/lib/mongodb"
import { PersonService } from "@/services/personService"
import { verifyAuth, checkPermission } from "@/lib/auth"

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    // Use our custom JWT authentication
    const { isAuthenticated, user } = await verifyAuth(request)

    if (!isAuthenticated || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Check if user has permission to access this campaign
    const hasPermission = await checkPermission(params.id, user.userId)
    if (!hasPermission) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const campaignId = params.id
    const searchParams = request.nextUrl.searchParams

    const limit = Number.parseInt(searchParams.get("limit") || "20")
    const skip = Number.parseInt(searchParams.get("skip") || "0")
    const sortField = searchParams.get("sortField") || "lastInteraction"
    const sortDirection = (searchParams.get("sortDirection") || "desc") as "asc" | "desc"
    const search = searchParams.get("search") || ""

    // Only set isDonor filter if explicitly requested in the query params
    const isDonor = searchParams.has("isDonor") ? searchParams.get("isDonor") === "true" : undefined

    console.log("People API request params:", {
      campaignId,
      limit,
      skip,
      sortField,
      sortDirection,
      search,
      isDonor,
      rawIsDonor: searchParams.get("isDonor"),
      hasIsDonor: searchParams.has("isDonor"),
    })

    const client = await clientPromise
    const personService = new PersonService(client)

    // Debug: Count all people with this campaignId without any filters
    const db = client.db("test")
    const totalInCampaign = await db.collection("people").countDocuments({ campaignId })
    console.log(`Total people in campaign ${campaignId}: ${totalInCampaign}`)

    const result = await personService.getPeople(campaignId, {
      limit,
      skip,
      sortField,
      sortDirection,
      search,
      isDonor,
    })

    console.log(`Filtered results: ${result.total} people found`)

    return NextResponse.json(result)
  } catch (error) {
    console.error("Error fetching people:", error)
    return NextResponse.json(
      { error: "Failed to fetch people", details: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    )
  }
}

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    // Use our custom JWT authentication
    const { isAuthenticated, user } = await verifyAuth(request)

    if (!isAuthenticated || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Check if user has permission to access this campaign
    const hasPermission = await checkPermission(params.id, user.userId)
    if (!hasPermission) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const campaignId = params.id
    const data = await request.json()

    const client = await clientPromise
    const personService = new PersonService(client)

    const person = await personService.createPerson({
      ...data,
      campaignId,
    })

    return NextResponse.json({ person })
  } catch (error) {
    console.error("Error creating person:", error)
    return NextResponse.json(
      { error: "Failed to create person", details: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    )
  }
}
