"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"

interface SettingsTabProps {
  organizationId: string
  organizationName: string
}

export function SettingsTab({ organizationId, organizationName }: SettingsTabProps) {
  const router = useRouter()
  const [deleteConfirm, setDeleteConfirm] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

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

        <div className="border-t pt-6">
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
    </div>
  )
}
