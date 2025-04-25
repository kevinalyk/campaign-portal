import { type NextRequest, NextResponse } from "next/server"
import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"

export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Parse the request body
    const body = await request.json()
    const { message, queueUrl } = body

    if (!message || !queueUrl) {
      return NextResponse.json({ error: "Missing required fields: message and queueUrl" }, { status: 400 })
    }

    // Initialize SQS client
    const sqsClient = new SQSClient({
      region: process.env.AWS_REGION || "us-east-2",
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "",
      },
    })

    // Create the SQS message command
    const command = new SendMessageCommand({
      QueueUrl: queueUrl,
      MessageBody: JSON.stringify(message),
      MessageAttributes: {
        ResourceType: {
          DataType: "String",
          StringValue: "website",
        },
      },
    })

    // Send the message
    const result = await sqsClient.send(command)

    return NextResponse.json({
      success: true,
      messageId: result.MessageId,
    })
  } catch (error) {
    console.error("Error in queue-website API route:", error)
    return NextResponse.json({ error: error.message || "Failed to queue website" }, { status: 500 })
  }
}
