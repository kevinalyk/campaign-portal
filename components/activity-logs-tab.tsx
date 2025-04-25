"use client"

import { useState, useEffect } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import {
  FileText,
  Globe,
  Users,
  Settings,
  Calendar,
  RefreshCw,
  Upload,
  Download,
  Trash,
  Edit,
  Plus,
  Mail,
  ClipboardList,
  AlertCircle,
} from "lucide-react"
import { formatDistanceToNow } from "date-fns"

interface ActivityLog {
  _id: string
  action: string
  entityType: string
  entityId?: string
  userName: string
  details?: any
  timestamp: string
}

interface ActivityLogsTabProps {
  organizationId: string
}

export function ActivityLogsTab({ organizationId }: ActivityLogsTabProps) {
  const [logs, setLogs] = useState<ActivityLog[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState("all")
  const [page, setPage] = useState(0)
  const [hasMore, setHasMore] = useState(true)
  const limit = 20

  const fetchLogs = async (reset = false) => {
    try {
      setLoading(true)
      setError(null)

      const newPage = reset ? 0 : page
      const skip = newPage * limit

      let url = `/api/campaigns/${organizationId}/activity-logs?limit=${limit}&skip=${skip}`

      if (activeTab !== "all") {
        url += `&entityType=${activeTab}`
      }

      const token = localStorage.getItem("token")
      if (!token) {
        throw new Error("Authentication token not found")
      }

      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.message || "Failed to fetch logs")
      }

      const data = await response.json()

      if (reset) {
        setLogs(data.logs || [])
        setPage(1)
      } else {
        setLogs((prevLogs) => [...prevLogs, ...(data.logs || [])])
        setPage(newPage + 1)
      }

      setHasMore((data.logs || []).length === limit)
    } catch (error) {
      setError(error.message || "Failed to load activity logs")
    } finally {
      setLoading(false)
    }
  }

  // Fetch logs when component mounts or when tab changes
  useEffect(() => {
    fetchLogs(true)
  }, [organizationId, activeTab])

  const handleTabChange = (value: string) => {
    setActiveTab(value)
  }

  const getActionIcon = (action: string) => {
    switch (action) {
      case "create":
        return <Plus className="h-4 w-4" />
      case "update":
        return <Edit className="h-4 w-4" />
      case "delete":
        return <Trash className="h-4 w-4" />
      case "upload":
        return <Upload className="h-4 w-4" />
      case "download":
        return <Download className="h-4 w-4" />
      case "add":
        return <Plus className="h-4 w-4" />
      case "remove":
        return <Trash className="h-4 w-4" />
      default:
        return <Edit className="h-4 w-4" />
    }
  }

  const getEntityIcon = (entityType: string) => {
    switch (entityType) {
      case "document":
        return <FileText className="h-4 w-4" />
      case "website":
        return <Globe className="h-4 w-4" />
      case "user":
        return <Users className="h-4 w-4" />
      case "campaign":
        return <Settings className="h-4 w-4" />
      case "chat_settings":
        return <Settings className="h-4 w-4" />
      case "contact_info":
        return <Mail className="h-4 w-4" />
      default:
        return <Settings className="h-4 w-4" />
    }
  }

  const getActionColor = (action: string) => {
    switch (action) {
      case "create":
      case "add":
      case "upload":
        return "bg-green-100 text-green-800"
      case "update":
        return "bg-blue-100 text-blue-800"
      case "delete":
      case "remove":
        return "bg-red-100 text-red-800"
      case "download":
        return "bg-purple-100 text-purple-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  const formatActionText = (log: ActivityLog) => {
    const { action, entityType, details } = log

    let entityName = entityType.replace("_", " ")

    // Get specific name if available in details
    if (details) {
      if (details.name) entityName = details.name
      else if (details.title) entityName = details.title
      else if (details.email) entityName = details.email
      else if (details.url) entityName = details.url
    }

    switch (action) {
      case "create":
        return `Created ${entityType} "${entityName}"`
      case "update":
        return `Updated ${entityType} "${entityName}"`
      case "delete":
        return `Deleted ${entityType} "${entityName}"`
      case "upload":
        return `Uploaded ${entityType} "${entityName}"`
      case "download":
        return `Downloaded ${entityType} "${entityName}"`
      case "add":
        return `Added ${entityType} "${entityName}"`
      case "remove":
        return `Removed ${entityType} "${entityName}"`
      default:
        return `${action} ${entityType} "${entityName}"`
    }
  }

  return (
    <div>
      <h3 className="text-lg font-medium mb-4">Activity Logs</h3>
      <p className="text-gray-500 mb-4">Track all activities and changes made to this organization</p>

      <Tabs defaultValue="all" value={activeTab} onValueChange={handleTabChange}>
        <div className="flex justify-between items-center mb-4">
          <TabsList>
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="document">Documents</TabsTrigger>
            <TabsTrigger value="website">Website</TabsTrigger>
            <TabsTrigger value="user">Users</TabsTrigger>
            <TabsTrigger value="campaign">Organization</TabsTrigger>
          </TabsList>
          <Button variant="outline" size="sm" onClick={() => fetchLogs(true)} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>

        <TabsContent value={activeTab} className="mt-0">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-md mb-4 flex items-center">
              <AlertCircle className="h-5 w-5 mr-2" />
              <p>{error}</p>
            </div>
          )}

          <div className="space-y-4">
            {loading && logs.length === 0 ? (
              Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-start space-x-4 p-4 border rounded-md">
                  <Skeleton className="h-10 w-10 rounded-full" />
                  <div className="space-y-2 flex-1">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-4 w-1/2" />
                  </div>
                  <Skeleton className="h-4 w-24" />
                </div>
              ))
            ) : logs.length > 0 ? (
              <>
                {logs.map((log) => (
                  <div key={log._id} className="flex items-start space-x-4 p-4 border rounded-md hover:bg-gray-50">
                    <div className="bg-gray-100 p-2 rounded-full">{getEntityIcon(log.entityType)}</div>
                    <div className="flex-1">
                      <div className="flex items-center space-x-2">
                        <p className="font-medium">{log.userName}</p>
                        <Badge variant="outline" className={getActionColor(log.action)}>
                          <span className="flex items-center">
                            {getActionIcon(log.action)}
                            <span className="ml-1 capitalize">{log.action}</span>
                          </span>
                        </Badge>
                      </div>
                      <p className="text-sm text-gray-600">{formatActionText(log)}</p>
                    </div>
                    <div className="flex items-center text-xs text-gray-500">
                      <Calendar className="h-3 w-3 mr-1" />
                      {formatDistanceToNow(new Date(log.timestamp), { addSuffix: true })}
                    </div>
                  </div>
                ))}

                {hasMore && (
                  <div className="flex justify-center mt-4">
                    <Button variant="outline" onClick={() => fetchLogs(false)} disabled={loading}>
                      {loading ? "Loading..." : "Load More"}
                    </Button>
                  </div>
                )}
              </>
            ) : (
              <div className="text-center py-12 border border-dashed rounded-md">
                <ClipboardList className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-1">No activity logs yet</h3>
                <p className="text-gray-500 mb-4">
                  Activity logs will appear here as you make changes to your organization.
                </p>
                <p className="text-sm text-gray-500">
                  Try uploading a document, adding a website, or updating organization details.
                </p>
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
