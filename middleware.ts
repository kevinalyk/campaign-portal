import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

// Paths that don't require authentication
const publicPaths = [
  "/",
  "/login",
  "/api/auth",
  "/embed/chatbot",
  "/api/embed",
  "/api/embed-script",
  "/api/public",
  "/terms-of-service",
  "/privacy-policy",
]

// Check if the path is public
const isPublicPath = (path: string) => {
  return publicPaths.some((publicPath) => path === publicPath || path.startsWith(`${publicPath}/`))
}

export function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname

  // Special handling for embed routes to allow iframe embedding
  if (path.startsWith("/embed/")) {
    // Create a new response with modified headers
    const response = NextResponse.next()

    // Remove X-Frame-Options to allow embedding in iframes
    response.headers.delete("X-Frame-Options")

    // Add Content-Security-Policy with frame-ancestors to allow embedding
    // Explicitly include https:, http:, and file: schemes
    response.headers.set(
      "Content-Security-Policy",
      "frame-ancestors https: http: file:; default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https://*.cloudfront.net; font-src 'self' data:; connect-src 'self' https://api.openai.com;",
    )

    return response
  }

  // Skip middleware for public paths and API routes
  if (isPublicPath(path) || path.startsWith("/api/")) {
    return NextResponse.next()
  }

  // Check for auth token in cookies
  const authToken = request.cookies.get("auth_token")?.value

  // Also check localStorage as a fallback (via a custom header)
  const authHeader = request.headers.get("authorization")

  // If no token is found, redirect to login
  if (!authToken && !authHeader) {
    // Create a simple redirect URL without complex encoding
    const loginUrl = new URL("/login", request.url)
    loginUrl.searchParams.set("redirect", path)

    return NextResponse.redirect(loginUrl)
  }

  // Token exists, allow the request to proceed
  return NextResponse.next()
}

// Configure the middleware to run on specific paths
export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * 1. /api routes that don't require auth
     * 2. /_next (static files)
     * 3. /favicon.ico, /images, etc.
     */
    "/((?!_next|favicon.ico|images|.*\\.png$).*)",
  ],
}
