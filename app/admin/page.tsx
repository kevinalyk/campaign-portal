"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import Link from "next/link"
import { Users, Building2, RefreshCw, CheckCircle, AlertCircle, Database } from "lucide-react"

export default function AdminDashboard() {
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
  const [isProcessing, setIsProcessing] = useState(false)
  const [processStatus, setProcessStatus] = useState<{
    status?: string
    lastRun?: string
    results?: any
    error?: string
  } | null>(null)
  const [pollingInterval, setPollingInterval] = useState<NodeJS.Timeout | null>(null)
  const [cacheData, setCacheData] = useState<any>(null)
  const [cacheUrl, setCacheUrl] = useState<string>("")
  const [isLoadingCache, setIsLoadingCache] = useState(false)

  // Function to fetch the current status
  const fetchStatus = async () => {
    try {
      const token = localStorage.getItem("token")
      if (!token) {
        throw new Error("No authentication token found")
      }

      const response = await fetch("/api/admin/process-websites", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to get process status")
      }

      setProcessStatus(data)

      // If the process is no longer running, stop polling
      if (data.status !== "running" && pollingInterval) {
        clearInterval(pollingInterval)
        setPollingInterval(null)
        setIsProcessing(false)
      }
    } catch (error) {
      console.error("Error fetching process status:", error)
      if (pollingInterval) {
        clearInterval(pollingInterval)
        setPollingInterval(null)
      }
      setIsProcessing(false)
    }
  }

  // Start polling when component mounts to get the initial status
  useEffect(() => {
    fetchStatus()

    // Clean up interval on unmount
    return () => {
      if (pollingInterval) {
        clearInterval(pollingInterval)
      }
    }
  }, [])

  const handleProcessWebsites = async () => {
    setIsProcessing(true)

    try {
      const token = localStorage.getItem("token")
      if (!token) {
        throw new Error("No authentication token found")
      }

      const response = await fetch("/api/admin/process-websites", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to process websites")
      }

      setProcessStatus(data)

      // Start polling for status updates
      if (pollingInterval) {
        clearInterval(pollingInterval)
      }

      const interval = setInterval(fetchStatus, 2000) // Poll every 2 seconds
      setPollingInterval(interval)
    } catch (error) {
      console.error("Error processing websites:", error)
      setProcessStatus({
        status: "error",
        error: error.message || "An error occurred while processing websites",
      })
      setIsProcessing(false)
    }
  }

  // Function to fetch cache data directly
  const fetchCacheData = async () => {
    if (!cacheUrl) {
      alert("Please enter a URL to check")
      return
    }

    setIsLoadingCache(true)
    setCacheData(null)

    try {
      const token = localStorage.getItem("token")
      if (!token) {
        throw new Error("No authentication token found")
      }

      // Direct database query to get cache data
      const response = await fetch("/api/admin/cache-lookup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ url: cacheUrl }),
      })

      if (!response.ok) {
        throw new Error("Failed to fetch cache data")
      }

      const data = await response.json()
      setCacheData(data)
    } catch (error) {
      console.error("Error fetching cache data:", error)
      setCacheData({ error: error.message || "An error occurred while fetching cache data" })
    } finally {
      setIsLoadingCache(false)
    }
  }

  // Function to clear cache for a URL
  const clearCache = async () => {
    if (!cacheUrl) {
      alert("Please enter a URL to clear")
      return
    }

    if (!confirm(`Are you sure you want to clear the cache for ${cacheUrl}?`)) {
      return
    }

    setIsLoadingCache(true)

    try {
      const token = localStorage.getItem("token")
      if (!token) {
        throw new Error("No authentication token found")
      }

      const response = await fetch("/api/admin/cache-lookup", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ url: cacheUrl }),
      })

      if (!response.ok) {
        throw new Error("Failed to clear cache")
      }

      const data = await response.json()
      alert(data.message || "Cache cleared successfully")
      setCacheData(null)
    } catch (error) {
      console.error("Error clearing cache:", error)
      alert(error.message || "An error occurred while clearing cache")
    } finally {
      setIsLoadingCache(false)
    }
  }

  // Format the date for display
  const formatDate = (dateString: string) => {
    if (!dateString) return "N/A"
    const date = new Date(dateString)
    return date.toLocaleString()
  }

  return (
    <div className="container mx-auto py-10">
      <h1 className="text-2xl font-bold mb-6">Admin Dashboard</h1>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 mb-6">
        <Link href="/admin/users">
          <Card className="h-full cursor-pointer hover:shadow-md transition-shadow">
            <CardHeader>
              <CardTitle className="flex items-center">
                <Users className="mr-2 h-5 w-5" />
                User Management
              </CardTitle>
              <CardDescription>Manage user accounts and permissions</CardDescription>
            </CardHeader>
            <CardContent>
              <p>View, edit, and manage user accounts. Toggle super admin status.</p>
            </CardContent>
          </Card>
        </Link>

        <Link href="/admin/organizations">
          <Card className="h-full cursor-pointer hover:shadow-md transition-shadow">
            <CardHeader>
              <CardTitle className="flex items-center">
                <Building2 className="mr-2 h-5 w-5" />
                Organization Management
              </CardTitle>
              <CardDescription>Manage organizations and their settings</CardDescription>
            </CardHeader>
            <CardContent>
              <p>View, edit, and manage organizations. Toggle active status.</p>
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* Cache Lookup Tool */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center">
            <Database className="mr-2 h-5 w-5" />
            Cache Lookup Tool
          </CardTitle>
          <CardDescription>View and manage cached page content</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <input
              type="text"
              value={cacheUrl}
              onChange={(e) => setCacheUrl(sanitizeInput(e.target.value))}
              placeholder="Enter URL to check cache (e.g., https://wisgop.org/elected-officials/)"
              className="flex-1 px-3 py-2 border rounded-md"
            />
            <Button
              onClick={fetchCacheData}
              disabled={isLoadingCache || !cacheUrl}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {isLoadingCache ? "Loading..." : "Check Cache"}
            </Button>
            <Button onClick={clearCache} disabled={isLoadingCache || !cacheUrl} variant="destructive">
              Clear Cache
            </Button>
          </div>

          {cacheData && (
            <div className="border rounded-md p-4 mt-4">
              <h3 className="font-medium mb-2">Cache Results for: {cacheUrl}</h3>

              {cacheData.error ? (
                <div className="bg-red-50 text-red-700 p-3 rounded-md">Error: {cacheData.error}</div>
              ) : cacheData.notFound ? (
                <div className="bg-yellow-50 text-yellow-700 p-3 rounded-md">No cache entry found for this URL.</div>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-2 mb-4">
                    <div className="bg-gray-100 p-3 rounded-md">
                      <div className="text-sm font-medium text-gray-500">Fetched At</div>
                      <div>{formatDate(cacheData.fetchedAt)}</div>
                    </div>
                    <div className="bg-gray-100 p-3 rounded-md">
                      <div className="text-sm font-medium text-gray-500">Expires At</div>
                      <div>{formatDate(cacheData.expiresAt)}</div>
                    </div>
                  </div>

                  <div className="mb-4">
                    <div className="text-sm font-medium text-gray-500 mb-1">Content Length</div>
                    <div className="bg-gray-100 p-3 rounded-md">
                      {cacheData.content ? cacheData.content.length.toLocaleString() : 0} characters
                    </div>
                  </div>

                  <div>
                    <div className="text-sm font-medium text-gray-500 mb-1">Content Preview</div>
                    <div className="bg-gray-100 p-3 rounded-md max-h-96 overflow-y-auto whitespace-pre-wrap text-sm">
                      {cacheData.content || "No content"}
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center">
            <RefreshCw className="mr-2 h-5 w-5" />
            System Maintenance
          </CardTitle>
          <CardDescription>Perform system maintenance tasks</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="mb-2">
              Process existing websites to ensure all campaigns have their main website URL added as a resource.
            </p>
            <Button
              onClick={handleProcessWebsites}
              disabled={isProcessing || processStatus?.status === "running"}
              className="w-full bg-[#eb3339] hover:bg-[#d42d32]"
            >
              {isProcessing || processStatus?.status === "running" ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Process Existing Websites
                </>
              )}
            </Button>
          </div>

          {processStatus && (
            <div className="border rounded-md p-4 mt-4">
              <h3 className="font-medium mb-2 flex items-center">
                {processStatus.status === "running" && (
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin text-blue-500" />
                )}
                {processStatus.status === "completed" && !processStatus.error && (
                  <CheckCircle className="mr-2 h-4 w-4 text-green-500" />
                )}
                {processStatus.error && <AlertCircle className="mr-2 h-4 w-4 text-red-500" />}
                Process Status: {processStatus.status === "running" ? "Running" : "Completed"}
              </h3>

              {processStatus.lastRun && (
                <p className="text-sm text-gray-500 mb-2">Last run: {formatDate(processStatus.lastRun)}</p>
              )}

              {processStatus.error && (
                <div className="bg-red-50 text-red-700 p-3 rounded-md text-sm mb-2">Error: {processStatus.error}</div>
              )}

              {processStatus.results && (
                <div className="mt-4">
                  <h4 className="font-medium mb-2">Results Summary:</h4>
                  <div className="grid grid-cols-3 gap-2 mb-4">
                    <div className="bg-gray-100 p-3 rounded-md text-center">
                      <div className="text-lg font-bold">{processStatus.results.total}</div>
                      <div className="text-xs text-gray-500">Total</div>
                    </div>
                    <div className="bg-green-50 p-3 rounded-md text-center">
                      <div className="text-lg font-bold text-green-700">{processStatus.results.processed}</div>
                      <div className="text-xs text-gray-500">Processed</div>
                    </div>
                    <div className="bg-yellow-50 p-3 rounded-md text-center">
                      <div className="text-lg font-bold text-yellow-700">{processStatus.results.skipped}</div>
                      <div className="text-xs text-gray-500">Skipped</div>
                    </div>
                  </div>

                  {processStatus.results.errors > 0 && (
                    <div className="bg-red-50 p-3 rounded-md text-center mb-4">
                      <div className="text-lg font-bold text-red-700">{processStatus.results.errors}</div>
                      <div className="text-xs text-gray-500">Errors</div>
                    </div>
                  )}

                  {processStatus.results.details && processStatus.results.details.length > 0 && (
                    <details className="mt-2">
                      <summary className="cursor-pointer text-sm font-medium">
                        View Details ({processStatus.results.details.length} items)
                      </summary>
                      <div className="mt-2 max-h-60 overflow-y-auto text-sm">
                        <table className="min-w-full divide-y divide-gray-200">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Campaign
                              </th>
                              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                URL
                              </th>
                              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Status
                              </th>
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-200">
                            {processStatus.results.details.map((detail, index) => (
                              <tr key={index}>
                                <td className="px-3 py-2 whitespace-nowrap text-xs">{detail.campaignName}</td>
                                <td className="px-3 py-2 whitespace-nowrap text-xs">{detail.url}</td>
                                <td className="px-3 py-2 whitespace-nowrap text-xs">
                                  <span
                                    className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium
                                    ${
                                      detail.status === "processed"
                                        ? "bg-green-100 text-green-800"
                                        : detail.status === "skipped"
                                          ? "bg-yellow-100 text-yellow-800"
                                          : "bg-red-100 text-red-800"
                                    }`}
                                  >
                                    {detail.status}
                                    {detail.error && `: ${detail.error}`}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </details>
                  )}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
