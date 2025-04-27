import { type NextRequest, NextResponse } from "next/server"
import { verifyAuth } from "@/lib/auth"
import { addRateLimitFieldToCampaigns } from "@/scripts/add-rate-limit-field"

// In-memory storage for migration status
let migrationStatus = {
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

    // Check if migration is already running
    if (migrationStatus.isRunning) {
      return NextResponse.json({
        message: "Migration is already running",
        status: "running",
        startedAt: migrationStatus.lastRun,
      })
    }

    // Update status
    migrationStatus = {
      isRunning: true,
      lastRun: new Date(),
      results: null,
      error: null,
    }

    // Run migration asynchronously
    addRateLimitFieldToCampaigns()
      .then((results) => {
        migrationStatus = {
          isRunning: false,
          lastRun: migrationStatus.lastRun,
          results,
          error: null,
        }
      })
      .catch((error) => {
        migrationStatus = {
          isRunning: false,
          lastRun: migrationStatus.lastRun,
          results: null,
          error: error.message || "An error occurred",
        }
      })

    return NextResponse.json({
      message: "Migration started",
      status: "running",
      startedAt: migrationStatus.lastRun,
    })
  } catch (error) {
    console.error("Error running migration:", error)
    return NextResponse.json({ error: "Failed to run migration" }, { status: 500 })
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
      status: migrationStatus.isRunning ? "running" : "completed",
      lastRun: migrationStatus.lastRun,
      results: migrationStatus.results,
      error: migrationStatus.error,
    })
  } catch (error) {
    console.error("Error getting migration status:", error)
    return NextResponse.json({ error: "Failed to get migration status" }, { status: 500 })
  }
}
