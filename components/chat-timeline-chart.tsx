"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { format, subDays } from "date-fns"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Label } from "@/components/ui/label"
import { BarChart3, RefreshCw, CalendarIcon } from "lucide-react"
import { toast } from "@/hooks/use-toast"

interface ChatTimelineProps {
  campaignId: string
  startDate?: Date
  endDate?: Date
}

interface DailyCount {
  date: string
  count: number
}

export function ChatTimelineChart({ campaignId, startDate, endDate }: ChatTimelineProps) {
  const [loading, setLoading] = useState(true)
  const [dailyCounts, setDailyCounts] = useState<DailyCount[]>([])
  const [isRefreshing, setIsRefreshing] = useState(false)

  // Default to last 7 days
  const defaultEndDate = new Date()
  const defaultStartDate = subDays(defaultEndDate, 7)

  const [internalStartDate, setInternalStartDate] = useState<Date | undefined>(startDate || defaultStartDate)
  const [internalEndDate, setInternalEndDate] = useState<Date | undefined>(endDate || defaultEndDate)
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false)
  const [dateSelectionStep, setDateSelectionStep] = useState<"start" | "end">("start")

  const fetchChatTimeline = async () => {
    setLoading(true)
    try {
      // Use the internal dates for fetching data
      const end = internalEndDate || new Date()
      const start = internalStartDate || subDays(end, 7)

      // Ensure start date is set to the beginning of the day (00:00:00)
      start.setHours(0, 0, 0, 0)

      // Ensure end date is set to the end of the day (23:59:59)
      end.setHours(23, 59, 59, 999)

      const token = localStorage.getItem("token")
      if (!token) throw new Error("No authentication token found")

      const response = await fetch(
        `/api/campaigns/${campaignId}/chat-logs/daily-counts?startDate=${start.toISOString()}&endDate=${end.toISOString()}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          // Add cache control to prevent caching
          cache: "no-store",
        },
      )

      if (!response.ok) throw new Error("Failed to fetch chat timeline data")

      const data = await response.json()

      // Ensure we're working with the right data format
      const processedCounts = (data.dailyCounts || []).map((item: any) => ({
        date: new Date(item.date),
        count: item.count,
      }))

      setDailyCounts(processedCounts)
    } catch (error) {
      console.error("Error fetching chat timeline:", error)
      setDailyCounts([])
      toast({
        title: "Error",
        description: "Failed to load chat activity data",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
      setIsRefreshing(false)
    }
  }

  const handleDateSelect = (date: Date | undefined) => {
    if (dateSelectionStep === "start") {
      setInternalStartDate(date)
      setDateSelectionStep("end")
      // If end date is before start date, reset it
      if (internalEndDate && date && internalEndDate < date) {
        setInternalEndDate(undefined)
      }
    } else {
      setInternalEndDate(date)
      // Close the popover after selecting end date
      setIsDatePickerOpen(false)
    }
  }

  const resetDateSelection = () => {
    // Reset to default 7 days
    setInternalStartDate(defaultStartDate)
    setInternalEndDate(defaultEndDate)
    setDateSelectionStep("start")
    setIsDatePickerOpen(false)
  }

  const formatDateRange = () => {
    if (internalStartDate && internalEndDate) {
      return `${format(internalStartDate, "MMM d, yyyy")} - ${format(internalEndDate, "MMM d, yyyy")}`
    } else if (internalStartDate) {
      return `From ${format(internalStartDate, "MMM d, yyyy")}`
    } else if (internalEndDate) {
      return `Until ${format(internalEndDate, "MMM d, yyyy")}`
    }
    return "7 Days"
  }

  // Fetch data when component mounts or when dates change
  useEffect(() => {
    fetchChatTimeline()
  }, [campaignId, internalStartDate, internalEndDate])

  // Sync props with internal state
  useEffect(() => {
    if (startDate !== undefined) setInternalStartDate(startDate)
    if (endDate !== undefined) setInternalEndDate(endDate)
  }, [startDate, endDate])

  // Reset date selection step when date picker is closed
  useEffect(() => {
    if (!isDatePickerOpen) {
      setDateSelectionStep("start")
    }
  }, [isDatePickerOpen])

  const handleRefresh = () => {
    setIsRefreshing(true)
    fetchChatTimeline()
  }

  // Calculate total and average chats
  const totalChats = dailyCounts.reduce((sum, day) => sum + day.count, 0)
  const avgChatsPerDay = dailyCounts.length > 0 ? Math.round((totalChats / dailyCounts.length) * 10) / 10 : 0

  // Find the maximum count for scaling
  const maxCount = Math.max(...dailyCounts.map((day) => day.count), 2)

  // Chart dimensions
  const chartHeight = 150 // Height in pixels for the chart area (excluding labels)
  const barWidth = 40 // Width in pixels for each bar

  return (
    <Card className="mb-6">
      <CardHeader className="pb-2">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Chat Activity
          </CardTitle>
          <div className="flex items-center gap-2">
            {/* Date Picker */}
            <Popover open={isDatePickerOpen} onOpenChange={setIsDatePickerOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" className="flex items-center gap-2">
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
                      selected={dateSelectionStep === "start" ? internalStartDate : internalEndDate}
                      onSelect={handleDateSelect}
                      initialFocus
                      disabled={
                        dateSelectionStep === "end"
                          ? (date) => (internalStartDate ? date < internalStartDate : false)
                          : undefined
                      }
                    />
                  </div>
                  <div className="flex justify-between">
                    <Button variant="outline" onClick={resetDateSelection}>
                      Reset to 7 Days
                    </Button>
                    <Button
                      onClick={() => setIsDatePickerOpen(false)}
                      disabled={dateSelectionStep === "start" && !internalStartDate}
                    >
                      {dateSelectionStep === "start" ? "Next" : "Apply"}
                    </Button>
                  </div>
                </div>
              </PopoverContent>
            </Popover>

            <Button
              variant="outline"
              size="icon"
              onClick={handleRefresh}
              disabled={isRefreshing}
              title="Refresh chart data"
            >
              <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="bg-gray-50 p-4 rounded-lg">
            <div className="text-sm text-gray-500">Total Chats</div>
            <div className="text-2xl font-bold">{totalChats}</div>
            <div className="text-xs text-gray-500 mt-1">Number of user-initiated conversations</div>
          </div>
          <div className="bg-gray-50 p-4 rounded-lg">
            <div className="text-sm text-gray-500">Avg. Chats per Day</div>
            <div className="text-2xl font-bold">{avgChatsPerDay}</div>
            <div className="text-xs text-gray-500 mt-1">Average conversations per day</div>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center items-center h-[200px]">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
          </div>
        ) : dailyCounts.length === 0 ? (
          <div className="text-center py-8 text-gray-500">No chat data available for the selected time period</div>
        ) : (
          <div className="mt-6">
            <div className="flex h-[220px]">
              {/* Y-axis labels */}
              <div className="flex flex-col justify-between pr-2 text-xs text-gray-500 h-[170px] pt-5">
                <div>{maxCount}</div>
                <div>{Math.floor(maxCount / 2)}</div>
                <div>0</div>
              </div>

              {/* Chart area */}
              <div className="flex-1 relative h-[170px]">
                {/* Horizontal grid lines */}
                <div className="absolute inset-0 border-l border-b border-gray-200">
                  <div className="border-t border-gray-200 h-1/2"></div>
                </div>

                {/* Bars */}
                <div className="absolute inset-0 flex items-end justify-around pt-5 pb-6">
                  {dailyCounts.map((day, index) => {
                    // Calculate bar height in pixels based on count
                    // Subtract 10px from chartHeight to ensure the highest bar doesn't touch the top
                    const barHeightPx = day.count > 0 ? (day.count / maxCount) * (chartHeight - 10) : 0

                    return (
                      <div key={index} className="flex flex-col items-center">
                        {/* Bar with label */}
                        <div className="relative flex flex-col items-center justify-end h-full">
                          {day.count > 0 && (
                            <>
                              {/* Count label */}
                              <div className="absolute top-[-20px] text-xs font-medium">{day.count}</div>

                              {/* Bar */}
                              <div
                                className="w-8 bg-blue-500 rounded-t-sm"
                                style={{
                                  height: `${barHeightPx}px`,
                                }}
                              ></div>
                            </>
                          )}
                        </div>

                        {/* X-axis label */}
                        <div className="absolute bottom-[-20px] text-xs text-gray-500">
                          {day.date instanceof Date ? format(day.date, "MMM d") : format(new Date(day.date), "MMM d")}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>

            <div className="text-xs text-gray-500 text-center mt-10">
              Note: This chart shows the number of user-initiated conversations per day, not the total number of
              messages.
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
