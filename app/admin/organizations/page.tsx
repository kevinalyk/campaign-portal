"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Search, ExternalLink, Trash2, ToggleLeft, ToggleRight } from "lucide-react"
import Link from "next/link"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

interface Campaign {
  _id: string
  name: string
  url: string
  donationUrl: string
  websiteUrl: string
  description: string
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export default function OrganizationsManagement() {
  // Add this sanitizeInput function right after the component declaration
  const sanitizeInput = (input: string): string => {
    if (!input) return input
    // Remove HTML tags
    let sanitized = input.replace(/<[^>]*>/g, "")
    // Remove dangerous patterns
    sanitized = sanitized.replace(/javascript:/gi, "")
    sanitized = sanitized.replace(/data:/gi, "")
    sanitized = sanitized.replace(/vbscript:/gi, "")
    sanitized = sanitized.replace(/on\w+=/gi, "")
    return sanitized
  }
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [filteredCampaigns, setFilteredCampaigns] = useState<Campaign[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [campaignToDelete, setCampaignToDelete] = useState<Campaign | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isStatusDialogOpen, setIsStatusDialogOpen] = useState(false)
  const [campaignToToggleStatus, setCampaignToToggleStatus] = useState<Campaign | null>(null)
  const [isTogglingStatus, setIsTogglingStatus] = useState(false)

  useEffect(() => {
    fetchCampaigns()
  }, [])

  useEffect(() => {
    let filtered = campaigns

    // Apply status filter
    if (statusFilter === "active") {
      filtered = filtered.filter((campaign) => campaign.isActive)
    } else if (statusFilter === "inactive") {
      filtered = filtered.filter((campaign) => !campaign.isActive)
    }

    // Apply search filter
    if (searchQuery.trim() !== "") {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(
        (campaign) =>
          campaign.name.toLowerCase().includes(query) ||
          campaign.url.toLowerCase().includes(query) ||
          campaign.description.toLowerCase().includes(query),
      )
    }

    setFilteredCampaigns(filtered)
  }, [searchQuery, statusFilter, campaigns])

  const fetchCampaigns = async () => {
    setLoading(true)
    setError(null)

    try {
      const token = localStorage.getItem("token")
      if (!token) {
        throw new Error("No authentication token found")
      }

      const response = await fetch("/api/admin/campaigns", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      if (!response.ok) {
        throw new Error("Failed to fetch organizations")
      }

      const data = await response.json()

      // If any campaigns don't have isActive field, assume they are active
      const campaignsWithStatus = data.campaigns.map((campaign: any) => ({
        ...campaign,
        isActive: campaign.isActive === undefined ? true : campaign.isActive,
      }))

      setCampaigns(campaignsWithStatus || [])
      setFilteredCampaigns(campaignsWithStatus || [])
    } catch (error) {
      console.error("Error fetching organizations:", error)
      setError(error.message)
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteCampaign = async () => {
    if (!campaignToDelete) return

    setIsDeleting(true)

    try {
      const token = localStorage.getItem("token")
      if (!token) {
        throw new Error("No authentication token found")
      }

      const response = await fetch(`/api/admin/campaigns/${campaignToDelete._id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.message || "Failed to delete organization")
      }

      // Remove the campaign from the list
      setCampaigns((prev) => prev.filter((campaign) => campaign._id !== campaignToDelete._id))
      setIsDeleteDialogOpen(false)
    } catch (error) {
      console.error("Error deleting organization:", error)
      setError(error.message)
    } finally {
      setIsDeleting(false)
      setCampaignToDelete(null)
    }
  }

  const handleToggleCampaignStatus = async () => {
    if (!campaignToToggleStatus) return

    setIsTogglingStatus(true)

    try {
      const token = localStorage.getItem("token")
      if (!token) {
        throw new Error("No authentication token found")
      }

      const newStatus = !campaignToToggleStatus.isActive

      const response = await fetch(`/api/admin/campaigns/${campaignToToggleStatus._id}/status`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ isActive: newStatus }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.message || `Failed to ${newStatus ? "activate" : "deactivate"} organization`)
      }

      // Update the campaign in the list
      setCampaigns((prevCampaigns) =>
        prevCampaigns.map((campaign) =>
          campaign._id === campaignToToggleStatus._id ? { ...campaign, isActive: newStatus } : campaign,
        ),
      )

      setIsStatusDialogOpen(false)
    } catch (error) {
      console.error("Error toggling organization status:", error)
      setError(error.message)
    } finally {
      setIsTogglingStatus(false)
      setCampaignToToggleStatus(null)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString()
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-3xl font-bold">All Organizations</h1>
        <Button onClick={fetchCampaigns}>Refresh</Button>
      </div>

      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-500" />
          <Input
            type="search"
            placeholder="Search organizations..."
            className="pl-8"
            value={searchQuery}
            onChange={(e) => setSearchQuery(sanitizeInput(e.target.value))}
          />
        </div>
        <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as any)}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Organizations</SelectItem>
            <SelectItem value="active">Active Organizations</SelectItem>
            <SelectItem value="inactive">Inactive Organizations</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {error && (
        <Card>
          <CardContent className="p-6">
            <p className="text-red-500">{error}</p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>All Organizations ({filteredCampaigns.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>URL</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCampaigns.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-4">
                      No organizations found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredCampaigns.map((campaign) => (
                    <TableRow key={campaign._id} className={!campaign.isActive ? "bg-gray-50" : ""}>
                      <TableCell className="font-medium">{campaign.name}</TableCell>
                      <TableCell>campaign/{campaign.url}</TableCell>
                      <TableCell>
                        {campaign.isActive ? (
                          <Badge variant="outline" className="bg-green-50 text-green-700 hover:bg-green-50">
                            Active
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="bg-red-50 text-red-700 hover:bg-red-50">
                            Inactive
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>{formatDate(campaign.createdAt)}</TableCell>
                      <TableCell>
                        <div className="flex space-x-2">
                          <Link href={`/dashboard/campaigns/${campaign.url}`} target="_blank">
                            <Button variant="outline" size="sm">
                              <ExternalLink className="h-4 w-4 mr-2" />
                              View
                            </Button>
                          </Link>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setCampaignToToggleStatus(campaign)
                              setIsStatusDialogOpen(true)
                            }}
                          >
                            {campaign.isActive ? (
                              <>
                                <ToggleLeft className="h-4 w-4 mr-2" />
                                Deactivate
                              </>
                            ) : (
                              <>
                                <ToggleRight className="h-4 w-4 mr-2" />
                                Activate
                              </>
                            )}
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-red-500 hover:text-red-700"
                            onClick={() => {
                              setCampaignToDelete(campaign)
                              setIsDeleteDialogOpen(true)
                            }}
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Delete Organization Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Deletion</DialogTitle>
          </DialogHeader>
          <p>
            Are you sure you want to delete the organization "{campaignToDelete?.name}"? This action cannot be undone
            and will remove all associated data.
          </p>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteCampaign} disabled={isDeleting}>
              {isDeleting ? "Deleting..." : "Delete Organization"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Toggle Organization Status Dialog */}
      <Dialog open={isStatusDialogOpen} onOpenChange={setIsStatusDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {campaignToToggleStatus?.isActive ? "Deactivate Organization" : "Activate Organization"}
            </DialogTitle>
          </DialogHeader>
          <p>
            Are you sure you want to {campaignToToggleStatus?.isActive ? "deactivate" : "activate"} the organization "
            {campaignToToggleStatus?.name}"?
            {campaignToToggleStatus?.isActive
              ? " Deactivated organizations will not be accessible to users but their data will be preserved."
              : " Activating this organization will make it accessible to users again."}
          </p>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setIsStatusDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              variant={campaignToToggleStatus?.isActive ? "destructive" : "default"}
              onClick={handleToggleCampaignStatus}
              disabled={isTogglingStatus}
            >
              {isTogglingStatus
                ? campaignToToggleStatus?.isActive
                  ? "Deactivating..."
                  : "Activating..."
                : campaignToToggleStatus?.isActive
                  ? "Deactivate Organization"
                  : "Activate Organization"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
