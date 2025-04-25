import type { MongoClient } from "mongodb"
import { SQSClient, SendMessageCommand, GetQueueAttributesCommand } from "@aws-sdk/client-sqs"
import { WebsiteResourceService } from "./websiteResourceService"

export class AwsScraperService {
  private client: MongoClient
  private sqsClient: SQSClient
  private sqsQueueUrl: string
  private websiteResourceService: WebsiteResourceService
  private processingResources: Set<string> = new Set()
  private isFifoQueue = false

  constructor(client: MongoClient) {
    this.client = client
    this.websiteResourceService = new WebsiteResourceService(client)

    // Get the SQS queue URL from environment variables
    this.sqsQueueUrl = process.env.SQS_QUEUE_URL || ""

    // Check if this is a FIFO queue (ends with .fifo)
    this.isFifoQueue = this.sqsQueueUrl.endsWith(".fifo")
    console.log(`🔍 Queue type: ${this.isFifoQueue ? "FIFO" : "Standard"} Queue`)

    // Extract region from SQS queue URL
    let region = "us-east-1" // Default region
    try {
      if (this.sqsQueueUrl) {
        const urlParts = this.sqsQueueUrl.split(".")
        if (urlParts.length > 2 && urlParts[1].startsWith("sqs")) {
          region = urlParts[1].replace("sqs.", "")
          console.log(`🔍 Extracted region from SQS URL: ${region}`)
        }
      }
    } catch (error) {
      console.error("❌ Error extracting region from SQS URL:", error)
    }

    console.log(`🔧 Initializing SQS client with region: ${region}`)
    console.log(
      `🔑 Using AWS credentials: ${process.env.AWS_ACCESS_KEY_ID ? "Access Key Present" : "Missing Access Key"}, ${process.env.AWS_SECRET_ACCESS_KEY ? "Secret Key Present" : "Missing Secret Key"}`,
    )

    // Initialize the SQS client
    this.sqsClient = new SQSClient({
      region: process.env.AWS_REGION || region,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "",
      },
    })
  }

  // Test SQS connection
  async testSQSConnection(): Promise<boolean> {
    if (!this.sqsQueueUrl) {
      console.error("❌ SQS Queue URL is not defined")
      return false
    }

    try {
      console.log(`🧪 Testing SQS connection to queue: ${this.sqsQueueUrl}`)

      // Try to get queue attributes as a simple test
      const command = new GetQueueAttributesCommand({
        QueueUrl: this.sqsQueueUrl,
        AttributeNames: ["QueueArn"],
      })

      const response = await this.sqsClient.send(command)
      console.log(`✅ SQS connection test successful. Queue ARN: ${response.Attributes?.QueueArn}`)
      return true
    } catch (error) {
      console.error("❌ SQS connection test failed:", error)
      return false
    }
  }

  async queueWebsiteForScraping(websiteResourceId: string): Promise<void> {
    try {
      // Check if this resource is already being processed
      if (this.processingResources.has(websiteResourceId)) {
        console.log(`⚠️ Resource ${websiteResourceId} is already being queued, skipping duplicate request`)
        return
      }

      // Add to processing set
      this.processingResources.add(websiteResourceId)

      console.log(`🔍 Queueing website resource for scraping: ${websiteResourceId}`)

      // Get the website resource
      const resource = await this.websiteResourceService.getWebsiteResource(websiteResourceId)

      if (!resource) {
        console.error(`❌ Website resource not found: ${websiteResourceId}`)
        this.processingResources.delete(websiteResourceId)
        throw new Error(`Website resource not found: ${websiteResourceId}`)
      }

      console.log(`✅ Found website resource: ${resource.url}`)

      // Update the resource status to "processing"
      await this.websiteResourceService.updateWebsiteResourceStatus(websiteResourceId, "processing")
      console.log(`✅ Updated resource status to "processing"`)

      // Prepare the message
      const message = {
        websiteResourceId,
        campaignId: resource.campaignId.toString(),
        url: resource.url,
        timestamp: new Date().toISOString(),
      }

      console.log(`📝 Prepared SQS message:`, message)
      console.log(`🚀 Sending message to SQS queue: ${this.sqsQueueUrl}`, message)

      if (!this.sqsQueueUrl) {
        console.error("❌ SQS Queue URL is not defined")
        // Simulate success for development/testing
        console.log("⚠️ Simulating successful queue operation due to missing SQS Queue URL")
        this.processingResources.delete(websiteResourceId)
        return
      }

      // Send the message to SQS
      try {
        // Create the base command
        const commandParams: any = {
          QueueUrl: this.sqsQueueUrl,
          MessageBody: JSON.stringify(message),
        }

        // Add FIFO-specific attributes only if using a FIFO queue
        if (this.isFifoQueue) {
          console.log("🔄 Adding FIFO queue attributes")
          commandParams.MessageDeduplicationId = `${websiteResourceId}-${Date.now()}`
          commandParams.MessageGroupId = `resource-${websiteResourceId}`
        }

        const command = new SendMessageCommand(commandParams)
        const result = await this.sqsClient.send(command)
        console.log(`✅ Message sent to SQS. MessageId: ${result.MessageId}`)
      } catch (sqsError) {
        console.error("❌ Error sending message to SQS:", sqsError)
        console.log("⚠️ Continuing despite SQS error to prevent application failure")
        // Don't throw here to prevent application failure
      }

      // Remove from processing set after completion
      this.processingResources.delete(websiteResourceId)
    } catch (error) {
      console.error(`❌ Error queueing website for scraping:`, error)
      // Update the resource status to "error"
      try {
        await this.websiteResourceService.updateWebsiteResourceStatus(
          websiteResourceId,
          "error",
          error.message || "Unknown error",
        )
        console.log(`✅ Updated resource status to "error"`)
      } catch (updateError) {
        console.error(`❌ Error updating resource status:`, updateError)
      }

      // Remove from processing set on error
      this.processingResources.delete(websiteResourceId)
      throw error
    }
  }

  async checkScrapingStatus(websiteResourceId: string): Promise<string> {
    try {
      const resource = await this.websiteResourceService.getWebsiteResource(websiteResourceId)
      if (!resource) {
        return "not_found"
      }
      return resource.status || "unknown"
    } catch (error) {
      console.error(`Error checking scraping status:`, error)
      return "error"
    }
  }
}
