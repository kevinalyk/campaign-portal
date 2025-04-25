// Simple in-memory rate limiting implementation
// This doesn't persist across server restarts but provides basic protection
// without external dependencies

interface RateLimitRecord {
  count: number
  timestamp: number
}

// Store rate limit records in memory
const loginAttempts = new Map<string, RateLimitRecord>()

// Clean up old records periodically (every 5 minutes)
setInterval(
  () => {
    const now = Date.now()
    const windowMs = 60 * 1000 // 1 minute window

    for (const [key, record] of loginAttempts.entries()) {
      if (now - record.timestamp > windowMs) {
        loginAttempts.delete(key)
      }
    }
  },
  5 * 60 * 1000,
)

/**
 * Apply rate limiting for login attempts
 * @param identifier Unique identifier for the request (e.g., IP + email)
 * @param limit Maximum number of attempts allowed in the time window
 * @param windowMs Time window in milliseconds
 * @returns Object indicating if the request should be allowed
 */
export function applyLoginRateLimit(
  identifier: string,
  limit = 5,
  windowMs: number = 60 * 1000,
): {
  success: boolean
  remaining: number
  reset: number
} {
  const now = Date.now()

  // Get or create record
  const record = loginAttempts.get(identifier) || { count: 0, timestamp: now }

  // Reset if outside window
  if (now - record.timestamp > windowMs) {
    record.count = 0
    record.timestamp = now
  }

  // Increment count
  record.count++

  // Store updated record
  loginAttempts.set(identifier, record)

  // Calculate remaining attempts and reset time
  const remaining = Math.max(0, limit - record.count)
  const reset = record.timestamp + windowMs

  // Return result
  return {
    success: record.count <= limit,
    remaining,
    reset,
  }
}
