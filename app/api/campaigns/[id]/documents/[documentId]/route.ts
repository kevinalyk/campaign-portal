import { type NextRequest, NextResponse } from "next/server"
import clientPromise from "@/lib/mongodb"
import { DocumentService } from "@/services/documentService"
import { verifyJWT } from "@/lib/auth"
import { checkPermission } from "@/lib/auth"
import { del } from "@vercel/blob"
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

// GET /api/campaigns/[id]/documents/[documentId] - Get a specific document
export async function GET(request: NextRequest, { params }: { params: { id: string; documentId: string } }) {
  try {
    const userId = await getUserIdFromRequest(request)
    if (!userId) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
    }

    const campaignId = params.id
    const documentId = params.documentId

    // Check if user has access to this campaign
    const hasAccess = await checkPermission(campaignId, userId, ["owner", "admin", "editor", "viewer"])
    if (!hasAccess) {
      return NextResponse.json({ message: "You don't have access to this campaign" }, { status: 403 })
    }

    const client = await clientPromise
    const documentService = new DocumentService(client)

    let document
    try {
      document = await documentService.getDocument(documentId)
    } catch (error) {
      return NextResponse.json({ message: "Error retrieving document", error: error.message }, { status: 500 })
    }

    if (!document) {
      return NextResponse.json({ message: "Document not found" }, { status: 404 })
    }

    // Verify the document belongs to the specified campaign
    if (document.campaignId.toString() !== campaignId) {
      return NextResponse.json({ message: "Document not found in this campaign" }, { status: 404 })
    }

    return NextResponse.json({ document })
  } catch (error) {
    return NextResponse.json({ message: "Internal server error", error: error.message }, { status: 500 })
  }
}

// PUT /api/campaigns/[id]/documents/[documentId] - Update a document
export async function PUT(request: NextRequest, { params }: { params: { id: string; documentId: string } }) {
  try {
    const userId = await getUserIdFromRequest(request)
    if (!userId) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
    }

    const campaignId = params.id
    const documentId = params.documentId

    // Check if user has permission to edit documents
    const hasPermission = await checkPermission(campaignId, userId, ["owner", "admin", "editor"])
    if (!hasPermission) {
      return NextResponse.json({ message: "You don't have permission to edit documents" }, { status: 403 })
    }

    const body = await request.json()
    const updateData = {
      name: body.name,
      description: body.description,
    }

    const client = await clientPromise
    const documentService = new DocumentService(client)

    // Get the current document to verify it belongs to the campaign
    let currentDocument
    try {
      currentDocument = await documentService.getDocument(documentId)
    } catch (error) {
      console.error("Error retrieving document:", error)
      return NextResponse.json({ message: "Error retrieving document", error: error.message }, { status: 500 })
    }

    if (!currentDocument) {
      return NextResponse.json({ message: "Document not found" }, { status: 404 })
    }

    // Verify the document belongs to the specified campaign
    if (currentDocument.campaignId.toString() !== campaignId) {
      return NextResponse.json({ message: "Document not found in this campaign" }, { status: 404 })
    }

    try {
      const updatedDocument = await documentService.updateDocument(documentId, updateData)

      // Get user information for the log
      const userService = new UserService(client)
      const user = await userService.findUserById(userId)
      const userName = user
        ? user.firstName && user.lastName
          ? `${user.firstName} ${user.lastName}`
          : user.email
        : "Unknown User"

      // Log the document update activity
      const activityLogService = new ActivityLogService(client)
      await activityLogService.createLog({
        campaignId: new ObjectId(campaignId),
        userId: new ObjectId(userId),
        userName,
        action: ActivityAction.UPDATE,
        entityType: EntityType.DOCUMENT,
        entityId: new ObjectId(documentId),
        details: {
          name: updatedDocument.name,
          description: updatedDocument.description,
        },
      })

      return NextResponse.json({ message: "Document updated successfully", document: updatedDocument })
    } catch (error) {
      console.error("Error updating document:", error)
      return NextResponse.json({ message: "Error updating document", error: error.message }, { status: 500 })
    }
  } catch (error) {
    console.error("Internal server error:", error)
    return NextResponse.json({ message: "Internal server error", error: error.message }, { status: 500 })
  }
}

// DELETE /api/campaigns/[id]/documents/[documentId] - Delete a document
export async function DELETE(request: NextRequest, { params }: { params: { id: string; documentId: string } }) {
  let client = null

  try {
    // Step 1: Authenticate user
    const userId = await getUserIdFromRequest(request)
    if (!userId) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
    }

    const campaignId = params.id
    const documentId = params.documentId

    // Step 2: Check permissions
    try {
      const hasPermission = await checkPermission(campaignId, userId, ["owner", "admin", "editor"])
      if (!hasPermission) {
        return NextResponse.json({ message: "You don't have permission to delete documents" }, { status: 403 })
      }
    } catch (permError) {
      return NextResponse.json({ message: "Permission check failed", error: permError.message }, { status: 500 })
    }

    // Step 3: Get MongoDB client
    try {
      client = await clientPromise
    } catch (dbError) {
      return NextResponse.json({ message: "Database connection failed", error: dbError.message }, { status: 500 })
    }

    const documentService = new DocumentService(client)

    // Step 4: Get document before deletion
    let document
    try {
      document = await documentService.getDocument(documentId)

      // If document doesn't exist, consider it already deleted and return success
      if (!document) {
        return NextResponse.json({ message: "Document deleted successfully" })
      }

      // Verify the document belongs to the specified campaign
      if (document.campaignId.toString() !== campaignId) {
        return NextResponse.json({ message: "Document not found in this campaign" }, { status: 404 })
      }
    } catch (docError) {
      // If there's an error getting the document, proceed with deletion anyway
      // The document might still exist and we want to attempt deletion
    }

    // Step 5: Delete document from database
    let deleted = false
    try {
      deleted = await documentService.deleteDocument(documentId)
      if (!deleted && document) {
        // Only return an error if we know the document existed but couldn't delete it
        return NextResponse.json({ message: "Document deletion failed" }, { status: 500 })
      }
    } catch (deleteError) {
      // If deletion fails but we have the document info, try to continue with blob deletion and logging
      if (!document) {
        return NextResponse.json({ message: "Error deleting document", error: deleteError.message }, { status: 500 })
      }
    }

    // Step 6: Delete file from Blob storage (non-critical)
    if (document && document.fileKey) {
      try {
        await del(document.fileKey)
      } catch (blobError) {
        // Continue even if blob deletion fails
        // This is non-critical and shouldn't fail the whole operation
      }
    }

    // Step 7: Log the activity (non-critical)
    if (document) {
      try {
        const userService = new UserService(client)
        const user = await userService.findUserById(userId)
        const userName = user
          ? user.firstName && user.lastName
            ? `${user.firstName} ${user.lastName}`
            : user.email
          : "Unknown User"

        const activityLogService = new ActivityLogService(client)
        await activityLogService.createLog({
          campaignId: new ObjectId(campaignId),
          userId: new ObjectId(userId),
          userName,
          action: ActivityAction.DELETE,
          entityType: EntityType.DOCUMENT,
          entityId: new ObjectId(documentId),
          details: {
            name: document.name,
            fileType: document.fileType,
          },
        })
      } catch (logError) {
        // Continue even if logging fails
        // This is non-critical and shouldn't fail the whole operation
      }
    }

    // Return success response
    return NextResponse.json({ message: "Document deleted successfully" })
  } catch (error) {
    // Catch-all error handler
    return NextResponse.json(
      {
        message: "Document deletion failed",
        error: error.message || "Unknown error occurred",
      },
      { status: 500 },
    )
  }
}
