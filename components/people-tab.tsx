"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Download, Search, UserCircle, Filter } from "lucide-react"
import { toast } from "@/components/ui/use-toast"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { z } from "zod"

interface Person {
  _id: string
  sessionId: string
  firstName?: string
  lastName?: string
  email?: string
  isDonor: boolean
  firstInteraction: string
  lastInteraction: string
  interactionCount: number
}

type FilterType = "all" | "donors" | "visitors"

// Create a schema for search query validation
const searchQuerySchema = z
  .string()
  .trim()
  .refine((query) => !/<script|<\/script|javascript:|on\w+=/i.test(query), "Search query contains invalid characters")

// Add this function after the searchQuerySchema definition
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

export function PeopleTab({ campaignId }: { campaignId: string }) {
  const [people, setPeople] = useState<Person[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [searchError, setSearchError] = useState<string | null>(null)
  const [totalPeople, setTotalPeople] = useState(0)
  const [exporting, setExporting] = useState(false)
  const [filterType, setFilterType] = useState<FilterType>("all")

  const validateSearchQuery = (query: string): boolean => {
    try {
      searchQuerySchema.parse(query)
      setSearchError(null)
      return true
    } catch (err) {
      if (err instanceof z.ZodError) {
        setSearchError(err.errors[0].message)
      } else {
        setSearchError("Invalid search query")
      }
      return false
    }
  }

  // Modify the handleSearchChange function to sanitize input
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value
    const sanitizedQuery = sanitizeInput(query)
    setSearchQuery(sanitizedQuery)

    // Only validate if there's content to validate
    if (sanitizedQuery.trim().length > 0) {
      validateSearchQuery(sanitizedQuery)
    } else {
      setSearchError(null)
    }
  }

  const fetchPeople = async () => {
    try {
      setLoading(true)
      setError(null)

      // Validate search query before fetching
      if (searchQuery.trim().length > 0 && !validateSearchQuery(searchQuery)) {
        setLoading(false)
        return
      }

      // Get the authentication token from localStorage
      const token = localStorage.getItem("token")

      if (!token) {
        setError("Authentication token not found. Please log in again.")
        setLoading(false)
        return
      }

      // Build the query string with search and filter parameters
      let queryString = `search=${encodeURIComponent(searchQuery)}`

      // Add isDonor filter based on the selected filter type
      if (filterType === "donors") {
        queryString += "&isDonor=true"
      } else if (filterType === "visitors") {
        queryString += "&isDonor=false"
      }
      // For "all", we don't add any isDonor filter

      const response = await fetch(`/api/campaigns/${campaignId}/people?${queryString}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      if (response.status === 401) {
        setError("Authentication error. Please log in again.")
        setLoading(false)
        return
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(
          `Failed to fetch people: ${response.status} ${response.statusText}${errorData.details ? ` - ${errorData.details}` : ""}`,
        )
      }

      const data = await response.json()
      setPeople(data.people || [])
      setTotalPeople(data.total || 0)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch people")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (campaignId) {
      fetchPeople()
    }
  }, [campaignId, searchQuery, filterType])

  // Update the exportPeople function to handle errors better
  const exportPeople = async (format: "csv" | "json") => {
    setExporting(true)
    try {
      // Get the token from localStorage
      const token = localStorage.getItem("token")
      if (!token) {
        throw new Error("Authentication token not found")
      }

      // Include the current filter in the export
      let queryString = `format=${format}`
      if (filterType === "donors") {
        queryString += "&isDonor=true"
      } else if (filterType === "visitors") {
        queryString += "&isDonor=false"
      }

      const response = await fetch(`/api/campaigns/${campaignId}/people/export?${queryString}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      if (!response.ok) {
        throw new Error(`Failed to export people data: ${response.status}`)
      }

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `people-${campaignId}.${format}`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (error) {
      toast({
        title: "Export Failed",
        description: "There was an error exporting people data. Please try again.",
        variant: "destructive",
      })
    } finally {
      setExporting(false)
    }
  }

  const handleExport = async () => {
    await exportPeople("csv")
  }

  const formatDate = (dateString: string) => {
    if (!dateString) return "-"
    try {
      const date = new Date(dateString)
      return date.toLocaleDateString() + " " + date.toLocaleTimeString()
    } catch (error) {
      return dateString || "-"
    }
  }

  // Get the filter label for display
  const getFilterLabel = () => {
    switch (filterType) {
      case "donors":
        return "Donors"
      case "visitors":
        return "Visitors"
      default:
        return "All People"
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">People ({totalPeople})</h2>
        <div className="flex gap-2">
          <Button onClick={handleExport} variant="outline" disabled={exporting}>
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      <div className="flex items-center space-x-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search people..."
            className="pl-8"
            value={searchQuery}
            onChange={handleSearchChange}
            aria-invalid={!!searchError}
          />
          {searchError && (
            <div className="text-red-500 text-sm mt-1" role="alert">
              {searchError}
            </div>
          )}
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="gap-2">
              <Filter className="h-4 w-4" />
              {getFilterLabel()}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuRadioGroup value={filterType} onValueChange={(value) => setFilterType(value as FilterType)}>
              <DropdownMenuRadioItem value="all">All People</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="donors">Donors Only</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="visitors">Visitors Only</DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          <p>{error}</p>
        </div>
      )}

      {loading ? (
        <div className="text-center py-4">Loading people data...</div>
      ) : people.length === 0 ? (
        <div className="text-center py-8 border rounded-md">
          <UserCircle className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-semibold">No people found</h3>
          <p className="mt-1 text-sm text-gray-500">
            {filterType === "all"
              ? "People will appear here when they interact with your chatbot."
              : `No ${filterType === "donors" ? "donors" : "visitors"} found. Try changing your filter.`}
          </p>
        </div>
      ) : (
        <div className="border rounded-md overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name / Session ID</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>First Interaction</TableHead>
                <TableHead>Last Interaction</TableHead>
                <TableHead className="text-right">Interactions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {people.map((person) => (
                <TableRow key={person._id}>
                  <TableCell className="font-medium">
                    {person.firstName && person.lastName
                      ? `${person.firstName} ${person.lastName}`
                      : person.sessionId || "-"}
                  </TableCell>
                  <TableCell>{person.email || "-"}</TableCell>
                  <TableCell>
                    {person.isDonor ? (
                      <Badge className="bg-green-500">Donor</Badge>
                    ) : (
                      <Badge variant="outline">Visitor</Badge>
                    )}
                  </TableCell>
                  <TableCell>{formatDate(person.firstInteraction)}</TableCell>
                  <TableCell>{formatDate(person.lastInteraction)}</TableCell>
                  <TableCell className="text-right">{person.interactionCount || 0}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
