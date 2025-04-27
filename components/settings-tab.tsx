"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { AlertTriangle } from "lucide-react"

interface SettingsTabProps {
  organizationId: string
  organizationName: string
}

export function SettingsTab({ organizationId, organizationName }: SettingsTabProps) {
  const router = useRouter()
  const [deleteConfirm, setDeleteConfirm] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [rateLimitEnabled, setRateLimitEnabled] = useState(true)
  const [showRateLimitWarning, setShowRateLimitWarning] = useState(false)
  const [isUpdating, setIsUpdating] = useState(false)
  const [updateSuccess, setUpdateSuccess] = useState(false)

  const handleDelete = async () => {
    if (!deleteConfirm) {
      setDeleteConfirm(true)
      return
    }

    setIsDeleting(true)

    try {
      const token = localStorage.getItem("token")
      if (!token) {
        throw new Error("No authentication token found")
      }

      const response = await fetch(`/api/campaigns/${organizationId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      if (!response.ok) {
        throw new Error("Failed to delete organization")
      }

      router.push("/dashboard/campaigns")
    } catch (err: any) {
      console.error("Error deleting campaign:", err)
      setError(err.message)
      setDeleteConfirm(false)
    } finally {
      setIsDeleting(false)
    }
  }

  const handleRateLimitToggle = (checked: boolean) => {
    if (checked) {
      // Enabling rate limiting is always allowed without confirmation
      updateRateLimitSetting(true)
    } else {
      // Show warning dialog when trying to disable
      setShowRateLimitWarning(true)
    }
  }

  const confirmDisableRateLimit = () => {
    updateRateLimitSetting(false)
    setShowRateLimitWarning(false)
  }

  const cancelDisableRateLimit = () => {
    setRateLimitEnabled(true) // Reset the toggle
    setShowRateLimitWarning(false)
  }

  const updateRateLimitSetting = async (enabled: boolean) => {
    setIsUpdating(true)
    setUpdateSuccess(false)

    try {
      const token = localStorage.getItem("token")
      if (!token) {
        throw new Error("No authentication token found")
      }

      const response = await fetch(`/api/campaigns/${organizationId}/chat-settings`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ chatRateLimitEnabled: enabled }),
      })

      if (!response.ok) {
        throw new Error("Failed to update rate limit settings")
      }

      setRateLimitEnabled(enabled)
      setUpdateSuccess(true)

      // Hide success message after 3 seconds
      setTimeout(() => setUpdateSuccess(false), 3000)
    } catch (err: any) {
      console.error("Error updating rate limit settings:", err)
      setError(err.message)
      // Reset the toggle to its previous state on error
      setRateLimitEnabled(!enabled)
    } finally {
      setIsUpdating(false)
    }
  }

  // Fetch the current rate limit setting when the component mounts
  useState(() => {
    const fetchCampaignSettings = async () => {
      try {
        const token = localStorage.getItem("token")
        if (!token) return

        const response = await fetch(`/api/campaigns/${organizationId}`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        })

        if (response.ok) {
          const data = await response.json()
          // Set the initial state based on the campaign setting
          // If the setting doesn't exist yet, default to true
          setRateLimitEnabled(data.campaign.chatRateLimitEnabled !== false)
        }
      } catch (error) {
        console.error("Error fetching campaign settings:", error)
      }
    }

    fetchCampaignSettings()
  }, [organizationId])

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-lg shadow-sm">
        <h2 className="text-xl font-semibold mb-4">Organization Settings</h2>
        <p className="text-gray-500 mb-6">Manage your organization settings and actions</p>

        <div className="mb-8">
          <h3 className="text-lg font-medium mb-2">Edit Organization</h3>
          <p className="text-sm text-gray-500 mb-4">Update your organization details, URL, and other information.</p>
          <Link href={`/dashboard/campaigns/${window.location.pathname.split("/").pop()}/edit?returnTab=settings`}>
            <Button variant="outline">Edit Organization</Button>
          </Link>
        </div>

        <div className="border-t border-b py-6 mb-6">
          <h3 className="text-lg font-medium mb-4">Security Settings</h3>

          <div className="flex items-center justify-between">
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <Label htmlFor="rate-limit" className="font-medium">
                  Chat Rate Limiting
                </Label>
              </div>
              <p className="text-sm text-gray-500">
                Prevents abuse by limiting how frequently users can send messages to your chatbot.
              </p>
            </div>
            <Switch
              id="rate-limit"
              checked={rateLimitEnabled}
              onCheckedChange={handleRateLimitToggle}
              disabled={isUpdating}
            />
          </div>

          {updateSuccess && <p className="text-green-600 text-sm mt-2">Settings updated successfully!</p>}
        </div>

        <div className="border-b pt-6 pb-6">
          <h3 className="text-lg font-medium mb-2 text-red-600">Danger Zone</h3>
          <p className="text-sm text-gray-500 mb-4">
            Permanently delete this organization and all of its data. This action cannot be undone.
          </p>
          <Button variant="destructive" onClick={handleDelete} disabled={isDeleting}>
            {deleteConfirm ? (isDeleting ? "Deleting..." : "Confirm Delete?") : "Delete Organization"}
          </Button>
          {error && <p className="text-red-500 text-sm mt-2">{error}</p>}
        </div>
      </div>

      {/* Rate Limit Warning Dialog */}
      <Dialog open={showRateLimitWarning} onOpenChange={setShowRateLimitWarning}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center text-red-600">
              <AlertTriangle className="h-5 w-5 mr-2" />
              Warning: Disabling Rate Limiting
            </DialogTitle>
            <DialogDescription>
              <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md text-red-800">
                <p className="font-medium mb-2">Disabling rate limiting exposes your chatbot to potential abuse:</p>
                <ul className="list-disc pl-5 space-y-1 text-sm">
                  <li>Automated bots could flood your chatbot with requests</li>
                  <li>Your campaign data could be systematically scraped</li>
                  <li>Service quality may degrade for legitimate users</li>
                  <li>Excessive resource consumption may occur</li>
                </ul>
              </div>
              <p className="mt-4 font-medium">Are you sure you want to disable this protection?</p>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex flex-col sm:flex-row sm:justify-between gap-2">
            <Button variant="outline" onClick={cancelDisableRateLimit}>
              Keep Protection Enabled
            </Button>
            <Button variant="destructive" onClick={confirmDisableRateLimit}>
              Disable Protection
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
