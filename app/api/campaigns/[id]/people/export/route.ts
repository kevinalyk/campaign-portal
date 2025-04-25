import { type NextRequest, NextResponse } from "next/server"
import clientPromise from "@/lib/mongodb"
import { PersonService } from "@/services/personService"
import { verifyJwtToken } from "@/lib/auth"

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    // Get the token from the Authorization header
    const authHeader = request.headers.get("Authorization")
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const token = authHeader.substring(7)
    const payload = await verifyJwtToken(token)

    if (!payload) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 })
    }

    const campaignId = params.id
    const searchParams = request.nextUrl.searchParams
    const format = (searchParams.get("format") || "csv") as "csv" | "json"

    // Get isDonor filter if provided
    const isDonorParam = searchParams.get("isDonor")
    let isDonor: boolean | undefined = undefined
    if (isDonorParam === "true") {
      isDonor = true
    } else if (isDonorParam === "false") {
      isDonor = false
    }

    const client = await clientPromise
    const personService = new PersonService(client)

    // Pass the isDonor filter to the exportPeople method
    const data = await personService.exportPeople(campaignId, format, isDonor)

    // Set appropriate headers based on format
    const headers = new Headers()
    if (format === "csv") {
      headers.set("Content-Type", "text/csv")
      headers.set("Content-Disposition", `attachment; filename="people-${campaignId}.csv"`)
    } else {
      headers.set("Content-Type", "application/json")
      headers.set("Content-Disposition", `attachment; filename="people-${campaignId}.json"`)
    }

    return new NextResponse(data, {
      status: 200,
      headers,
    })
  } catch (error) {
    console.error("Error exporting people:", error)
    return NextResponse.json({ error: "Failed to export people" }, { status: 500 })
  }
}
