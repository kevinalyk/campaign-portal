import { Redis } from "@upstash/redis"
import { Ratelimit } from "@upstash/ratelimit"

// Create a Redis client using environment variables
let redis: Redis | null = null
let loginRateLimit: Ratelimit | null = null

// Initialize Redis client only once
try {
  // Use the REST API URL and token for Upstash
  redis = new Redis({
    url: process.env.REDIS_KV_REST_API_URL || "",
    token: process.env.REDIS_KV_REST_API_TOKEN || "",
  })

  // Create a rate limiter that allows 5 requests per minute
  loginRateLimit = new Ratelimit({
    redis,
    limiter: Ratelimit.fixedWindow(5, "1 m"),
    analytics: false, // Disable analytics for better performance
    prefix: "ratelimit:login", // Use a prefix to avoid key collisions
  })

  console.log("Redis client and rate limiter initialized successfully")
} catch (error) {
  console.error("Failed to initialize Redis client:", error)
}

// Helper function to safely apply rate limiting
export async function applyLoginRateLimit(identifier: string): Promise<{
  success: boolean
  limit?: number
  remaining?: number
  reset?: number
}> {
  // If rate limiter is not initialized, allow the request
  if (!loginRateLimit) {
    console.log("Rate limiter not initialized, allowing request")
    return { success: true }
  }

  try {
    // Apply rate limiting
    const result = await loginRateLimit.limit(identifier)
    console.log(`Rate limit for ${identifier}: ${result.remaining}/${result.limit} remaining`)
    return result
  } catch (error) {
    // If rate limiting fails, log the error and allow the request
    console.error("Rate limiting error:", error)
    return { success: true }
  }
}
