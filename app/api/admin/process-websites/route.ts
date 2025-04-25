import { type NextRequest, NextResponse } from "next/server"
import { verifyAuth } from "@/lib/auth"
import { processExistingWebsites } from "@/scripts/process-existing-websites"

// In-memory storage for process status
// In a production app, this would be better stored in a database
let processStatus = {
  isRunning: false,
  lastRun: null,
  results: null,
  error: null,
}

export async function POST(request: NextRequest) {
  try {
    // Verify authentication and admin status
    const authResult = await verifyAuth(request)
    if (!authResult.isAuthenticated) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Check if user is a super admin
    const user = authResult.user
    if (!user.isSuperAdmin) {
      return NextResponse.json({ error: "Forbidden: Requires super admin privileges" }, { status: 403 })
    }

    // Check if process is already running
    if (processStatus.isRunning) {
      return NextResponse.json({
        message: "Website processing is already running",
        status: "running",
        startedAt: processStatus.lastRun,
      })
    }

    // Update status
    processStatus = {
      isRunning: true,
      lastRun: new Date(),
      results: null,
      error: null,
    }

    // Process existing websites asynchronously
    processExistingWebsites()
      .then((results) => {
        processStatus = {
          isRunning: false,
          lastRun: processStatus.lastRun,
          results,
          error: null,
        }
      })
      .catch((error) => {
        processStatus = {
          isRunning: false,
          lastRun: processStatus.lastRun,
          results: null,
          error: error.message || "An error occurred",
        }
      })

    return NextResponse.json({
      message: "Website processing started",
      status: "running",
      startedAt: processStatus.lastRun,
    })
  } catch (error) {
    console.error("Error processing websites:", error)
    return NextResponse.json({ error: "Failed to process websites" }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    // Verify authentication and admin status
    const authResult = await verifyAuth(request)
    if (!authResult.isAuthenticated) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Check if user is a super admin
    const user = authResult.user
    if (!user.isSuperAdmin) {
      return NextResponse.json({ error: "Forbidden: Requires super admin privileges" }, { status: 403 })
    }

    return NextResponse.json({
      status: processStatus.isRunning ? "running" : "completed",
      lastRun: processStatus.lastRun,
      results: processStatus.results,
      error: processStatus.error,
    })
  } catch (error) {
    console.error("Error getting process status:", error)
    return NextResponse.json({ error: "Failed to get process status" }, { status: 500 })
  }
}
