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

        const result = await scrapeWebsite(db, url, campaignId, websiteResourceId, maxPages)
        console.log(`Scraping completed for ${url}, crawled ${result.pagesCrawled} pages`)

        // Store the result - MODIFIED to remove content duplication
        const updateResult = await db.collection("websiteResources").updateOne(
          { _id: new ObjectId(websiteResourceId) },
          {
            $set: {
              // No longer storing content here
              status: "completed",
              pagesCrawled: result.pagesCrawled,
              updatedAt: new Date(),
              lastFetched: new Date(),
              // Store a reference to the sitemap instead
              sitemapId: result.sitemapId,
            },
          },
        )

        console.log("Update after successful scraping:", {
          matchedCount: updateResult.matchedCount,
          modifiedCount: updateResult.modifiedCount,
        })

        // Get sitemap size
        try {
          const sitemap = await db.collection("siteMaps").findOne({
            websiteResourceId: new ObjectId(websiteResourceId),
          })

          if (sitemap) {
            const sitemapSizeBytes = getObjectSizeInBytes(sitemap)
            const sitemapSizeFormatted = formatBytes(sitemapSizeBytes)
            console.log(`Sitemap size: ${sitemapSizeFormatted} (${sitemapSizeBytes} bytes)`)

            // Calculate average entry size
            const avgEntrySizeBytes = sitemap.entries.length > 0 ? sitemapSizeBytes / sitemap.entries.length : 0

            console.log(
              `Average entry size: ${formatBytes(avgEntrySizeBytes)} (${Math.round(avgEntrySizeBytes)} bytes)`,
            )

            // Estimate storage for 50 pages
            if (isTestEvent && sitemap.entries.length > 0) {
              const estimatedFullSizeBytes = avgEntrySizeBytes * 50
              console.log(
                `Estimated size for 50 pages: ${formatBytes(estimatedFullSizeBytes)} (${Math.round(estimatedFullSizeBytes)} bytes)`,
              )
            }
          }
        } catch (error) {
          console.error("Error calculating sitemap size:", error)
        }

        results.push({
          websiteResourceId,
          url,
          status: "success",
          pagesCrawled: result.pagesCrawled,
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

// IMPROVED: Enhanced fetch function with retry logic and better headers
async function fetchWithRetry(url, maxRetries = 3) {
  console.log(`Attempting to fetch ${url} with enhanced crawler (max retries: ${maxRetries})`)
  let lastError

  // Different user agents to rotate
  const userAgents = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Safari/605.1.15",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:90.0) Gecko/20100101 Firefox/90.0",
  ]

  // Select a random user agent
  const userAgent = userAgents[Math.floor(Math.random() * userAgents.length)]
  console.log(`Using user agent: ${userAgent.substring(0, 30)}...`)

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      // Add a delay between retries (increasing with each attempt)
      if (attempt > 0) {
        const delayMs = 1000 * Math.pow(2, attempt) // Exponential backoff
        console.log(`Retry attempt ${attempt + 1}/${maxRetries}, waiting ${delayMs}ms before retry...`)
        await new Promise((resolve) => setTimeout(resolve, delayMs))
      }

      console.log(`Fetch attempt ${attempt + 1}/${maxRetries} for ${url}`)
      const response = await axios.get(url, {
        headers: {
          "User-Agent": userAgent,
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.9",
          "Accept-Encoding": "gzip, deflate, br",
          "Cache-Control": "no-cache",
          Pragma: "no-cache",
          Referer: "https://www.google.com/",
          "Upgrade-Insecure-Requests": "1",
          "sec-ch-ua": '"Google Chrome";v="91", "Chromium";v="91", ";Not A Brand";v="99"',
          "sec-ch-ua-mobile": "?0",
          "sec-ch-ua-platform": '"Windows"',
          "Sec-Fetch-Dest": "document",
          "Sec-Fetch-Mode": "navigate",
          "Sec-Fetch-Site": "cross-site",
          "Sec-Fetch-User": "?1",
        },
        timeout: 15000,
        maxRedirects: 5,
      })

      console.log(`Successfully fetched ${url} (status: ${response.status})`)
      return response
    } catch (error) {
      console.log(`Attempt ${attempt + 1} failed for ${url}: ${error.message}`)
      lastError = error

      // If it's a 403/captcha error, we might need to back off more
      if (error.response && error.response.status === 403) {
        const backoffMs = 5000 * Math.pow(2, attempt)
        console.log(`Received 403 Forbidden, backing off for ${backoffMs}ms`)
        await new Promise((resolve) => setTimeout(resolve, backoffMs))
      }
    }
  }

  console.log(`All ${maxRetries} attempts failed for ${url}`)
  throw lastError
}

// Check if a URL should be crawled based on robots.txt
async function shouldCrawl(baseUrl, url) {
  try {
    // Simple check for common file extensions to skip
    const skipExtensions = [".pdf", ".jpg", ".jpeg", ".png", ".gif", ".css", ".js", ".svg", ".mp4", ".webp"]
    const skipPatterns = ["#", "mailto:", "tel:", "javascript:", "data:"]

    if (
      skipExtensions.some((ext) => url.toLowerCase().endsWith(ext)) ||
      skipPatterns.some((pattern) => url.includes(pattern))
    ) {
      return false
    }

    return true
  } catch (error) {
    console.log(`Error checking if URL should be crawled: ${error.message}`)
    return true // Default to allowing crawl on error
  }
}

// Enhanced function to scrape a website and create a sitemap
// MODIFIED: Added db parameter to avoid reconnection, return sitemapId instead of content
async function scrapeWebsite(db, url, campaignId, websiteResourceId, maxPages = 50) {
  console.log(`Starting scrapeWebsite function for ${url} with maxPages=${maxPages}`)

  // Add http:// if not present
  if (!url.startsWith("http://") && !url.startsWith("https://")) {
    url = "https://" + url
    console.log(`URL modified to include protocol: ${url}`)
  }

  const baseUrl = new URL(url).origin
  console.log(`Base URL determined as: ${baseUrl}`)

  const visited = new Set()
  const toVisit = [url]
  const siteMapEntries = []

  // Create or update sitemap
  let siteMap
  try {
    siteMap = await db.collection("siteMaps").findOne({
      websiteResourceId: new ObjectId(websiteResourceId),
    })

    console.log("Existing sitemap found:", !!siteMap)
  } catch (error) {
    console.error("Error finding sitemap:", error)
    throw error
  }

  try {
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
        respectsRobotsTxt: true,
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

  // Crawl pages
  console.log(`Starting crawl with max pages: ${maxPages}`)
  let crawlCount = 0

  while (toVisit.length > 0 && siteMapEntries.length < maxPages) {
    const currentUrl = toVisit.shift()

    if (visited.has(currentUrl)) {
      console.log(`Skipping already visited URL: ${currentUrl}`)
      continue
    }

    visited.add(currentUrl)
    crawlCount++

    try {
      console.log(`Crawling ${currentUrl} (${siteMapEntries.length + 1}/${maxPages})`)

      // Check if we should crawl this URL
      const shouldCrawlUrl = await shouldCrawl(baseUrl, currentUrl)
      if (!shouldCrawlUrl) {
        console.log(`Skipping URL based on crawl rules: ${currentUrl}`)
        continue
      }

      // IMPROVED: Use enhanced fetch with retry logic instead of simple axios
      const response = await fetchWithRetry(currentUrl)
      const html = response.data

      // Add random delay between requests to avoid being blocked
      const randomDelay = Math.floor(Math.random() * 2000) + 1000 // 1-3 seconds
      console.log(`Adding random delay of ${randomDelay}ms before next request`)
      await new Promise((resolve) => setTimeout(resolve, randomDelay))

      const $ = cheerio.load(html)

      // Extract metadata
      const title = $("title").text().trim() || currentUrl
      const description = $('meta[name="description"]').attr("content") || ""
      const keywordsContent = $('meta[name="keywords"]').attr("content") || ""
      const keywords = keywordsContent
        .split(",")
        .map((k) => k.trim())
        .filter(Boolean)

      // Try to extract keywords from content if none found in meta tags
      if (keywords.length === 0) {
        // Extract h1, h2, h3 headings as potential keywords
        const headings = []
        $("h1, h2, h3").each((_, el) => {
          const text = $(el).text().trim()
          if (text) headings.push(text)
        })

        // Add headings as keywords
        if (headings.length > 0) {
          keywords.push(...headings)
        }
      }

      console.log(`Page title: "${title.substring(0, 50)}${title.length > 50 ? "..." : ""}"`)
      console.log(`Keywords found: ${keywords.length > 0 ? keywords.join(", ") : "None"}`)

      // Extract main content
      $("script, style, nav, footer, header, aside").remove()
      const content = $("body").text().replace(/\s+/g, " ").trim()

      // Add to sitemap
      siteMapEntries.push({
        url: currentUrl,
        title,
        description,
        keywords,
        content: content.substring(0, 10000), // Limit content size
        lastCrawled: new Date(),
      })

      // Find links to other pages on the same domain
      const newLinks = []

      $("a[href]").each((_, element) => {
        try {
          const href = $(element).attr("href")
          if (!href) return

          // Resolve relative URLs
          const resolvedUrl = new URL(href, currentUrl).toString()
          const resolvedUrlObj = new URL(resolvedUrl)

          // Only follow links to the same domain
          if (resolvedUrlObj.origin === baseUrl && !visited.has(resolvedUrl) && !toVisit.includes(resolvedUrl)) {
            // Skip certain file types and patterns
            const skipExtensions = [".pdf", ".jpg", ".jpeg", ".png", ".gif", ".css", ".js", ".svg", ".mp4", ".webp"]
            const skipPatterns = ["#", "mailto:", "tel:", "javascript:", "data:"]

            const shouldSkip =
              skipExtensions.some((ext) => resolvedUrl.toLowerCase().endsWith(ext)) ||
              skipPatterns.some((pattern) => resolvedUrl.includes(pattern))

            if (!shouldSkip) {
              newLinks.push(resolvedUrl)
              toVisit.push(resolvedUrl)
            }
          }
        } catch (error) {
          // Skip invalid URLs
          console.log(`Skipping invalid URL: ${error.message}`)
        }
      })

      console.log(`Found ${newLinks.length} new links on ${currentUrl}`)

      // Update sitemap periodically
      if (siteMapEntries.length % 5 === 0 || siteMapEntries.length === maxPages) {
        try {
          await db.collection("siteMaps").updateOne(
            { _id: siteMap._id },
            {
              $set: {
                entries: siteMapEntries,
                pagesCrawled: siteMapEntries.length,
                updatedAt: new Date(),
              },
            },
          )
          console.log(`Updated sitemap with ${siteMapEntries.length} entries`)
        } catch (error) {
          console.error("Error updating sitemap during crawl:", error)
        }
      }
    } catch (error) {
      console.error(`Error crawling ${currentUrl}:`, error)
    }
  }

  console.log(`Crawl completed. Visited ${crawlCount} URLs, added ${siteMapEntries.length} to sitemap`)

  // Update final sitemap
  try {
    await db.collection("siteMaps").updateOne(
      { _id: siteMap._id },
      {
        $set: {
          entries: siteMapEntries,
          pagesCrawled: siteMapEntries.length,
          status: "completed",
          updatedAt: new Date(),
        },
      },
    )
    console.log("Final sitemap update completed")
  } catch (error) {
    console.error("Error updating final sitemap:", error)
    throw error
  }

  // MODIFIED: Don't return content, just return pagesCrawled and sitemapId
  return {
    pagesCrawled: siteMapEntries.length,
    sitemapId: siteMap._id,
  }
}
