import { type MongoClient, ObjectId } from "mongodb"
import { WebsiteResourceService } from "./websiteResourceService"
import type { SiteMapEntry } from "@/models/SiteMap"

export class HybridCrawlerService {
  private client: MongoClient
  private websiteResourceService: WebsiteResourceService
  private db: any

  constructor(client: MongoClient) {
    this.client = client
    this.websiteResourceService = new WebsiteResourceService(client)
    this.db = this.client.db()
  }

  async getRelevantContent(
    campaignId: string,
    query: string,
    includeSourceInfo = false,
  ): Promise<{ content: string; sources?: { url: string; snippet: string }[] } | null> {
    try {
      // Get all website resources for the campaign
      const resources = await this.websiteResourceService.getWebsiteResourcesByCampaign(campaignId)

      if (!resources || resources.length === 0) {
        console.log(`No website resources found for campaign ${campaignId}`)
        return null
      }

      // Extract content from all resources
      let allContent = ""
      const sources: { url: string; snippet: string }[] = []

      // First, try to find content using the sitemap entries
      const siteMapEntries = await this.findRelevantSiteMapEntries(campaignId, query)

      if (siteMapEntries && siteMapEntries.length > 0) {
        console.log(`Found ${siteMapEntries.length} relevant pages in sitemap`)

        for (const entry of siteMapEntries) {
          // Fetch the actual content for this URL if needed
          const pageContent = await this.fetchPageContent(entry.url)
          if (pageContent) {
            // Log the content length for each URL
            console.log(`Content length for ${entry.url}: ${pageContent.length} characters`)

            const snippet = this.extractRelevantSnippet(pageContent, query, 500)
            allContent += `Page: ${entry.title}\nURL: ${entry.url}\n${snippet}\n\n`

            if (includeSourceInfo) {
              sources.push({
                url: entry.url,
                snippet: this.extractRelevantSnippet(pageContent, query, 200),
              })
            }
          } else {
            console.log(`No content retrieved for ${entry.url}`)
          }
        }

        return { content: allContent, sources: includeSourceInfo ? sources : undefined }
      }

      // Fallback to keyword search in website resources if no sitemap entries found
      console.log("No sitemap entries found, falling back to website resources")
      const keywordResults = await this.findRelevantContentByKeywords(campaignId, query)

      if (keywordResults && keywordResults.length > 0) {
        console.log(`Found ${keywordResults.length} relevant website resources`)

        for (const result of keywordResults) {
          if (result.content) {
            // Log the content for each result
            console.log(`Content for ${result.url || "Unknown URL"}: ${result.content.substring(0, 100)}...`)

            const snippet = this.extractRelevantSnippet(result.content, query, 500)
            allContent += `URL: ${result.url || "Unknown URL"}\n${snippet}\n\n`

            if (includeSourceInfo) {
              sources.push({
                url: result.url || "Unknown URL",
                snippet: this.extractRelevantSnippet(result.content, query, 200),
              })
            }
          } else {
            console.log(`No content for ${result.url || "Unknown URL"}`)
          }
        }

        return { content: allContent, sources: includeSourceInfo ? sources : undefined }
      }

      // If no specific relevant content found, return a sample from each resource
      console.log("No specific relevant content found, returning samples")
      for (const resource of resources) {
        if (resource.content) {
          // Just take the first 500 characters as a sample
          const sample = resource.content.substring(0, 500)
          allContent += `URL: ${resource.url || "Unknown URL"}\n${sample}\n\n`

          if (includeSourceInfo) {
            sources.push({
              url: resource.url || "Unknown URL",
              snippet: sample,
            })
          }
        }
      }

      return { content: allContent, sources: includeSourceInfo ? sources : undefined }
    } catch (error) {
      console.error("Error getting relevant content:", error)
      return null
    }
  }

  private async findRelevantSiteMapEntries(campaignId: string, query: string): Promise<SiteMapEntry[]> {
    try {
      // Extract keywords from the query
      const keywords = this.extractKeywords(query)
      if (keywords.length === 0) return []

      console.log(`Searching sitemap entries for keywords: ${keywords.join(", ")}`)

      // Get all sitemaps for this campaign
      const siteMaps = await this.db
        .collection("siteMaps")
        .find({
          campaignId: new ObjectId(campaignId),
          status: "completed",
        })
        .toArray()

      if (!siteMaps || siteMaps.length === 0) {
        return []
      }

      // Extract all entries from all sitemaps
      const allEntries: SiteMapEntry[] = []
      for (const siteMap of siteMaps) {
        if (siteMap.entries && Array.isArray(siteMap.entries)) {
          allEntries.push(...siteMap.entries)
        }
      }

      if (allEntries.length === 0) {
        return []
      }

      // Score entries based on keyword matches with improved scoring
      const scoredEntries = allEntries.map((entry) => {
        let score = 0
        const entryText =
          `${entry.title || ""} ${entry.description || ""} ${entry.url || ""} ${(entry.keywords || []).join(" ")}`.toLowerCase()

        // Check for exact matches in URL path segments
        const urlPath = entry.url ? new URL(entry.url).pathname.toLowerCase() : ""
        const pathSegments = urlPath.split("/").filter(Boolean)

        for (const segment of pathSegments) {
          if (segment.length > 0) {
            // Higher score for URL path segments that match query terms
            if (query.toLowerCase().includes(segment)) {
              score += 15
            }

            // Check each keyword against path segments
            for (const keyword of keywords) {
              if (segment === keyword) {
                score += 20 // Exact match with path segment
              } else if (segment.includes(keyword)) {
                score += 10 // Partial match with path segment
              }
            }
          }
        }

        // Check for matches in the combined text
        for (const keyword of keywords) {
          // Exact word boundary matches
          const exactRegex = new RegExp(`\\b${keyword}\\b`, "i")
          if (exactRegex.test(entryText)) {
            score += 15
          } else if (entryText.includes(keyword)) {
            score += 5 // Partial match
          }

          // Specific field checks with weighted scoring
          if (entry.title && entry.title.toLowerCase().includes(keyword)) {
            score += 12 // Title matches are important
          }
          if (entry.description && entry.description.toLowerCase().includes(keyword)) {
            score += 8 // Description matches
          }
          if (entry.keywords && entry.keywords.some((k) => k.toLowerCase().includes(keyword))) {
            score += 6 // Keyword matches
          }
        }

        return { entry, score }
      })

      // Log the scores for debugging
      scoredEntries.forEach((item) => {
        console.log(`Score for ${item.entry.url}: ${item.score}`)
      })

      // Filter out entries with zero score and sort by score (highest first)
      return scoredEntries
        .filter((item) => item.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, 5) // Get top 5 results
        .map((item) => item.entry)
    } catch (error) {
      console.error("Error finding relevant sitemap entries:", error)
      return []
    }
  }

  private async findRelevantContentByKeywords(campaignId: string, query: string): Promise<any[]> {
    try {
      // Extract keywords from the query
      const keywords = this.extractKeywords(query)
      if (keywords.length === 0) return []

      console.log(`Searching website resources for keywords: ${keywords.join(", ")}`)

      // Create a more flexible search pattern
      // This will match any of the keywords, making the search more robust
      const keywordPatterns = keywords.map((k) => `(${k.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&")})`)
      const keywordRegex = new RegExp(keywordPatterns.join("|"), "i")

      // Search in website resources
      const resources = await this.db
        .collection("websiteResources")
        .find({
          campaignId: new ObjectId(campaignId),
          $or: [{ content: keywordRegex }, { url: keywordRegex }, { title: keywordRegex }],
        })
        .toArray()

      // If we found resources, score them based on relevance
      if (resources.length > 0) {
        const scoredResources = resources.map((resource) => {
          let score = 0
          const content = resource.content || ""
          const url = resource.url || ""
          const title = resource.title || ""

          // Score based on URL relevance
          if (url) {
            const urlPath = new URL(url).pathname.toLowerCase()
            const pathSegments = urlPath.split("/").filter(Boolean)

            for (const segment of pathSegments) {
              if (segment.length > 0) {
                if (query.toLowerCase().includes(segment)) {
                  score += 15
                }

                for (const keyword of keywords) {
                  if (segment === keyword) {
                    score += 20 // Exact match with path segment
                  } else if (segment.includes(keyword)) {
                    score += 10 // Partial match with path segment
                  }
                }
              }
            }
          }

          // Score based on title
          if (title) {
            for (const keyword of keywords) {
              if (title.toLowerCase().includes(keyword.toLowerCase())) {
                score += 15
              }
            }
          }

          // Score based on content
          for (const keyword of keywords) {
            const regex = new RegExp(keyword, "gi")
            const matches = content.match(regex)
            if (matches) {
              score += matches.length * 2 // More matches = higher score
            }
          }

          return { resource, score }
        })

        // Return resources sorted by score
        return scoredResources.sort((a, b) => b.score - a.score).map((item) => item.resource)
      }

      console.log(`Found ${resources.length} relevant website resources`)
      return resources
    } catch (error) {
      console.error("Error finding relevant content by keywords:", error)
      return []
    }
  }

  private extractKeywords(query: string): string[] {
    // Remove common words and keep only significant terms
    const stopWords = [
      "a",
      "an",
      "the",
      "and",
      "or",
      "but",
      "is",
      "are",
      "was",
      "were",
      "be",
      "been",
      "being",
      "in",
      "on",
      "at",
      "to",
      "for",
      "with",
      "about",
      "against",
      "between",
      "into",
      "through",
      "during",
      "before",
      "after",
      "above",
      "below",
      "from",
      "up",
      "down",
      "of",
      "off",
      "over",
      "under",
      "again",
      "further",
      "then",
      "once",
      "here",
      "there",
      "when",
      "where",
      "why",
      "how",
      "all",
      "any",
      "both",
      "each",
      "few",
      "more",
      "most",
      "other",
      "some",
      "such",
      "no",
      "nor",
      "not",
      "only",
      "own",
      "same",
      "so",
      "than",
      "too",
      "very",
      "s",
      "t",
      "can",
      "will",
      "just",
      "don",
      "should",
      "now",
      "who",
      "what",
      "which",
      "whom",
    ]

    // Extract all potential keywords
    const allKeywords = query
      .toLowerCase()
      .replace(/[^\w\s-]/g, "") // Remove punctuation but keep hyphens
      .split(/\s+/)
      .filter((word) => word.length > 1 && !stopWords.includes(word)) // Keep words of length 2+ that aren't stop words

    // Also extract multi-word phrases (2-3 words)
    const words = query
      .toLowerCase()
      .replace(/[^\w\s-]/g, "")
      .split(/\s+/)
    const phrases = []

    for (let i = 0; i < words.length - 1; i++) {
      // Add 2-word phrases
      if (!stopWords.includes(words[i]) || !stopWords.includes(words[i + 1])) {
        phrases.push(`${words[i]} ${words[i + 1]}`)
      }

      // Add 3-word phrases
      if (
        i < words.length - 2 &&
        (!stopWords.includes(words[i]) || !stopWords.includes(words[i + 1]) || !stopWords.includes(words[i + 2]))
      ) {
        phrases.push(`${words[i]} ${words[i + 1]} ${words[i + 2]}`)
      }
    }

    return [...allKeywords, ...phrases]
  }

  private extractRelevantSnippet(content: string, query: string, maxLength: number): string {
    try {
      if (!content || typeof content !== "string") {
        return ""
      }

      const keywords = this.extractKeywords(query)
      if (keywords.length === 0) {
        return content.substring(0, maxLength)
      }

      // Find all keyword positions
      const positions = []
      for (const keyword of keywords) {
        let pos = content.toLowerCase().indexOf(keyword.toLowerCase())
        while (pos !== -1) {
          positions.push({ position: pos, keyword })
          pos = content.toLowerCase().indexOf(keyword.toLowerCase(), pos + 1)
        }
      }

      // If no keywords found, return the beginning of the content
      if (positions.length === 0) {
        return content.substring(0, maxLength)
      }

      // Sort positions
      positions.sort((a, b) => a.position - b.position)

      // Find clusters of keyword matches
      const clusters = []
      let currentCluster = [positions[0]]

      for (let i = 1; i < positions.length; i++) {
        if (positions[i].position - positions[i - 1].position < 300) {
          // If keywords are close, add to current cluster
          currentCluster.push(positions[i])
        } else {
          // Otherwise, start a new cluster
          clusters.push(currentCluster)
          currentCluster = [positions[i]]
        }
      }

      // Add the last cluster
      if (currentCluster.length > 0) {
        clusters.push(currentCluster)
      }

      // Find the best cluster (most keywords)
      let bestCluster = clusters[0]
      for (const cluster of clusters) {
        if (cluster.length > bestCluster.length) {
          bestCluster = cluster
        }
      }

      // Extract snippet around the best cluster
      const clusterStart = bestCluster[0].position
      const clusterEnd =
        bestCluster[bestCluster.length - 1].position + bestCluster[bestCluster.length - 1].keyword.length

      // Calculate snippet boundaries with context
      const snippetStart = Math.max(0, clusterStart - 150)
      const snippetEnd = Math.min(content.length, clusterEnd + 150)

      let snippet = content.substring(snippetStart, snippetEnd)

      // Try to start at a sentence boundary if not at the beginning
      if (snippetStart > 0) {
        const firstPeriod = snippet.indexOf(". ")
        if (firstPeriod !== -1 && firstPeriod < 50) {
          snippet = snippet.substring(firstPeriod + 2)
        }
      }

      // Try to end at a sentence boundary
      const lastPeriod = snippet.lastIndexOf(". ")
      if (lastPeriod !== -1 && lastPeriod > snippet.length - 50) {
        snippet = snippet.substring(0, lastPeriod + 1)
      }

      // If snippet is too long, trim it
      if (snippet.length > maxLength) {
        snippet = snippet.substring(0, maxLength - 3) + "..."
      }

      return snippet
    } catch (error) {
      console.error("Error extracting relevant snippet:", error)
      return content.substring(0, maxLength)
    }
  }

  async fetchPageContent(url: string): Promise<string | null> {
    try {
      // Check if we have this page in the cache
      const cachedPage = await this.db.collection("pageCache").findOne({
        url,
        expiresAt: { $gt: new Date() },
      })

      if (cachedPage && cachedPage.content) {
        console.log(`Using cached content for ${url}`)

        // Log a preview of the cached content
        if (cachedPage.content.length > 0) {
          console.log(`Cached content preview for ${url}: ${cachedPage.content.substring(0, 100)}...`)
        } else {
          console.log(`Cached content for ${url} is empty`)
        }

        return cachedPage.content
      }

      // If not in cache, try to fetch it
      console.log(`Fetching content for ${url}`)
      const response = await fetch(url, {
        headers: { "User-Agent": "Mozilla/5.0 Campaign Portal Bot" },
      })

      if (!response.ok) {
        console.error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`)
        return null
      }

      const html = await response.text()
      const content = this.extractTextFromHtml(html)

      // Log the extracted content
      if (content && content.length > 0) {
        console.log(`Extracted content preview for ${url}: ${content.substring(0, 100)}...`)
      } else {
        console.log(`Extracted content for ${url} is empty`)
      }

      // Cache the content for future use (expires in 24 hours)
      const now = new Date()
      const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000)

      await this.db.collection("pageCache").updateOne(
        { url },
        {
          $set: {
            url,
            content,
            fetchedAt: now,
            expiresAt,
          },
        },
        { upsert: true },
      )

      return content
    } catch (error) {
      console.error(`Error fetching content for ${url}:`, error)
      return null
    }
  }

  private extractTextFromHtml(html: string): string {
    try {
      if (!html || typeof html !== "string") {
        return ""
      }

      // Remove scripts, styles, and other non-content elements
      let text = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, " ")
      text = text.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, " ")
      text = text.replace(/<head\b[^<]*(?:(?!<\/head>)<[^<]*)*<\/head>/gi, " ")
      text = text.replace(/<nav\b[^<]*(?:(?!<\/nav>)<[^<]*)*<\/nav>/gi, " ")
      text = text.replace(/<footer\b[^<]*(?:(?!<\/footer>)<[^<]*)*<\/footer>/gi, " ")

      // Handle common content areas better
      const contentMatches =
        text.match(/<main\b[^<]*(?:(?!<\/main>)<[^<]*)*<\/main>/gi) ||
        text.match(/<article\b[^<]*(?:(?!<\/article>)<[^<]*)*<\/article>/gi) ||
        text.match(/<div[^>]*content[^>]*>[\s\S]*?<\/div>/gi)

      if (contentMatches && contentMatches.length > 0) {
        // If we found content areas, prioritize those
        text = contentMatches.join(" ")
      }

      // Remove HTML tags but preserve some structure with spaces
      text = text.replace(/<(\/)?p>/gi, " ") // Add space for paragraphs
      text = text.replace(/<(\/)?br\s*\/?>/gi, " ") // Add space for line breaks
      text = text.replace(/<(\/)?li>/gi, " - ") // Add bullet for list items
      text = text.replace(/<(\/)?h[1-6]>/gi, " ") // Add space for headings
      text = text.replace(/<[^>]*>/g, " ") // Remove all other tags

      // Decode HTML entities
      text = text.replace(/&nbsp;/g, " ")
      text = text.replace(/&amp;/g, "&")
      text = text.replace(/&lt;/g, "<")
      text = text.replace(/&gt;/g, ">")
      text = text.replace(/&quot;/g, '"')
      text = text.replace(/&#39;/g, "'")
      text = text.replace(/&rsquo;/g, "'")
      text = text.replace(/&lsquo;/g, "'")
      text = text.replace(/&rdquo;/g, '"')
      text = text.replace(/&ldquo;/g, '"')
      text = text.replace(/&mdash;/g, "—")
      text = text.replace(/&ndash;/g, "–")

      // Normalize whitespace
      text = text.replace(/\s+/g, " ").trim()

      return text
    } catch (error) {
      console.error("Error extracting text from HTML:", error)
      // Fall back to a simpler approach if the enhanced method fails
      return html
        .replace(/<[^>]*>/g, " ")
        .replace(/\s+/g, " ")
        .trim()
    }
  }

  async deleteSiteMapByResourceId(resourceId: string): Promise<boolean> {
    try {
      const result = await this.db.collection("siteMaps").deleteMany({
        websiteResourceId: new ObjectId(resourceId),
      })

      console.log(`Deleted ${result.deletedCount} sitemaps for resource ${resourceId}`)
      return result.deletedCount > 0
    } catch (error) {
      console.error(`Error deleting sitemaps for resource ${resourceId}:`, error)
      return false
    }
  }

  // Other methods remain the same...
}
