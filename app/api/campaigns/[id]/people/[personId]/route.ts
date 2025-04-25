import { type NextRequest, NextResponse } from "next/server"
import clientPromise from "@/lib/mongodb"
import { PersonService } from "@/services/personService"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"

export async function GET(request: NextRequest, { params }: { params: { id: string; personId: string } }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id: campaignId, personId } = params

    const client = await clientPromise
    const personService = new PersonService(client)

    const person = await personService.findPersonById(personId)

    if (!person) {
      return NextResponse.json({ error: "Person not found" }, { status: 404 })
    }

    return NextResponse.json({ person })
  } catch (error) {
    console.error("Error fetching person:", error)
    return NextResponse.json({ error: "Failed to fetch person" }, { status: 500 })
  }
}

// Update the PUT method to increment interactionCount
export async function PUT(request: NextRequest, { params }: { params: { id: string; personId: string } }) {
  try {
    // Skip authentication for chatbot requests
    const isChatbotRequest = request.headers.get("x-source") === "chatbot"
    if (!isChatbotRequest) {
      const session = await getServerSession(authOptions)
      if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
      }
    }

    const { id: campaignId, personId } = params
    const data = await request.json()

    // Add campaignId to the data and increment interactionCount
    const personData = {
      ...data,
      campaignId,
      sessionId: personId,
      // Increment the interactionCount by 1 for each interaction
      $inc: { interactionCount: 1 },
    }

    const client = await clientPromise
    const personService = new PersonService(client)

    // This will create a new person if one doesn't exist
    const updatedPerson = await personService.updatePersonInfo(personId, personData)

    if (!updatedPerson) {
      return NextResponse.json({ error: "Failed to update person" }, { status: 500 })
    }

    return NextResponse.json({ person: updatedPerson })
  } catch (error) {
    console.error("Error updating person:", error)
    return NextResponse.json({ error: "Failed to update person" }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string; personId: string } }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { personId } = params

    const client = await clientPromise
    const personService = new PersonService(client)

    const success = await personService.deletePerson(personId)

    if (!success) {
      return NextResponse.json({ error: "Person not found" }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting person:", error)
    return NextResponse.json({ error: "Failed to delete person" }, { status: 500 })
  }
}
