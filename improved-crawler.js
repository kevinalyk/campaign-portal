// In your existing lambda-index.js file, replace the axios request with:
const axios = require("axios")

async function fetchWithRetry(url, maxRetries = 3) {
  let lastError

  // Different user agents to rotate
  const userAgents = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Safari/605.1.15",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:90.0) Gecko/20100101 Firefox/90.0",
  ]

  // Select a random user agent
  const userAgent = userAgents[Math.floor(Math.random() * userAgents.length)]

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      // Add a delay between retries (increasing with each attempt)
      if (attempt > 0) {
        await new Promise((resolve) => setTimeout(resolve, 1000 * attempt))
      }

      return await axios.get(url, {
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
        timeout: 10000,
        maxRedirects: 5,
      })
    } catch (error) {
      console.log(`Attempt ${attempt + 1} failed: ${error.message}`)
      lastError = error

      // If it's a 403/captcha error, we might need to back off more
      if (error.response && error.response.status === 403) {
        await new Promise((resolve) => setTimeout(resolve, 5000))
      }
    }
  }

  throw lastError
}
