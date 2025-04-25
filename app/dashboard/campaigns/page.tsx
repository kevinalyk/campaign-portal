"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Plus, Search, ArrowRight } from "lucide-react"

interface Campaign {
  _id: string
  name: string
  url: string
  donationUrl: string
  description: string
  logoUrl?: string
  createdAt: string
  updatedAt: string
}

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [filteredCampaigns, setFilteredCampaigns] = useState<Campaign[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchCampaigns = async () => {
      try {
        const token = localStorage.getItem("token")
        if (!token) {
          throw new Error("No authentication token found")
        }

        const response = await fetch("/api/campaigns", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        })

        if (!response.ok) {
          throw new Error("Failed to fetch organizations")
        }

        const data = await response.json()
        setCampaigns(data.campaigns || [])
        setFilteredCampaigns(data.campaigns || [])
      } catch (error) {
        setError(error.message)
      } finally {
        setLoading(false)
      }
    }

    fetchCampaigns()
  }, [])

  useEffect(() => {
    if (searchQuery.trim() === "") {
      setFilteredCampaigns(campaigns)
    } else {
      const query = searchQuery.toLowerCase()
      const filtered = campaigns.filter(
        (campaign) =>
          campaign.name.toLowerCase().includes(query) ||
          campaign.description.toLowerCase().includes(query) ||
          campaign.url.toLowerCase().includes(query),
      )
      setFilteredCampaigns(filtered)
    }
  }, [searchQuery, campaigns])

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-2xl font-bold tracking-tight">Organizations</h1>
        <Link href="/dashboard/campaigns/new">
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            New Organization
          </Button>
        </Link>
      </div>

      <div className="flex items-center space-x-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-500" />
          <Input
            type="search"
            placeholder="Search organizations..."
            className="pl-8"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {loading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader className="pb-2">
                <div className="h-5 bg-gray-200 rounded w-1/2 mb-2"></div>
                <div className="h-4 bg-gray-200 rounded w-3/4"></div>
              </CardHeader>
              <CardContent>
                <div className="h-4 bg-gray-200 rounded w-full mb-2"></div>
                <div className="h-4 bg-gray-200 rounded w-5/6"></div>
              </CardContent>
              <CardFooter>
                <div className="h-9 bg-gray-200 rounded w-full"></div>
              </CardFooter>
            </Card>
          ))
        ) : error ? (
          <Card className="col-span-full">
            <CardContent className="pt-6">
              <p className="text-red-500">{error}</p>
              <Button variant="outline" className="mt-4" onClick={() => setLoading(true)}>
                Retry
              </Button>
            </CardContent>
          </Card>
        ) : filteredCampaigns.length === 0 ? (
          <Card className="col-span-full">
            <CardContent className="pt-6 text-center">
              {searchQuery ? (
                <p className="text-gray-500">No organizations found matching your search.</p>
              ) : (
                <>
                  <p className="text-gray-500 mb-4">You don't have any organizations yet.</p>
                  <Link href="/dashboard/campaigns/new">
                    <Button>
                      <Plus className="h-4 w-4 mr-2" />
                      Create Your First Organization
                    </Button>
                  </Link>
                </>
              )}
            </CardContent>
          </Card>
        ) : (
          filteredCampaigns.map((campaign) => (
            <Card key={campaign._id}>
              <CardHeader>
                <CardTitle>{campaign.name}</CardTitle>
                <CardDescription>{campaign.url}</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-500 line-clamp-2">{campaign.description}</p>
              </CardContent>
              <CardFooter>
                <Link href={`/dashboard/campaigns/${campaign.url}`} className="w-full">
                  <Button variant="outline" className="w-full">
                    View Organization
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                </Link>
              </CardFooter>
            </Card>
          ))
        )}
      </div>
    </div>
  )
}
