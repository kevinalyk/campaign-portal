const { MongoClient, ObjectId } = require("mongodb")
const puppeteer = require("puppeteer-core")
const chromium = require("@sparticuz/chromium")
const { SQSClient, DeleteMessageCommand } = require("@aws-sdk/client-sqs")
const { URL } = require("url")

// Initialize MongoDB client
const cachedDb = null
const mongoClient = null

async function connectToDatabase() {
  // ... existing connection code ...
}

// Main handler function
exports.handler = async (event) => {
  console.log("Lambda function started with enhanced crawler")

  // Connect to MongoDB
  const db = await connectToDatabase()

  const queueUrl = process.env.SQS_QUEUE_URL || process.env.AWS_SQS_QUEUE_URL
  const sqsClient = new SQSClient({
    region: process.env.AWS_REGION || "us-east-1",
  })

  const results = []

  // Process each message
  for (const record of event.Records) {
    try {
      const body = JSON.parse(record.body)
      const { websiteResourceId, url, campaignId } = body

      console.log(`Processing website resource: ${websiteResourceId}, URL: ${url}`)

      // Update status to processing
      await db
        .collection("websiteResources")
        .updateOne({ _id: new ObjectId(websiteResourceId) }, { $set: { status: "processing", updatedAt: new Date() } })

      // Scrape the website using enhanced method
      try {
        console.log(`Starting to scrape website: ${url}`)
        const maxPages = 50
        const result = await scrapeWebsiteEnhanced(url, campaignId, websiteResourceId, maxPages, db)

        // Store the result
        await db.collection("websiteResources").updateOne(
          { _id: new ObjectId(websiteResourceId) },
          {
            $set: {
              content: result.content,
              status: "completed",
              pagesCrawled: result.pagesCrawled,
              updatedAt: new Date(),
              lastFetched: new Date(),
            },
          },
        )

        results.push({
          websiteResourceId,
          url,
          status: "success",
          pagesCrawled: result.pagesCrawled,
        })
      } catch (error) {
        console.error(`Error scraping ${url}:`, error)

        // Update status to failed
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

        results.push({
          websiteResourceId,
          url,
          status: "failed",
          error: error.message,
        })
      }

      // Delete the message from the queue
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
    } catch (error) {
      console.error("Error processing message:", error)
      results.push({
        messageId: record.messageId,
        status: "error",
        error: error.message,
      })
    }
  }

  return {
    statusCode: 200,
    body: JSON.stringify({
      message: "Processing complete",
      results,
    }),
  }
}

// Enhanced function to scrape a website using Puppeteer
async function scrapeWebsiteEnhanced(url, campaignId, websiteResourceId, maxPages = 50, db) {
  console.log(`Starting enhanced scraping for ${url} with maxPages=${maxPages}`)

  // Add http:// if not present
  if (!url.startsWith("http://") && !url.startsWith("https://")) {
    url = "https://" + url
  }

  const baseUrl = new URL(url).origin
  console.log(`Base URL determined as: ${baseUrl}`)

  // Set up browser
  chromium.setGraphicsMode = false
  const browser = await puppeteer.launch({
    args: chromium.args,
    defaultViewport: chromium.defaultViewport,
    executablePath: await chromium.executablePath(),
    headless: chromium.headless,
    ignoreHTTPSErrors: true,
  })

  const visited = new Set()
  const toVisit = [url]
  const siteMapEntries = []

  // Create or update sitemap
  let siteMap = await db.collection("siteMaps").findOne({
    websiteResourceId: new ObjectId(websiteResourceId),
  })

  if (!siteMap) {
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
    siteMap._id = insertResult.insertedId
  } else {
    await db
      .collection("siteMaps")
      .updateOne({ _id: siteMap._id }, { $set: { status: "crawling", updatedAt: new Date() } })
  }

  try {
    // Crawl pages
    console.log(`Starting crawl with max pages: ${maxPages}`)
    let crawlCount = 0

    while (toVisit.length > 0 && siteMapEntries.length < maxPages) {
      const currentUrl = toVisit.shift()

      if (visited.has(currentUrl)) {
        continue
      }

      visited.add(currentUrl)
      crawlCount++

      try {
        console.log(`Crawling ${currentUrl} (${siteMapEntries.length + 1}/${maxPages})`)

        // Use Puppeteer to navigate to the page
        const page = await browser.newPage()

        // Set a realistic user agent
        await page.setUserAgent(
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
        )

        // Set extra headers to appear more like a real browser
        await page.setExtraHTTPHeaders({
          "Accept-Language": "en-US,en;q=0.9",
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8",
          Referer: "https://www.google.com/",
        })

        // Set cookies if needed
        // await page.setCookie(...)

        // Navigate with a timeout
        await page.goto(currentUrl, {
          waitUntil: "networkidle2",
          timeout: 30000,
        })

        // Wait for Cloudflare challenge to resolve if present
        await page
          .waitForFunction(
            () => {
              return (
                !document.querySelector("div.main-wrapper") ||
                !document.querySelector("div.main-wrapper").innerText.includes("Checking your browser")
              )
            },
            { timeout: 30000 },
          )
          .catch((e) => console.log("No Cloudflare challenge or timed out waiting for it"))

        // Extract metadata
        const title = (await page.title()) || currentUrl
        const description = await page.$eval('meta[name="description"]', (el) => el.content).catch(() => "")
        const keywords = await page
          .$eval('meta[name="keywords"]', (el) => el.content)
          .catch(() => "")
          .then((content) =>
            content
              .split(",")
              .map((k) => k.trim())
              .filter(Boolean),
          )

        // Extract headings as potential keywords if no keywords found
        let extractedKeywords = keywords
        if (extractedKeywords.length === 0) {
          extractedKeywords = await page.evaluate(() => {
            const headings = Array.from(document.querySelectorAll("h1, h2, h3"))
            return headings.map((h) => h.textContent.trim()).filter(Boolean)
          })
        }

        // Extract main content
        const content = await page.evaluate(() => {
          // Remove scripts, styles, etc.
          const elementsToRemove = document.querySelectorAll("script, style, nav, footer, header, aside")
          elementsToRemove.forEach((el) => el.remove())
          return document.body.textContent.replace(/\s+/g, " ").trim()
        })

        // Add to sitemap
        siteMapEntries.push({
          url: currentUrl,
          title,
          description,
          keywords: extractedKeywords,
          content: content.substring(0, 10000), // Limit content size
          lastCrawled: new Date(),
        })

        // Find links to other pages on the same domain
        const newLinks = await page.evaluate((baseUrl) => {
          const links = Array.from(document.querySelectorAll("a[href]"))
            .map((a) => a.href)
            .filter((href) => {
              try {
                const url = new URL(href)
                return url.origin === baseUrl
              } catch {
                return false
              }
            })
          return [...new Set(links)] // Remove duplicates
        }, baseUrl)

        // Filter out certain file types and patterns
        const filteredLinks = newLinks.filter((link) => {
          const skipExtensions = [".pdf", ".jpg", ".jpeg", ".png", ".gif", ".css", ".js", ".svg", ".mp4", ".webp"]
          const skipPatterns = ["#", "mailto:", "tel:", "javascript:", "data:"]

          return (
            !skipExtensions.some((ext) => link.toLowerCase().endsWith(ext)) &&
            !skipPatterns.some((pattern) => link.includes(pattern))
          )
        })

        // Add new links to the queue
        for (const link of filteredLinks) {
          if (!visited.has(link) && !toVisit.includes(link)) {
            toVisit.push(link)
          }
        }

        console.log(`Found ${filteredLinks.length} new links on ${currentUrl}`)
        await page.close()

        // Update sitemap periodically
        if (siteMapEntries.length % 5 === 0 || siteMapEntries.length === maxPages) {
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
        }

        // Add a random delay between requests (1-3 seconds)
        const delay = Math.floor(Math.random() * 2000) + 1000
        await new Promise((resolve) => setTimeout(resolve, delay))
      } catch (error) {
        console.error(`Error crawling ${currentUrl}:`, error)
      }
    }

    // Close the browser
    await browser.close()

    // Update final sitemap
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

    // Create a summary of the sitemap for the websiteResource content
    const siteMapSummary = siteMapEntries.map((entry) => ({
      url: entry.url,
      title: entry.title,
      description: entry.description,
      keywords: entry.keywords,
    }))

    return {
      pagesCrawled: siteMapEntries.length,
      content: JSON.stringify(siteMapSummary),
    }
  } catch (error) {
    await browser.close()
    throw error
  }
}
