"use client"

import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { FileText, Trash2, Download, Edit, Plus, Search, RefreshCw } from "lucide-react"
import { Input } from "@/components/ui/input"
import { DocumentUpload } from "@/components/document-upload"
import { DocumentEdit } from "@/components/document-edit"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"

interface Document {
  _id: string
  name: string
  description: string
  fileUrl: string
  fileType: string
  fileSize: number
  createdAt: string
  processingStatus?: "pending" | "processing" | "completed" | "failed"
  textProcessed?: boolean
  processingError?: string
}

interface DocumentListProps {
  campaignId: string
  userRole: string
}

export function DocumentList({ campaignId, userRole }: DocumentListProps) {
  const [documents, setDocuments] = useState<Document[]>([])
  const [filteredDocuments, setFilteredDocuments] = useState<Document[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showUploadForm, setShowUploadForm] = useState(false)
  const [editingDocument, setEditingDocument] = useState<Document | null>(null)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [documentToDelete, setDocumentToDelete] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [processingStatus, setProcessingStatus] = useState<Record<string, string>>({})
  const [isProcessing, setIsProcessing] = useState<Record<string, boolean>>({})

  const canEdit = ["owner", "admin", "editor"].includes(userRole)
  const canDelete = ["owner", "admin"].includes(userRole)

  const fetchDocuments = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const token = localStorage.getItem("token")
      if (!token) {
        throw new Error("No authentication token found")
      }

      const response = await fetch(`/api/campaigns/${campaignId}/documents`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      if (!response.ok) {
        throw new Error("Failed to fetch documents")
      }

      const data = await response.json()
      setDocuments(data.documents || [])
      setFilteredDocuments(data.documents || [])

      // Fetch processing status for each document
      const statusPromises = data.documents.map((doc) =>
        fetch(`/api/campaigns/${campaignId}/documents/${doc._id}/status`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }).then((res) => res.json()),
      )

      const statuses = await Promise.all(statusPromises)
      const newProcessingStatus = {}
      statuses.forEach((status, index) => {
        newProcessingStatus[data.documents[index]._id] = status.status
      })
      setProcessingStatus(newProcessingStatus)
    } catch (error) {
      setError(error.message)
    } finally {
      setLoading(false)
    }
  }, [campaignId])

  useEffect(() => {
    fetchDocuments()
  }, [fetchDocuments])

  useEffect(() => {
    if (searchQuery.trim() === "") {
      setFilteredDocuments(documents)
    } else {
      const query = searchQuery.toLowerCase()
      const filtered = documents.filter(
        (doc) =>
          doc.name.toLowerCase().includes(query) || (doc.description && doc.description.toLowerCase().includes(query)),
      )
      setFilteredDocuments(filtered)
    }
  }, [searchQuery, documents])

  const handleDeleteDocument = async (documentId: string) => {
    setIsDeleting(true)
    setError(null)

    try {
      const token = localStorage.getItem("token")
      if (!token) {
        throw new Error("No authentication token found")
      }

      // Skip the verification step and proceed directly to deletion
      const response = await fetch(`/api/campaigns/${campaignId}/documents/${documentId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.message || `Failed to delete document (${response.status})`)
      }

      // Remove the document from the list
      setDocuments((prev) => prev.filter((doc) => doc._id !== documentId))
      setIsDeleteDialogOpen(false)

      // Refresh the document list to ensure UI is in sync with server
      setTimeout(() => {
        fetchDocuments()
      }, 500)
    } catch (error) {
      setError(error.message || "An error occurred while deleting the document")
    } finally {
      setIsDeleting(false)
      setDocumentToDelete(null)
    }
  }

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + " bytes"
    else if (bytes < 1048576) return (bytes / 1024).toFixed(1) + " KB"
    else return (bytes / 1048576).toFixed(1) + " MB"
  }

  const getFileIcon = (fileType: string) => {
    return <FileText className="h-8 w-8 text-blue-500" />
  }

  const handleUploadComplete = () => {
    setShowUploadForm(false)
    fetchDocuments()
  }

  const handleEditComplete = () => {
    setEditingDocument(null)
    fetchDocuments()
  }

  const handleReprocessDocument = async (documentId: string) => {
    try {
      setIsProcessing((prev) => ({ ...prev, [documentId]: true }))
      const token = localStorage.getItem("token")
      if (!token) {
        throw new Error("No authentication token found")
      }

      const response = await fetch(`/api/campaigns/${campaignId}/documents/${documentId}/status`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      if (!response.ok) {
        throw new Error("Failed to reprocess document")
      }

      // Refresh the document list
      fetchDocuments()
    } catch (error) {
      setError(error.message)
    } finally {
      setIsProcessing((prev) => ({ ...prev, [documentId]: false }))
    }
  }

  return (
    <div className="space-y-4">
      {showUploadForm ? (
        <DocumentUpload
          campaignId={campaignId}
          onUploadComplete={handleUploadComplete}
          onCancel={() => setShowUploadForm(false)}
        />
      ) : editingDocument ? (
        <DocumentEdit
          campaignId={campaignId}
          document={editingDocument}
          onEditComplete={handleEditComplete}
          onCancel={() => setEditingDocument(null)}
        />
      ) : (
        <>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            {canEdit && (
              <Button onClick={() => setShowUploadForm(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Upload Document
              </Button>
            )}
          </div>

          <div className="flex items-center space-x-2">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-500" />
              <Input
                type="search"
                placeholder="Search documents..."
                className="pl-8"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          {loading ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <Card key={i} className="animate-pulse">
                  <CardContent className="p-4">
                    <div className="flex items-center space-x-3">
                      <div className="h-8 w-8 bg-gray-200 rounded" />
                      <div className="space-y-2">
                        <div className="h-4 bg-gray-200 rounded w-24" />
                        <div className="h-3 bg-gray-200 rounded w-16" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : error ? (
            <Card>
              <CardContent className="p-6">
                <p className="text-red-500">{error}</p>
                <Button
                  variant="outline"
                  className="mt-4"
                  onClick={() => {
                    setError(null)
                    fetchDocuments()
                  }}
                >
                  Retry
                </Button>
              </CardContent>
            </Card>
          ) : filteredDocuments.length === 0 ? (
            <Card>
              <CardContent className="p-6 text-center">
                {searchQuery ? (
                  <p className="text-gray-500">No documents found matching your search.</p>
                ) : (
                  <p className="text-gray-500">
                    No documents have been uploaded yet.
                    {canEdit && (
                      <Button
                        variant="link"
                        className="p-0 h-auto text-blue-500"
                        onClick={() => setShowUploadForm(true)}
                      >
                        Upload your first document
                      </Button>
                    )}
                  </p>
                )}
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {filteredDocuments.map((document) => (
                <Card key={document._id} className="overflow-hidden">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start space-x-3">
                        {getFileIcon(document.fileType)}
                        <div>
                          <h3 className="font-medium">{document.name}</h3>
                          <p className="text-sm text-gray-500 mt-1">{formatFileSize(document.fileSize)}</p>
                          {document.description && (
                            <p className="text-sm text-gray-700 mt-2 line-clamp-2">{document.description}</p>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="mt-2">
                      <p className="text-sm">
                        Processing Status:{" "}
                        <span
                          className={`font-medium ${
                            processingStatus[document._id] === "completed"
                              ? "text-green-600"
                              : processingStatus[document._id] === "failed"
                                ? "text-red-600"
                                : processingStatus[document._id] === "processing"
                                  ? "text-blue-600"
                                  : "text-gray-600"
                          }`}
                        >
                          {processingStatus[document._id] || "Not processed"}
                        </span>
                      </p>
                    </div>
                    <div className="flex justify-end mt-4 space-x-2">
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => window.open(document.fileUrl, "_blank")}
                        aria-label="Download document"
                        title="Download"
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                      {canEdit && (
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => setEditingDocument(document)}
                          aria-label="Edit document"
                          title="Edit"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                      )}
                      {canEdit && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleReprocessDocument(document._id)}
                          disabled={isProcessing[document._id] || processingStatus[document._id] === "processing"}
                        >
                          <RefreshCw className={`h-4 w-4 mr-2 ${isProcessing[document._id] ? "animate-spin" : ""}`} />
                          {processingStatus[document._id] === "completed" ? "Reprocess" : "Process"}
                        </Button>
                      )}
                      {canDelete && (
                        <Button
                          variant="outline"
                          size="icon"
                          className="text-red-500 hover:text-red-700"
                          onClick={() => {
                            setDocumentToDelete(document._id)
                            setIsDeleteDialogOpen(true)
                          }}
                          aria-label="Delete document"
                          title="Delete"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </>
      )}

      <Dialog
        open={isDeleteDialogOpen}
        onOpenChange={(open) => {
          if (!isDeleting) {
            setIsDeleteDialogOpen(open)
            if (!open) setDocumentToDelete(null)
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Deletion</DialogTitle>
          </DialogHeader>
          <p>Are you sure you want to delete this document? This action cannot be undone.</p>
          {error && <p className="text-red-500 mt-2">{error}</p>}
          <div className="flex justify-end space-x-2 mt-4">
            <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)} disabled={isDeleting}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => documentToDelete && handleDeleteDocument(documentToDelete)}
              disabled={isDeleting}
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
