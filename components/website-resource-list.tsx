"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Globe, FileText, ImageIcon, Trash2, RefreshCw, Plus, Eye, Star, Info, X } from "lucide-react"
import { WebsiteUrlForm } from "@/components/website-url-form"
import { WebsiteHtmlUpload } from "@/components/website-html-upload"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

interface WebsiteResource {
  _id: string
  type: "url" | "html" | "screenshot"
  url?: string
  fileUrl?: string
  createdAt: string
  lastFetched?: string
}

interface WebsiteResourceListProps {
  campaignId: string
  userRole: string
}

export function WebsiteResourceList({ campaignId, userRole }: WebsiteResourceListProps) {
  const [resources, setResources] = useState<WebsiteResource[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showAddForm, setShowAddForm] = useState(false)
  const [addFormType, setAddFormType] = useState<"url" | "html">("url")
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [resourceToDelete, setResourceToDelete] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [previewResource, setPreviewResource] = useState<WebsiteResource | null>(null)
  const [isPreviewOpen, setIsPreviewOpen] = useState(false)
  const [indexingStatuses, setIndexingStatuses] = useState<Record<string, any>>({})
  const [isRefreshingIndex, setIsRefreshingIndex] = useState<Record<string, boolean>>({})
  const [campaignWebsiteUrl, setCampaignWebsiteUrl] = useState<string>("")
  const [showInfoDialog, setShowInfoDialog] = useState(false)
  const [notification, setNotification] = useState<{ message: string; type: string } | null>(null)

  // Use refs to track initialization and prevent multiple fetches
  const initialized = useRef(false)
  const isMounted = useRef(true)

  const canEdit = ["owner", "admin", "editor"].includes(userRole)
  const canDelete = ["owner", "admin"].includes(userRole)
  const canReindex = ["owner", "admin"].includes(userRole)

  // Fetch the campaign to get the main website URL
  const fetchCampaign = useCallback(async () => {
    if (!isMounted.current) return

    try {
      const token = localStorage.getItem("token")
      if (!token) {
        throw new Error("No authentication token found")
      }

      const response = await fetch(`/api/campaigns/${campaignId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      if (!response.ok) {
        throw new Error("Failed to fetch campaign")
      }

      const data = await response.json()
      if (isMounted.current) {
        setCampaignWebsiteUrl(data.campaign.websiteUrl || "")
      }
    } catch (error) {}
  }, [campaignId])

  const fetchResources = useCallback(async () => {
    if (!isMounted.current) return

    setLoading(true)
    setError(null)

    try {
      const token = localStorage.getItem("token")
      if (!token) {
        throw new Error("No authentication token found")
      }

      const response = await fetch(`/api/campaigns/${campaignId}/website-resources`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      if (!response.ok) {
        throw new Error("Failed to fetch website resources")
      }

      const data = await response.json()
      if (isMounted.current) {
        setResources(data.resources || [])
        setLoading(false)
      }
    } catch (error) {
      if (isMounted.current) {
        setError(error.message)
        setLoading(false)
      }
    }
  }, [campaignId])

  const fetchIndexingStatuses = useCallback(
    async (resources: WebsiteResource[]) => {
      if (!isMounted.current) return

      const urlResources = resources.filter((resource) => resource.type === "url")

      for (const resource of urlResources) {
        try {
          const token = localStorage.getItem("token")
          if (!token) continue

          const response = await fetch(`/api/campaigns/${campaignId}/website-resources/${resource._id}/status`, {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          })

          if (!response.ok) continue

          const data = await response.json()
          if (isMounted.current) {
            setIndexingStatuses((prev) => ({
              ...prev,
              [resource._id]: data,
            }))
          }
        } catch (error) {}
      }
    },
    [campaignId],
  )

  // Enhance the restartIndexing function with better error handling and feedback
  const restartIndexing = async (resourceId: string) => {
    if (!isMounted.current) return

    setIsRefreshingIndex((prev) => ({
      ...prev,
      [resourceId]: true,
    }))

    try {
      const token = localStorage.getItem("token")
      if (!token) {
        throw new Error("No authentication token found")
      }

      // Use POST to trigger re-indexing
      const response = await fetch(`/api/campaigns/${campaignId}/website-resources/${resourceId}/status`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      })

      const responseData = await response.json()

      if (!response.ok) {
        throw new Error(responseData.message || "Failed to restart indexing")
      }

      // Show success message
      setError(null)

      // Wait a moment before fetching the updated status
      setTimeout(async () => {
        if (isMounted.current) {
          try {
            const statusResponse = await fetch(`/api/campaigns/${campaignId}/website-resources/${resourceId}/status`, {
              headers: {
                Authorization: `Bearer ${token}`,
              },
            })

            if (statusResponse.ok) {
              const data = await statusResponse.json()

              setIndexingStatuses((prev) => ({
                ...prev,
                [resourceId]: data,
              }))
            } else {
            }
          } catch (error) {
          } finally {
            setIsRefreshingIndex((prev) => ({
              ...prev,
              [resourceId]: false,
            }))
          }
        }
      }, 1000)
    } catch (error) {
      if (isMounted.current) {
        setError(error.message || "Failed to restart indexing")
        setIsRefreshingIndex((prev) => ({
          ...prev,
          [resourceId]: false,
        }))
      }
    }
  }

  // Initialize data on mount
  useEffect(() => {
    isMounted.current = true

    // Only run initialization once
    if (!initialized.current) {
      initialized.current = true

      const initData = async () => {
        await fetchCampaign()
        await fetchResources()
      }

      initData()
    }

    return () => {
      isMounted.current = false
    }
  }, [fetchCampaign, fetchResources])

  // Fetch indexing statuses when resources change
  useEffect(() => {
    if (resources.length > 0) {
      fetchIndexingStatuses(resources)
    }
  }, [resources, fetchIndexingStatuses])

  // Set up polling for resources that are in processing or crawling state
  useEffect(() => {
    // Set up polling for resources that are in processing or crawling state
    const processingResources = resources.filter(
      (resource) =>
        indexingStatuses[resource._id]?.status === "processing" ||
        indexingStatuses[resource._id]?.status === "crawling",
    )

    if (processingResources.length > 0 && isMounted.current) {
      const intervalId = setInterval(() => {
        processingResources.forEach((resource) => {
          if (isMounted.current) {
            const token = localStorage.getItem("token")
            if (!token) return

            fetch(`/api/campaigns/${campaignId}/website-resources/${resource._id}/status`, {
              headers: {
                Authorization: `Bearer ${token}`,
              },
            })
              .then((response) => {
                if (!response.ok) throw new Error("Failed to fetch status")
                return response.json()
              })
              .then((data) => {
                if (isMounted.current) {
                  setIndexingStatuses((prev) => ({
                    ...prev,
                    [resource._id]: data,
                  }))

                  // If status is no longer processing or crawling, we can stop polling
                  if (data.status !== "processing" && data.status !== "crawling") {
                    // Refresh resources to get the latest data
                    fetchResources()
                  }
                }
              })
              .catch((error) => {})
          }
        })
      }, 5000) // Poll every 5 seconds

      return () => clearInterval(intervalId)
    }
  }, [resources, indexingStatuses, campaignId, fetchResources])

  const handleDeleteResource = async (resourceId: string) => {
    if (!isMounted.current) return

    // Removed the check for main website URL resource

    setIsDeleting(true)

    try {
      const token = localStorage.getItem("token")
      if (!token) {
        throw new Error("No authentication token found")
      }

      const response = await fetch(`/api/campaigns/${campaignId}/website-resources/${resourceId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      if (!response.ok) {
        throw new Error("Failed to delete resource")
      }

      // Remove the resource from the list
      if (isMounted.current) {
        setResources((prev) => prev.filter((resource) => resource._id !== resourceId))
        setIsDeleteDialogOpen(false)
      }
    } catch (error) {
      if (isMounted.current) {
        setError(error.message)
      }
    } finally {
      if (isMounted.current) {
        setIsDeleting(false)
        setResourceToDelete(null)
      }
    }
  }

  const handleRefreshUrl = async (resourceId: string, url: string) => {
    if (!isMounted.current) return

    setIsRefreshing(true)

    try {
      const token = localStorage.getItem("token")
      if (!token) {
        throw new Error("No authentication token found")
      }

      const response = await fetch(`/api/campaigns/${campaignId}/website-resources/${resourceId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ url }),
      })

      if (!response.ok) {
        throw new Error("Failed to refresh website content")
      }

      // Refresh the resources list
      await fetchResources()
    } catch (error) {
      if (isMounted.current) {
        setError(error.message)
      }
    } finally {
      if (isMounted.current) {
        setIsRefreshing(false)
      }
    }
  }

  const handleAddComplete = async (notificationData?: { message: string; type: string }) => {
    if (!isMounted.current) return

    setShowAddForm(false)
    setAddFormType("url") // Reset to default
    await fetchResources()

    if (notificationData) {
      setNotification(notificationData)
      // Auto-dismiss after 10 seconds
      setTimeout(() => {
        if (isMounted.current) {
          setNotification(null)
        }
      }, 10000)
    }
  }

  const getResourceIcon = (type: string) => {
    switch (type) {
      case "url":
        return <Globe className="h-8 w-8 text-blue-500" />
      case "html":
        return <FileText className="h-8 w-8 text-orange-500" />
      case "screenshot":
        return <ImageIcon className="h-8 w-8 text-green-500" />
      default:
        return <FileText className="h-8 w-8 text-blue-500" />
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString() + " " + date.toLocaleTimeString()
  }

  const getResourceTypeLabel = (type: string) => {
    switch (type) {
      case "url":
        return "Website URL"
      case "html":
        return "HTML File"
      case "screenshot":
        return "Screenshot"
      default:
        return "Resource"
    }
  }

  // Check if a resource is the main website URL
  const isMainWebsiteUrl = (resource: WebsiteResource) => {
    return resource.type === "url" && resource.url === campaignWebsiteUrl
  }

  return (
    <TooltipProvider>
      <div className="space-y-4">
        {showAddForm ? (
          <Tabs defaultValue={addFormType} onValueChange={(value) => setAddFormType(value as any)}>
            <TabsList className="mb-4">
              <TabsTrigger value="url">Website URL</TabsTrigger>
              <TabsTrigger value="html">HTML File</TabsTrigger>
            </TabsList>
            <TabsContent value="url">
              <WebsiteUrlForm
                campaignId={campaignId}
                onComplete={handleAddComplete}
                onCancel={() => {
                  setShowAddForm(false)
                  setAddFormType("url") // Reset to default
                }}
              />
            </TabsContent>
            <TabsContent value="html">
              <WebsiteHtmlUpload
                campaignId={campaignId}
                onComplete={handleAddComplete}
                onCancel={() => {
                  setShowAddForm(false)
                  setAddFormType("url") // Reset to default
                }}
              />
            </TabsContent>
          </Tabs>
        ) : (
          <>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex-1">
                {/* Information button moved to the right side */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="ml-2 text-gray-500 hover:text-gray-700"
                      onClick={() => setShowInfoDialog(true)}
                    >
                      <Info className="h-4 w-4 mr-1" />
                      <span className="text-sm">About Website Resources</span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Learn more about website resources and how they work</p>
                  </TooltipContent>
                </Tooltip>
              </div>
              <div>
                <Button onClick={() => setShowAddForm(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Website Resource
                </Button>
              </div>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md mb-4">{error}</div>
            )}

            {notification && (
              <div
                className={`mb-4 px-4 py-3 rounded-md flex items-start ${
                  notification.type === "success"
                    ? "bg-green-50 border border-green-200 text-green-700"
                    : "bg-blue-50 border border-blue-200 text-blue-700"
                }`}
              >
                <div className="flex-1">{notification.message}</div>
                <button
                  onClick={() => setNotification(null)}
                  className="ml-2 text-gray-500 hover:text-gray-700"
                  aria-label="Dismiss notification"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            )}

            {loading ? (
              <div className="grid gap-4 md:grid-cols-2">
                {Array.from({ length: 2 }).map((_, i) => (
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
            ) : resources.length === 0 ? (
              <Card>
                <CardContent className="p-6 text-center">
                  <p className="text-gray-500">
                    No website resources have been added yet.
                    {canEdit && (
                      <Button variant="link" className="p-0 h-auto text-blue-500" onClick={() => setShowAddForm(true)}>
                        Add your first website resource
                      </Button>
                    )}
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {resources.map((resource) => (
                  <Card
                    key={resource._id}
                    className={`overflow-hidden ${isMainWebsiteUrl(resource) ? "border-blue-300" : ""}`}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex items-start space-x-3">
                          {getResourceIcon(resource.type)}
                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className="font-medium">{getResourceTypeLabel(resource.type)}</h3>
                              {isMainWebsiteUrl(resource) && (
                                <Badge className="bg-blue-500">
                                  <Star className="h-3 w-3 mr-1" /> Main Website
                                </Badge>
                              )}
                            </div>
                            {resource.url && <p className="text-sm text-gray-700 mt-1 break-all">{resource.url}</p>}
                            <p className="text-sm text-gray-500 mt-1">Added: {formatDate(resource.createdAt)}</p>
                            {resource.lastFetched && (
                              <p className="text-sm text-gray-500">Last updated: {formatDate(resource.lastFetched)}</p>
                            )}
                          </div>
                        </div>
                      </div>
                      {resource.type === "url" && (
                        <div className="mt-2">
                          <p className="text-sm">
                            Indexing:{" "}
                            <span
                              className={`font-medium ${
                                !indexingStatuses[resource._id]
                                  ? "text-gray-600"
                                  : indexingStatuses[resource._id]?.status === "completed"
                                    ? "text-green-600"
                                    : indexingStatuses[resource._id]?.status === "failed"
                                      ? "text-red-600"
                                      : indexingStatuses[resource._id]?.status === "crawling" ||
                                          indexingStatuses[resource._id]?.status === "processing"
                                        ? "text-blue-600"
                                        : "text-gray-600"
                              }`}
                            >
                              {!indexingStatuses[resource._id]
                                ? "Unknown"
                                : indexingStatuses[resource._id]?.status === "completed"
                                  ? "Completed"
                                  : indexingStatuses[resource._id]?.status === "failed"
                                    ? "Failed"
                                    : indexingStatuses[resource._id]?.status === "crawling"
                                      ? "In Progress (Crawling)"
                                      : indexingStatuses[resource._id]?.status === "processing"
                                        ? "In Progress (Processing)"
                                        : indexingStatuses[resource._id]?.status === "pending"
                                          ? "Pending"
                                          : "Not Started"}
                            </span>
                            {indexingStatuses[resource._id]?.pagesCrawled > 0 && (
                              <span className="text-xs text-gray-500 ml-1">
                                ({indexingStatuses[resource._id].pagesCrawled} pages)
                              </span>
                            )}
                          </p>
                          {indexingStatuses[resource._id]?.error && (
                            <p className="text-xs text-red-600 mt-1">{indexingStatuses[resource._id].error}</p>
                          )}
                        </div>
                      )}
                      <div className="flex justify-end mt-4 space-x-2">
                        {resource.type === "url" && canEdit && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleRefreshUrl(resource._id, resource.url!)}
                                disabled={
                                  isRefreshing ||
                                  indexingStatuses[resource._id]?.status === "processing" ||
                                  indexingStatuses[resource._id]?.status === "crawling"
                                }
                              >
                                <RefreshCw className={`h-4 w-4 mr-1 ${isRefreshing ? "animate-spin" : ""}`} />
                                Refresh
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p className="max-w-xs">Updates the HTML content from the website (quick operation)</p>
                            </TooltipContent>
                          </Tooltip>
                        )}
                        {resource.type === "url" && canReindex && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => restartIndexing(resource._id)}
                                disabled={
                                  isRefreshingIndex[resource._id] ||
                                  indexingStatuses[resource._id]?.status === "crawling" ||
                                  indexingStatuses[resource._id]?.status === "processing"
                                }
                              >
                                <RefreshCw
                                  className={`h-4 w-4 mr-1 ${isRefreshingIndex[resource._id] ? "animate-spin" : ""}`}
                                />
                                {indexingStatuses[resource._id]?.status === "completed" ? "Re-index" : "Refresh Index"}
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p className="max-w-xs">
                                Processes website content for AI use (may take several minutes)
                              </p>
                            </TooltipContent>
                          </Tooltip>
                        )}
                        {(resource.type === "screenshot" || resource.type === "html") && resource.fileUrl && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setPreviewResource(resource)
                              setIsPreviewOpen(true)
                            }}
                          >
                            <Eye className="h-4 w-4 mr-1" />
                            Preview
                          </Button>
                        )}
                        {/* FIXED: Now shows delete button for ALL resources including main website */}
                        {canDelete && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-red-500 hover:text-red-700"
                            onClick={() => {
                              setResourceToDelete(resource._id)
                              setIsDeleteDialogOpen(true)
                            }}
                          >
                            <Trash2 className="h-4 w-4 mr-1" />
                            Delete
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

        <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Confirm Deletion</DialogTitle>
            </DialogHeader>
            <p>Are you sure you want to delete this website resource? This action cannot be undone.</p>
            <div className="flex justify-end space-x-2 mt-4">
              <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={() => resourceToDelete && handleDeleteResource(resourceToDelete)}
                disabled={isDeleting}
              >
                {isDeleting ? "Deleting..." : "Delete"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
          <DialogContent className="max-w-4xl">
            <DialogHeader>
              <DialogTitle>Resource Preview</DialogTitle>
            </DialogHeader>
            {previewResource && previewResource.fileUrl && (
              <div className="mt-2">
                {previewResource.type === "screenshot" ? (
                  <div className="border rounded overflow-hidden max-h-[70vh] overflow-y-auto">
                    <img
                      src={previewResource.fileUrl || "/placeholder.svg"}
                      alt="Website Screenshot"
                      className="max-w-full h-auto"
                    />
                  </div>
                ) : previewResource.type === "html" ? (
                  <div className="border rounded h-[70vh]">
                    <iframe
                      src={previewResource.fileUrl}
                      title="HTML Preview"
                      className="w-full h-full"
                      sandbox="allow-same-origin"
                    />
                  </div>
                ) : null}
              </div>
            )}
            <div className="flex justify-end mt-4">
              <Button onClick={() => setIsPreviewOpen(false)}>Close</Button>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={showInfoDialog} onOpenChange={setShowInfoDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Website Resource Management</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <h3 className="font-medium mb-1">About Website Resources</h3>
                <p className="text-sm text-gray-600">
                  Website resources are used to provide content for your AI chatbot. The AI uses these resources to
                  answer questions about your organization.
                </p>
              </div>

              <div>
                <h3 className="font-medium mb-1">Refresh vs. Re-index</h3>
                <div className="space-y-2">
                  <div className="bg-gray-50 p-3 rounded-md">
                    <p className="font-medium text-sm">Refresh</p>
                    <p className="text-sm text-gray-600">
                      Updates the HTML content from your website. This is a quick operation that takes seconds to
                      complete. Use this when your website content has changed and you want to update the stored copy.
                    </p>
                  </div>

                  <div className="bg-gray-50 p-3 rounded-md">
                    <p className="font-medium text-sm">Re-index (Admin only)</p>
                    <p className="text-sm text-gray-600">
                      Processes your website content for AI use. This operation crawls your website, extracts text, and
                      creates searchable indexes.
                      <span className="block mt-1 font-medium">This can take several minutes to hours</span> depending
                      on the size of your website.
                    </p>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="font-medium mb-1">Main Website</h3>
                <p className="text-sm text-gray-600">
                  The main website URL (marked with a star) is automatically added from your campaign settings. This
                  resource can be deleted if needed, but you may want to add it back later.
                </p>
              </div>
            </div>
            <div className="flex justify-end mt-4">
              <Button onClick={() => setShowInfoDialog(false)}>Close</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  )
}
