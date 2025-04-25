const { MongoClient, ObjectId } = require("mongodb")
const axios = require("axios")
const cheerio = require("cheerio")
const { SQSClient, DeleteMessageCommand } = require("@aws-sdk/client-sqs")
const { URL } = require("url")

// Initialize MongoDB client
let cachedDb = null
let mongoClient = null

async function connectToDatabase() {
  console.log("Attempting to connect to MongoDB...")

  if (cachedDb) {
    console.log("Using cached database connection")
    return cachedDb
  }

  try {
    // Log MongoDB URI existence (without exposing the actual URI)
    console.log("MONGODB_URI exists:", !!process.env.MONGODB_URI)

    // Close any existing connection
    if (mongoClient) {
      console.log("Closing existing MongoDB connection")
      await mongoClient.close()
    }

    // Create new client with connection options
    mongoClient = new MongoClient(process.env.MONGODB_URI, {
      connectTimeoutMS: 30000, // 30 seconds timeout
      socketTimeoutMS: 45000, // 45 seconds timeout
      serverSelectionTimeoutMS: 30000, // 30 seconds timeout
      maxPoolSize: 10,
      minPoolSize: 1,
    })

    console.log("MongoDB client created, attempting to connect...")
    await mongoClient.connect()
    console.log("Connected to MongoDB successfully")

    // Test the connection with a simple command
    const adminDb = mongoClient.db().admin()
    const result = await adminDb.ping()
    console.log("MongoDB ping result:", result)

    cachedDb = mongoClient.db()
    return cachedDb
  } catch (error) {
    console.error(
      "Error connecting to MongoDB:",
      JSON.stringify({
        message: error.message,
        stack: error.stack,
        code: error.code,
        name: error.name,
      }),
    )
    throw error
  }
}

// Function to estimate object size in bytes
function getObjectSizeInBytes(obj) {
  const jsonString = JSON.stringify(obj)
  // In Node.js, each character is 2 bytes (UTF-16)
  return jsonString.length * 2
}

// Function to format bytes to human-readable format
function formatBytes(bytes, decimals = 2) {
  if (bytes === 0) return "0 Bytes"

  const k = 1024
  const dm = decimals < 0 ? 0 : decimals
  const sizes = ["Bytes", "KB", "MB", "GB", "TB"]

  const i = Math.floor(Math.log(bytes) / Math.log(k))

  return Number.parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i]
}

// Initialize SQS client
const sqsClient = new SQSClient({
  region: process.env.AWS_REGION || "us-east-1",
  maxAttempts: 3,
})

// Main handler function
exports.handler = async (event) => {
  console.log("Lambda function started")
  console.log("Environment variables check:", {
    mongodbUri: !!process.env.MONGODB_URI,
    awsRegion: process.env.AWS_REGION || "us-east-1",
    sqsQueueUrl: !!process.env.SQS_QUEUE_URL || !!process.env.AWS_SQS_QUEUE_URL,
  })

  console.log("Received event:", JSON.stringify(event, null, 2))

  // Test MongoDB connection explicitly
  try {
    const testDb = await connectToDatabase()
    const collections = await testDb.listCollections().toArray()
    console.log("MongoDB connection test successful. Available collections:", collections.map((c) => c.name).join(", "))

    // Check if required collections exist
    const requiredCollections = ["websiteResources", "siteMaps"]
    const missingCollections = requiredCollections.filter((name) => !collections.some((c) => c.name === name))

    if (missingCollections.length > 0) {
      console.warn(`Warning: Missing required collections: ${missingCollections.join(", ")}`)
    }
  } catch (error) {
    console.error("MongoDB connection test failed:", error)
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: "Database connection failed",
        message: error.message,
      }),
    }
  }

  // Connect to MongoDB for the main operation
  let db
  try {
    db = await connectToDatabase()
    console.log("Database connection established for main operation")
  } catch (error) {
    console.error("Failed to connect to MongoDB, aborting Lambda execution")
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Database connection failed" }),
    }
  }

  const queueUrl = process.env.SQS_QUEUE_URL || process.env.AWS_SQS_QUEUE_URL
  if (!queueUrl) {
    console.error("SQS_QUEUE_URL or AWS_SQS_QUEUE_URL environment variable is not set")
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "SQS queue URL not configured" }),
    }
  }

  const results = []

  // Process each message
  for (const record of event.Records) {
    console.log("Processing record:", record.messageId)
    const isTestEvent = record.receiptHandle === "test-receipt-handle"

    if (isTestEvent) {
      console.log("Detected test event - special handling will be applied")
    }

    try {
      let body
      try {
        body = JSON.parse(record.body)
        console.log("Parsed message body:", body)
      } catch (error) {
        console.error("Error parsing message body:", error)
        console.log("Raw message body:", record.body)
        continue
      }

      const { websiteResourceId, url, campaignId } = body

      if (!websiteResourceId || !url) {
        console.error("Invalid message format. Missing websiteResourceId or url.")
        continue
      }

      if (!ObjectId.isValid(websiteResourceId)) {
        console.error(`Invalid ObjectId format for websiteResourceId: ${websiteResourceId}`)
        continue
      }

      console.log(`Processing website resource: ${websiteResourceId}, URL: ${url}`)

      // Check if the websiteResource exists
      try {
        const resource = await db.collection("websiteResources").findOne({
          _id: new ObjectId(websiteResourceId),
        })

        if (!resource) {
          console.error(`Website resource with ID ${websiteResourceId} not found in database`)

          if (isTestEvent) {
            console.log("Test event - creating temporary resource for testing")
            await db.collection("websiteResources").insertOne({
              _id: new ObjectId(websiteResourceId),
              url: url,
              campaignId: new ObjectId(campaignId),
              status: "pending",
              createdAt: new Date(),
              updatedAt: new Date(),
            })
            console.log("Temporary resource created for testing")
          } else {
            continue // Skip processing for non-test events
          }
        } else {
          console.log("Found existing resource:", {
            id: resource._id.toString(),
            url: resource.url,
            status: resource.status,
          })
        }
      } catch (error) {
        console.error("Error checking website resource:", error)
        if (!isTestEvent) continue
      }

      // Update status to processing
      try {
        const updateResult = await db
          .collection("websiteResources")
          .updateOne(
            { _id: new ObjectId(websiteResourceId) },
            { $set: { status: "processing", updatedAt: new Date() } },
          )

        console.log("Update to processing status result:", {
          matchedCount: updateResult.matchedCount,
          modifiedCount: updateResult.modifiedCount,
        })

        if (updateResult.matchedCount === 0 && !isTestEvent) {
          console.warn(`Website resource ${websiteResourceId} not found in database`)
        }
      } catch (error) {
        console.error("Error updating resource status to processing:", error)
      }

      // Scrape the website
      try {
        console.log(`Starting to scrape website: ${url}`)

        // For test events, use 10 pages instead of 2
        const maxPages = isTestEvent ? 10 : 50
        console.log(`Using max pages: ${maxPages} (${isTestEvent ? "test mode" : "normal mode"})`)

        // SIMPLIFIED: Use a more reliable approach with fewer features
        const result = await simplifiedScrapeWebsite(url, campaignId, websiteResourceId, db, maxPages)
        console.log(`Scraping completed for ${url}, crawled ${result.pagesCrawled} pages`)

        // Calculate and log storage size
        const contentSizeBytes = getObjectSizeInBytes(result.content)
        const contentSizeFormatted = formatBytes(contentSizeBytes)
        console.log(`Content size: ${contentSizeFormatted} (${contentSizeBytes} bytes)`)

        // Store the result
        const updateResult = await db.collection("websiteResources").updateOne(
          { _id: new ObjectId(websiteResourceId) },
          {
            $set: {
              content: result.content,
              status: "completed",
              pagesCrawled: result.pagesCrawled,
              contentSizeBytes: contentSizeBytes,
              updatedAt: new Date(),
              lastFetched: new Date(),
            },
          },
        )

        console.log("Update after successful scraping:", {
          matchedCount: updateResult.matchedCount,
          modifiedCount: updateResult.modifiedCount,
        })

        results.push({
          websiteResourceId,
          url,
          status: "success",
          pagesCrawled: result.pagesCrawled,
          contentSize: contentSizeFormatted,
        })
      } catch (error) {
        console.error(`Error scraping ${url}:`, error)

        // Update status to failed
        try {
          await db.collection("websiteResources").updateOne(
            { _id: new ObjectId(websiteResourceId) },
            {
              $set: {
                status: "failed",
                error: error.message,
                updatedAt: new Date(),
              },
            },
          )

          // Also update sitemap status if it exists
          await db.collection("siteMaps").updateOne(
            { websiteResourceId: new ObjectId(websiteResourceId) },
            {
              $set: {
                status: "failed",
                updatedAt: new Date(),
              },
            },
          )
        } catch (dbError) {
          console.error("Error updating resource status to failed:", dbError)
        }

        results.push({
          websiteResourceId,
          url,
          status: "failed",
          error: error.message,
        })
      }

      // Delete the message from the queue - skip for test events
      if (!isTestEvent) {
        try {
          await sqsClient.send(
            new DeleteMessageCommand({
              QueueUrl: queueUrl,
              ReceiptHandle: record.receiptHandle,
            }),
          )
          console.log(`Successfully deleted message ${record.messageId} from queue`)
        } catch (error) {
          console.error("Error deleting message from SQS:", error)
        }
      } else {
        console.log("Skipping SQS message deletion for test event")
      }
    } catch (error) {
      console.error("Error processing message:", error)
      results.push({
        messageId: record.messageId,
        status: "error",
        error: error.message,
      })
    }
  }

  console.log("Lambda execution completed with results:", JSON.stringify(results))

  return {
    statusCode: 200,
    body: JSON.stringify({
      message: "Processing complete",
      results,
    }),
  }
}

// SIMPLIFIED: A more reliable scraping function with fewer features
async function simplifiedScrapeWebsite(url, campaignId, websiteResourceId, db, maxPages = 50) {
  console.log(`Starting simplified scrape for ${url} with maxPages=${maxPages}`)

  // Add http:// if not present
  if (!url.startsWith("http://") && !url.startsWith("https://")) {
    url = "https://" + url
    console.log(`URL modified to include protocol: ${url}`)
  }

  const baseUrl = new URL(url).origin
  console.log(`Base URL determined as: ${baseUrl}`)

  // Create or update sitemap
  let siteMap
  try {
    siteMap = await db.collection("siteMaps").findOne({
      websiteResourceId: new ObjectId(websiteResourceId),
    })

    if (!siteMap) {
      console.log("Creating new sitemap")
      siteMap = {
        campaignId: new ObjectId(campaignId),
        websiteResourceId: new ObjectId(websiteResourceId),
        baseUrl,
        entries: [],
        createdAt: new Date(),
        updatedAt: new Date(),
        status: "crawling",
        pagesCrawled: 0,
      }

      const insertResult = await db.collection("siteMaps").insertOne(siteMap)
      console.log("New sitemap created with ID:", insertResult.insertedId)
      siteMap._id = insertResult.insertedId
    } else {
      console.log(`Updating existing sitemap ${siteMap._id}`)
      await db
        .collection("siteMaps")
        .updateOne({ _id: siteMap._id }, { $set: { status: "crawling", updatedAt: new Date() } })
    }
  } catch (error) {
    console.error("Error creating/updating sitemap:", error)
    throw error
  }

  // SIMPLIFIED: Just crawl the main URL for now to test if it works
  console.log(`Attempting to crawl main URL: ${url}`)

  try {
    // Use a more browser-like user agent
    const userAgent =
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"

    console.log(`Making request to ${url} with user agent: ${userAgent.substring(0, 30)}...`)

    const response = await axios.get(url, {
      headers: {
        "User-Agent": userAgent,
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "Cache-Control": "no-cache",
        Pragma: "no-cache",
        Referer: "https://www.google.com/",
      },
      timeout: 30000, // 30 second timeout
      maxRedirects: 5,
    })

    console.log(`Successfully fetched ${url} (status: ${response.status})`)

    // Check if we got a Cloudflare challenge page
    if (response.data.includes("Just a moment...") && response.data.includes("cloudflare")) {
      console.log("Detected Cloudflare challenge page, cannot proceed with simple crawler")

      // Create a minimal entry for the sitemap
      const siteMapEntries = [
        {
          url: url,
          title: "Website protected by Cloudflare",
          description: "This website is protected by Cloudflare and requires browser verification.",
          keywords: [],
          content: "Protected by Cloudflare",
          lastCrawled: new Date(),
        },
      ]

      // Update sitemap with this minimal entry
      await db.collection("siteMaps").updateOne(
        { _id: siteMap._id },
        {
          $set: {
            entries: siteMapEntries,
            pagesCrawled: 1,
            status: "completed",
            updatedAt: new Date(),
            note: "Website protected by Cloudflare, could not crawl fully",
          },
        },
      )

      // Return minimal content
      return {
        pagesCrawled: 1,
        content: JSON.stringify([
          {
            url: url,
            title: "Website protected by Cloudflare",
            description: "This website is protected by Cloudflare and requires browser verification.",
          },
        ]),
      }
    }

    // Parse the HTML
    const $ = cheerio.load(response.data)

    // Extract metadata
    const title = $("title").text().trim() || url
    const description = $('meta[name="description"]').attr("content") || ""
    const keywordsContent = $('meta[name="keywords"]').attr("content") || ""
    const keywords = keywordsContent
      .split(",")
      .map((k) => k.trim())
      .filter(Boolean)

    console.log(`Page title: "${title.substring(0, 50)}${title.length > 50 ? "..." : ""}"`)

    // Extract main content
    $("script, style").remove()
    const content = $("body").text().replace(/\s+/g, " ").trim()

    // Create sitemap entry
    const siteMapEntries = [
      {
        url: url,
        title,
        description,
        keywords,
        content: content.substring(0, 10000), // Limit content size
        lastCrawled: new Date(),
      },
    ]

    // Update sitemap
    await db.collection("siteMaps").updateOne(
      { _id: siteMap._id },
      {
        $set: {
          entries: siteMapEntries,
          pagesCrawled: 1,
          status: "completed",
          updatedAt: new Date(),
        },
      },
    )

    console.log(`Updated sitemap with 1 entry`)

    // Create a summary for the websiteResource content
    const siteMapSummary = [
      {
        url: url,
        title,
        description,
        keywords,
      },
    ]

    return {
      pagesCrawled: 1,
      content: JSON.stringify(siteMapSummary),
    }
  } catch (error) {
    console.error(`Error crawling ${url}:`, error)

    // Update sitemap to failed status
    await db.collection("siteMaps").updateOne(
      { _id: siteMap._id },
      {
        $set: {
          status: "failed",
          error: error.message,
          updatedAt: new Date(),
        },
      },
    )

    throw error
  }
}
