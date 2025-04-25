"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { format } from "date-fns"
import { CalendarIcon, Download, Search, RefreshCw, X, Trash2 } from "lucide-react"
import { toast } from "@/hooks/use-toast"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

// Add the import for the ChatTimelineChart component at the top of the file
import { ChatTimelineChart } from "./chat-timeline-chart"
// Add the import for the FeedbackReporting component at the top of the file
import { FeedbackReporting } from "./feedback-reporting"

// Add sanitization function
const sanitizeText = (text: string): string => {
  if (!text) return ""

  // Remove HTML tags
  let sanitized = text.replace(/<[^>]*>/g, "")

  // Remove JavaScript protocol
  sanitized = sanitized.replace(/javascript:/gi, "")

  // Remove event handlers
  sanitized = sanitized.replace(/on\w+=/gi, "")

  // Remove HTML encoded characters
  sanitized = sanitized.replace(/&[#\w]+;/gi, "")

  return sanitized
}

interface ChatLogsTabProps {
  campaignId: string
}

export function ChatLogsTab({ campaignId }: ChatLogsTabProps) {
  // State for sessions list
  const [sessions, setSessions] = useState<any[]>([])
  const [totalSessions, setTotalSessions] = useState(0)
  const [sessionsPage, setSessionsPage] = useState(1)
  const [sessionsPerPage] = useState(10)
  const [isLoadingSessions, setIsLoadingSessions] = useState(false)

  // State for conversation view
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null)
  const [conversation, setConversation] = useState<any[]>([])
  const [isLoadingConversation, setIsLoadingConversation] = useState(false)

  // State for filters
  const [startDate, setStartDate] = useState<Date | undefined>(undefined)
  const [endDate, setEndDate] = useState<Date | undefined>(undefined)
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false)
  const [dateSelectionStep, setDateSelectionStep] = useState<"start" | "end">("start")
  const [searchQuery, setSearchQuery] = useState("")

  // State for multi-select
  const [selectedSessions, setSelectedSessions] = useState<Set<string>>(new Set())
  const [isExporting, setIsExporting] = useState(false)

  // State for delete confirmation
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [sessionToDelete, setSessionToDelete] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  // Fetch sessions on initial load and when filters change
  useEffect(() => {
    fetchSessions()
  }, [campaignId, sessionsPage, startDate, endDate])

  // Fetch conversation when a session is selected
  useEffect(() => {
    if (selectedSessionId) {
      fetchConversation(selectedSessionId)
    } else {
      setConversation([])
    }
  }, [selectedSessionId])

  // Reset date selection step when date picker is closed
  useEffect(() => {
    if (!isDatePickerOpen) {
      setDateSelectionStep("start")
    }
  }, [isDatePickerOpen])

  const fetchSessions = async () => {
    setIsLoadingSessions(true)
    try {
      const token = localStorage.getItem("token")
      if (!token) {
        throw new Error("No authentication token found")
      }

      let url = `/api/campaigns/${campaignId}/chat-logs/sessions?limit=${sessionsPerPage}&skip=${
        (sessionsPage - 1) * sessionsPerPage
      }`

      if (startDate) {
        url += `&startDate=${startDate.toISOString()}`
      }
      if (endDate) {
        url += `&endDate=${endDate.toISOString()}`
      }
      if (searchQuery) {
        // Ensure the search query is sanitized before adding to URL
        const sanitizedQuery = sanitizeText(searchQuery)
        url += `&search=${encodeURIComponent(sanitizedQuery)}`
      }

      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      if (!response.ok) {
        throw new Error("Failed to fetch chat sessions")
      }

      const data = await response.json()
      setSessions(data.sessions)
      setTotalSessions(data.total)

      // Clear selections that no longer exist in the results
      const newSelectedSessions = new Set<string>()
      selectedSessions.forEach((id) => {
        if (data.sessions.some((session: any) => session._id === id)) {
          newSelectedSessions.add(id)
        }
      })
      setSelectedSessions(newSelectedSessions)

      // If the selected session was deleted, clear it
      if (selectedSessionId && !data.sessions.some((session: any) => session._id === selectedSessionId)) {
        setSelectedSessionId(null)
      }
    } catch (error) {
      console.error("Error fetching chat sessions:", error)
      toast({
        title: "Error",
        description: "Failed to load chat sessions",
        variant: "destructive",
      })
    } finally {
      setIsLoadingSessions(false)
    }
  }

  const fetchConversation = async (sessionId: string) => {
    setIsLoadingConversation(true)
    try {
      const token = localStorage.getItem("token")
      if (!token) {
        throw new Error("No authentication token found")
      }

      const response = await fetch(`/api/campaigns/${campaignId}/chat-logs?sessionId=${sessionId}&sort=asc`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      if (!response.ok) {
        throw new Error("Failed to fetch conversation")
      }

      const data = await response.json()
      setConversation(data.logs)
    } catch (error) {
      console.error("Error fetching conversation:", error)
      toast({
        title: "Error",
        description: "Failed to load conversation",
        variant: "destructive",
      })
    } finally {
      setIsLoadingConversation(false)
    }
  }

  const handleExportSelected = async () => {
    if (selectedSessions.size === 0) {
      toast({
        title: "No sessions selected",
        description: "Please select at least one conversation to export",
        variant: "destructive",
      })
      return
    }

    setIsExporting(true)
    try {
      const token = localStorage.getItem("token")
      if (!token) {
        throw new Error("No authentication token found")
      }

      const sessionIds = Array.from(selectedSessions).join(",")
      const url = `/api/campaigns/${campaignId}/chat-logs/export?format=csv&sessionIds=${sessionIds}`

      // Create a hidden anchor element to trigger the download
      const a = document.createElement("a")
      a.style.display = "none"
      a.href = url
      a.download = `chat-logs-${campaignId}-${new Date().toISOString().split("T")[0]}.csv`

      // Add the token to the request
      const headers = new Headers()
      headers.append("Authorization", `Bearer ${token}`)

      // Fetch the file
      const response = await fetch(url, { headers })
      const blob = await response.blob()

      // Create a URL for the blob
      const blobUrl = window.URL.createObjectURL(blob)
      a.href = blobUrl

      // Append to the document and trigger the download
      document.body.appendChild(a)
      a.click()

      // Clean up
      window.URL.revokeObjectURL(blobUrl)
      document.body.removeChild(a)

      toast({
        title: "Success",
        description: `Exported ${selectedSessions.size} conversation(s)`,
      })

      // Clear selections after export
      setSelectedSessions(new Set())
    } catch (error) {
      console.error("Error exporting chat logs:", error)
      toast({
        title: "Error",
        description: "Failed to export chat logs",
        variant: "destructive",
      })
    } finally {
      setIsExporting(false)
    }
  }

  const handleDeleteSession = async (sessionId: string) => {
    setSessionToDelete(sessionId)
    setIsDeleteDialogOpen(true)
  }

  const confirmDeleteSession = async () => {
    if (selectedSessions.size === 0) return

    setIsDeleting(true)
    try {
      const token = localStorage.getItem("token")
      if (!token) {
        throw new Error("No authentication token found")
      }

      // If we're deleting multiple sessions
      if (selectedSessions.size > 1) {
        let successCount = 0
        let failCount = 0

        for (const sessionId of selectedSessions) {
          try {
            const response = await fetch(`/api/campaigns/${campaignId}/chat-logs/${sessionId}`, {
              method: "DELETE",
              headers: {
                Authorization: `Bearer ${token}`,
              },
            })

            if (response.ok) {
              successCount++

              // If the deleted session was selected, clear it
              if (selectedSessionId === sessionId) {
                setSelectedSessionId(null)
                setConversation([])
              }
            } else {
              failCount++
            }
          } catch (error) {
            console.error(`Error deleting session ${sessionId}:`, error)
            failCount++
          }
        }

        // Refresh the sessions list
        fetchSessions()

        if (successCount > 0) {
          toast({
            title: "Success",
            description: `Deleted ${successCount} conversation(s)${failCount > 0 ? `, ${failCount} failed` : ""}`,
          })
        } else {
          toast({
            title: "Error",
            description: "Failed to delete conversations",
            variant: "destructive",
          })
        }

        // Clear selections after delete
        setSelectedSessions(new Set())
      }
      // If we're deleting a single session
      else if (sessionToDelete) {
        const sessionId = sessionToDelete
        const response = await fetch(`/api/campaigns/${campaignId}/chat-logs/${sessionId}`, {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        })

        if (!response.ok) {
          throw new Error("Failed to delete chat session")
        }

        const data = await response.json()

        // If the deleted session was selected, clear it
        if (selectedSessionId === sessionId) {
          setSelectedSessionId(null)
          setConversation([])
        }

        // Refresh the sessions list
        fetchSessions()

        toast({
          title: "Success",
          description: `Deleted conversation with ${data.deletedCount} messages`,
        })

        // Clear selections after delete
        setSelectedSessions(new Set())
      }
    } catch (error) {
      console.error("Error deleting chat session:", error)
      toast({
        title: "Error",
        description: "Failed to delete chat session",
        variant: "destructive",
      })
    } finally {
      setIsDeleting(false)
      setIsDeleteDialogOpen(false)
      setSessionToDelete(null)
    }
  }

  const handleDateSelect = (date: Date | undefined) => {
    if (dateSelectionStep === "start") {
      setStartDate(date)
      setDateSelectionStep("end")
      // If end date is before start date, reset it
      if (endDate && date && endDate < date) {
        setEndDate(undefined)
      }
    } else {
      setEndDate(date)
      // Close the popover after selecting end date
      setIsDatePickerOpen(false)
    }
  }

  const resetDateSelection = () => {
    setStartDate(undefined)
    setEndDate(undefined)
    setDateSelectionStep("start")
    setIsDatePickerOpen(false)
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    // Sanitize the search query before using it
    setSearchQuery(sanitizeText(searchQuery))
    fetchSessions()
  }

  const clearSearch = () => {
    setSearchQuery("")
    // Only trigger a new search if there was a previous search term
    if (searchQuery) {
      setTimeout(() => fetchSessions(), 0)
    }
  }

  const toggleSessionSelection = (sessionId: string) => {
    const newSelectedSessions = new Set(selectedSessions)
    if (newSelectedSessions.has(sessionId)) {
      newSelectedSessions.delete(sessionId)
    } else {
      newSelectedSessions.add(sessionId)
    }
    setSelectedSessions(newSelectedSessions)
  }

  const selectAllSessions = () => {
    if (selectedSessions.size === sessions.length) {
      // If all are selected, deselect all
      setSelectedSessions(new Set())
    } else {
      // Otherwise, select all
      const newSelectedSessions = new Set<string>()
      sessions.forEach((session) => {
        newSelectedSessions.add(session._id)
      })
      setSelectedSessions(newSelectedSessions)
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return format(date, "MMM d, yyyy h:mm a")
  }

  const formatDateRange = () => {
    if (startDate && endDate) {
      return `${format(startDate, "MMM d, yyyy")} - ${format(endDate, "MMM d, yyyy")}`
    } else if (startDate) {
      return `From ${format(startDate, "MMM d, yyyy")}`
    } else if (endDate) {
      return `Until ${format(endDate, "MMM d, yyyy")}`
    }
    return "All time"
  }

  // Function to truncate text to a specific length
  const truncateText = (text: string, maxLength = 30) => {
    if (!text) return "Chat session"
    return text.length > maxLength ? text.substring(0, maxLength) + "..." : text
  }

  const totalPages = Math.ceil(totalSessions / sessionsPerPage)

  return (
    <div className="space-y-6">
      <ChatTimelineChart campaignId={campaignId} />
      <FeedbackReporting campaignId={campaignId} startDate={startDate} endDate={endDate} />
      <div>
        <h2 className="text-2xl font-bold">Chat Activity</h2>
        <p className="text-gray-500">View and export chat conversations</p>
      </div>

      {/* Filters Section */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-4">
            {/* Search */}
            <div className="flex-1">
              <form onSubmit={handleSearch} className="relative">
                <Input
                  type="text"
                  placeholder="Search conversations..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(sanitizeText(e.target.value))}
                  className="pr-10"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={clearSearch}
                    className="absolute right-10 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
                <button
                  type="submit"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                >
                  <Search className="h-4 w-4" />
                </button>
              </form>
            </div>

            {/* Date Filter */}
            <div>
              <Popover open={isDatePickerOpen} onOpenChange={setIsDatePickerOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="flex items-center gap-2 w-full md:w-auto">
                    <CalendarIcon className="h-4 w-4" />
                    <span>{formatDateRange()}</span>
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="end">
                  <div className="p-4 space-y-4">
                    <div className="grid gap-2">
                      <Label htmlFor="dateRange">
                        {dateSelectionStep === "start" ? "Select Start Date" : "Select End Date"}
                      </Label>
                      <Calendar
                        mode="single"
                        selected={dateSelectionStep === "start" ? startDate : endDate}
                        onSelect={handleDateSelect}
                        initialFocus
                        disabled={
                          dateSelectionStep === "end" ? (date) => (startDate ? date < startDate : false) : undefined
                        }
                      />
                    </div>
                    <div className="flex justify-between">
                      <Button variant="outline" onClick={resetDateSelection}>
                        Clear
                      </Button>
                      <Button
                        onClick={() => setIsDatePickerOpen(false)}
                        disabled={dateSelectionStep === "start" && !startDate}
                      >
                        {dateSelectionStep === "start" ? "Next" : "Apply"}
                      </Button>
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
            </div>

            {/* Refresh Button */}
            <div>
              <Button variant="outline" onClick={() => fetchSessions()} className="w-full md:w-auto">
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </Button>
            </div>

            {/* Export Button */}
            <div>
              <Button
                variant="outline"
                onClick={handleExportSelected}
                disabled={selectedSessions.size === 0 || isExporting}
                className="w-full md:w-auto"
              >
                <Download className="h-4 w-4 mr-2" />
                {isExporting ? "Exporting..." : `Export Selected (${selectedSessions.size})`}
              </Button>
            </div>

            {/* Delete Button */}
            <div>
              <Button
                variant="outline"
                onClick={() => {
                  if (selectedSessions.size === 0) {
                    toast({
                      title: "No sessions selected",
                      description: "Please select at least one conversation to delete",
                      variant: "destructive",
                    })
                    return
                  }
                  setSessionToDelete(Array.from(selectedSessions)[0])
                  setIsDeleteDialogOpen(true)
                }}
                disabled={selectedSessions.size === 0 || isDeleting}
                className="w-full md:w-auto text-red-500 hover:text-red-700"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                {isDeleting ? "Deleting..." : `Delete Selected (${selectedSessions.size})`}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1">
          <Card className="h-full">
            <CardHeader className="pb-0">
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle>Conversations</CardTitle>
                  <CardDescription>{totalSessions} total conversations</CardDescription>
                </div>
                {sessions.length > 0 && (
                  <Checkbox
                    checked={selectedSessions.size === sessions.length && sessions.lengthh > 0}
                    onCheckedChange={selectAllSessions}
                    aria-label="Select all conversations"
                  />
                )}
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {isLoadingSessions ? (
                <div className="flex justify-center items-center p-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
                </div>
              ) : sessions.length === 0 ? (
                <div className="text-center p-8">
                  <p className="mt-2 text-gray-500">No chat logs found</p>
                  {(searchQuery || startDate || endDate) && (
                    <p className="mt-2 text-sm text-gray-500">Try adjusting your filters</p>
                  )}
                </div>
              ) : (
                <div>
                  <div className="divide-y">
                    {sessions.map((session) => (
                      <div
                        key={session._id}
                        className={`p-4 hover:bg-gray-50 ${selectedSessionId === session._id ? "bg-gray-100" : ""}`}
                      >
                        <div className="flex items-start gap-3">
                          <Checkbox
                            checked={selectedSessions.has(session._id)}
                            onCheckedChange={() => toggleSessionSelection(session._id)}
                            onClick={(e) => e.stopPropagation()}
                            aria-label={`Select conversation ${session._id}`}
                          />
                          <div className="flex-1 cursor-pointer" onClick={() => setSelectedSessionId(session._id)}>
                            <div className="space-y-1">
                              <div className="font-medium w-full">
                                <span
                                  className="inline-block max-w-[180px] truncate"
                                  title={session.preview || "Chat session"}
                                >
                                  {truncateText(session.preview, 25)}
                                </span>
                              </div>
                              <p className="text-sm text-gray-500">{formatDate(session.firstMessage)}</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  {totalPages > 1 && (
                    <div className="p-4 border-t">
                      <div className="flex items-center justify-between">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setSessionsPage((p) => Math.max(p - 1, 1))}
                          disabled={sessionsPage === 1}
                        >
                          Previous
                        </Button>
                        <span className="text-sm text-gray-500">
                          Page {sessionsPage} of {totalPages}
                        </span>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setSessionsPage((p) => Math.min(p + 1, totalPages))}
                          disabled={sessionsPage === totalPages}
                        >
                          Next
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-2">
          <Card className="h-full">
            <CardHeader>
              <CardTitle>Conversation Details</CardTitle>
              {selectedSessionId && (
                <CardDescription className="truncate">Session ID: {selectedSessionId}</CardDescription>
              )}
            </CardHeader>
            <CardContent>
              {!selectedSessionId ? (
                <div className="text-center p-8">
                  <p className="mt-2 text-gray-500">Select a conversation to view details</p>
                </div>
              ) : isLoadingConversation ? (
                <div className="flex justify-center items-center p-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
                </div>
              ) : conversation.length === 0 ? (
                <div className="text-center p-8">
                  <p className="text-gray-500">No messages found for this conversation</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {conversation.map((message, index) => (
                    <div
                      key={index}
                      className={`p-4 rounded-lg ${message.role === "user" ? "bg-gray-100" : "bg-blue-50"}`}
                    >
                      <div className="flex justify-between items-start">
                        <div className="font-medium capitalize">{message.role}</div>
                        <div className="text-xs text-gray-500">{formatDate(message.timestamp)}</div>
                      </div>
                      <div className="mt-2 whitespace-pre-wrap break-words">{message.message}</div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Chat Session</AlertDialogTitle>
            <AlertDialogDescription>
              {selectedSessions.size > 1
                ? `Are you sure you want to delete these ${selectedSessions.size} chat sessions? This action cannot be undone.`
                : "Are you sure you want to delete this chat session? This action cannot be undone."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeleteSession}
              disabled={isDeleting}
              className="bg-red-500 hover:bg-red-600"
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
