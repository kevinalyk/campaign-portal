"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { LinkIcon, ExternalLink } from "lucide-react"

interface Organization {
  _id: string
  name: string
  url: string
  donationUrl: string
  description: string
  logoUrl?: string
  websiteUrl: string
  createdAt: string
  updatedAt: string
}

export default function OrganizationDetailsPage() {
  const router = useRouter()
  const [organization, setOrganization] = useState<Organization | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchOrganization = async () => {
      try {
        const token = localStorage.getItem("token")
        const organizationId = localStorage.getItem("currentOrganizationId")

        if (!token || !organizationId) {
          router.push("/login")
          return
        }

        const response = await fetch(`/api/campaigns/${organizationId}`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        })

        if (!response.ok) {
          throw new Error("Failed to fetch organization")
        }

        const data = await response.json()
        setOrganization(data.campaign)
      } catch (error) {
        console.error("Error fetching organization:", error)
        setError(error.message)
      } finally {
        setLoading(false)
      }
    }

    fetchOrganization()
  }, [router])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="max-w-4xl mx-auto">
        <Card>
          <CardContent className="pt-6">
            <p className="text-red-500">{error}</p>
            <Button variant="outline" className="mt-4" onClick={() => router.push("/dashboard")}>
              Return to Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!organization) {
    return (
      <div className="max-w-4xl mx-auto">
        <Card>
          <CardContent className="pt-6 text-center">
            <p className="text-gray-500">Organization not found</p>
            <Button variant="outline" className="mt-4" onClick={() => router.push("/dashboard")}>
              Return to Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto">
      <Card>
        <CardContent className="pt-6 space-y-6">
          <div>
            <h3 className="text-sm font-medium text-gray-500 mb-1">Description</h3>
            <p className="text-gray-900">{organization.description}</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h3 className="text-sm font-medium text-gray-500 mb-1">Organization URL</h3>
              <div className="flex items-center space-x-2">
                <p className="text-gray-900 break-all">campaign/{organization.url}</p>
                <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                  <LinkIcon className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div>
              <h3 className="text-sm font-medium text-gray-500 mb-1">WinRed Donation URL</h3>
              <div className="flex items-center space-x-2">
                <p className="text-gray-900 truncate max-w-[200px]">{organization.donationUrl}</p>
                <a href={organization.donationUrl} target="_blank" rel="noopener noreferrer">
                  <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                </a>
              </div>
            </div>

            <div>
              <h3 className="text-sm font-medium text-gray-500 mb-1">Organization Website URL</h3>
              <div className="flex items-center space-x-2">
                <p className="text-gray-900 truncate max-w-[200px]">{organization.websiteUrl}</p>
                <a href={organization.websiteUrl} target="_blank" rel="noopener noreferrer">
                  <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                </a>
              </div>
            </div>
          </div>

          {organization.logoUrl && (
            <div>
              <h3 className="text-sm font-medium text-gray-500 mb-1">Logo</h3>
              <div className="mt-2 w-24 h-24 relative">
                <img
                  src={organization.logoUrl || "/placeholder.svg"}
                  alt={`${organization.name} logo`}
                  className="object-contain"
                  onError={(e) => {
                    e.currentTarget.src = "/placeholder.svg?height=96&width=96"
                  }}
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
