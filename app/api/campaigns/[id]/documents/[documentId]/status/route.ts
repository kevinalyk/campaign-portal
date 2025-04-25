import { type NextRequest, NextResponse } from "next/server"
import clientPromise from "@/lib/mongodb"
import { DocumentService } from "@/services/documentService"
import { verifyJWT, checkPermission } from "@/lib/auth"

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

// GET /api/campaigns/[id]/documents/[documentId]/status - Get document processing status
export async function GET(request: NextRequest, { params }: { params: { id: string; documentId: string } }) {
  try {
    const userId = await getUserIdFromRequest(request)
    if (!userId) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
    }

    const { id: campaignId, documentId } = params

    // Check if user has access to this campaign
    const hasAccess = await checkPermission(campaignId, userId, ["owner", "admin", "editor", "viewer"])
    if (!hasAccess) {
      return NextResponse.json({ message: "You don't have access to this campaign" }, { status: 403 })
    }

    const client = await clientPromise
    const documentService = new DocumentService(client)
    const document = await documentService.getDocument(documentId)

    if (!document) {
      return NextResponse.json({ message: "Document not found" }, { status: 404 })
    }

    // Verify the document belongs to the specified campaign
    if (document.campaignId.toString() !== campaignId) {
      return NextResponse.json({ message: "Document not found in this campaign" }, { status: 404 })
    }

    return NextResponse.json({
      status: document.processingStatus || "pending",
      textProcessed: document.textProcessed || false,
      error: document.processingError,
    })
  } catch (error) {
    console.error("Error fetching document status:", error)
    return NextResponse.json({ message: "Internal server error", error: error.message }, { status: 500 })
  }
}

// POST /api/campaigns/[id]/documents/[documentId]/status - Trigger document reprocessing
export async function POST(request: NextRequest, { params }: { params: { id: string; documentId: string } }) {
  try {
    const userId = await getUserIdFromRequest(request)
    if (!userId) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
    }

    const { id: campaignId, documentId } = params

    // Check if user has permission to reprocess documents
    const hasPermission = await checkPermission(campaignId, userId, ["owner", "admin", "editor"])
    if (!hasPermission) {
      return NextResponse.json({ message: "You don't have permission to reprocess documents" }, { status: 403 })
    }

    const client = await clientPromise
    const documentService = new DocumentService(client)
    const document = await documentService.getDocument(documentId)

    if (!document) {
      return NextResponse.json({ message: "Document not found" }, { status: 404 })
    }

    // Verify the document belongs to the specified campaign
    if (document.campaignId.toString() !== campaignId) {
      return NextResponse.json({ message: "Document not found in this campaign" }, { status: 404 })
    }

    // Update document status to pending
    await documentService.updateDocument(documentId, {
      processingStatus: "pending",
      processingError: null,
    })

    // Trigger document processing
    await documentService.processDocumentAsync(documentId)

    return NextResponse.json({ message: "Document reprocessing initiated", status: "pending" })
  } catch (error) {
    console.error("Error reprocessing document:", error)
    return NextResponse.json({ message: "Internal server error", error: error.message }, { status: 500 })
  }
}
