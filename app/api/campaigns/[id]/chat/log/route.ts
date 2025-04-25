import { type NextRequest, NextResponse } from "next/server"
import clientPromise from "@/lib/mongodb"
import { ObjectId } from "mongodb"
import { v4 as uuidv4 } from "uuid"

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const campaignId = params.id
    const { message, role, sessionId = uuidv4(), userIdentifier, metadata } = await request.json()

    if (!message || !role) {
      return NextResponse.json({ error: "Message and role are required" }, { status: 400 })
    }

    const client = await clientPromise
    const db = client.db()

    // Create the chat log
    const chatLog = {
      campaignId: new ObjectId(campaignId),
      sessionId,
      userIdentifier,
      message,
      role,
      timestamp: new Date(),
      metadata,
    }

    await db.collection("ChatLog").insertOne(chatLog)

    return NextResponse.json({ success: true, sessionId })
  } catch (error) {
    console.error("Error logging chat message:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
