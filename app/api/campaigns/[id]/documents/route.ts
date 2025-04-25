import { type NextRequest, NextResponse } from "next/server"
import { put } from "@vercel/blob"
import clientPromise from "@/lib/mongodb"
import { DocumentService } from "@/services/documentService"
import { verifyJWT } from "@/lib/auth"
import { checkPermission } from "@/lib/auth"
// Import the ActivityLogService at the top of the file
import { ActivityLogService } from "@/services/activityLogService"
import { ActivityAction, EntityType } from "@/models/ActivityLog"
import { ObjectId } from "mongodb"
import { UserService } from "@/services/userService"

// Helper function to get user ID from JWT token
async function getUserIdFromRequest(request: NextRequest): Promise<string | null> {
  const token = request.headers.get("Authorization")?.replace("Bearer ", "")
  if (!token) return null

  try {
    const payload = await verifyJWT(token)
    return payload.userId
  } catch (error) {
    return null
  }
}

// GET /api/campaigns/[id]/documents - Get all documents for a campaign
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const userId = await getUserIdFromRequest(request)
    if (!userId) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
    }

    const campaignId = params.id

    // Check if user has access to this campaign using the centralized checkPermission function
    const hasAccess = await checkPermission(campaignId, userId, ["owner", "admin", "editor", "viewer"])
    if (!hasAccess) {
      return NextResponse.json({ message: "You don't have access to this campaign" }, { status: 403 })
    }

    const client = await clientPromise
    const documentService = new DocumentService(client)
    const documents = await documentService.getDocumentsByCampaign(campaignId)

    return NextResponse.json({ documents })
  } catch (error) {
    console.error("Error fetching documents:", error)
    return NextResponse.json({ message: "Internal server error", error: error.message }, { status: 500 })
  }
}

// POST /api/campaigns/[id]/documents - Upload a new document
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const userId = await getUserIdFromRequest(request)
    if (!userId) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
    }

    const campaignId = params.id

    // Check if user has permission to upload documents using the centralized checkPermission function
    const hasPermission = await checkPermission(campaignId, userId, ["owner", "admin", "editor"])
    if (!hasPermission) {
      return NextResponse.json({ message: "You don't have permission to upload documents" }, { status: 403 })
    }

    // Handle file upload
    const formData = await request.formData()
    const file = formData.get("file") as File
    const name = formData.get("name") as string
    const description = formData.get("description") as string

    if (!file) {
      return NextResponse.json({ message: "No file provided" }, { status: 400 })
    }

    if (!name) {
      return NextResponse.json({ message: "Document name is required" }, { status: 400 })
    }

    // Validate file type
    const allowedTypes = [
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "text/plain",
      "text/markdown",
      "text/csv",
    ]

    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        {
          message: "Invalid file type",
          details: "Only PDF, Word, TXT, MD, and CSV files are allowed",
        },
        { status: 400 },
      )
    }

    // Validate file size (10MB max)
    const maxSize = 10 * 1024 * 1024 // 10MB
    if (file.size > maxSize) {
      return NextResponse.json(
        {
          message: "File too large",
          details: "Maximum file size is 10MB",
        },
        { status: 400 },
      )
    }

    // Upload file to Vercel Blob
    const blob = await put(`campaigns/${campaignId}/${file.name}`, file, {
      access: "public",
    })

    // Save document metadata to database
    const client = await clientPromise
    const documentService = new DocumentService(client)
    const document = await documentService.createDocument({
      campaignId,
      name,
      description,
      fileUrl: blob.url,
      fileKey: blob.url,
      fileType: file.type,
      fileSize: file.size,
      uploadedBy: userId,
    })

    // Get user information for the log
    const userService = new UserService(client)
    const user = await userService.findUserById(userId)
    const userName = user
      ? user.firstName && user.lastName
        ? `${user.firstName} ${user.lastName}`
        : user.email
      : "Unknown User"

    // Log the document upload activity
    const activityLogService = new ActivityLogService(client)
    await activityLogService.createLog({
      campaignId: new ObjectId(campaignId),
      userId: new ObjectId(userId),
      userName,
      action: ActivityAction.UPLOAD,
      entityType: EntityType.DOCUMENT,
      entityId: document._id,
      details: {
        name: document.name,
        fileType: document.fileType,
      },
    })

    return NextResponse.json(
      {
        message: "Document uploaded successfully",
        document,
      },
      { status: 201 },
    )
  } catch (error) {
    console.error("Error uploading document:", error)
    return NextResponse.json({ message: "Internal server error", error: error.message }, { status: 500 })
  }
}
