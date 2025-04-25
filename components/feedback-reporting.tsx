"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ThumbsUp, ThumbsDown, BarChart3, CalendarIcon, RefreshCw } from "lucide-react"
import { toast } from "@/hooks/use-toast"
import { format, subDays, eachDayOfInterval, isSameDay, parseISO, startOfDay } from "date-fns"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Label } from "@/components/ui/label"

interface FeedbackReportingProps {
  campaignId: string
  startDate?: Date
  endDate?: Date
}

interface FeedbackStats {
  total: number
  positive: number
  negative: number
  positivePercentage: number
}

interface FeedbackTrend {
  date: string
  positive: number
  negative: number
  total: number
  positivePercentage: number
}

export function FeedbackReporting({ campaignId, startDate, endDate }: FeedbackReportingProps) {
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState<FeedbackStats | null>(null)
  const [trends, setTrends] = useState<FeedbackTrend[]>([])
  const [processedTrends, setProcessedTrends] = useState<FeedbackTrend[]>([])

  // Default to last 7 days
  const defaultEndDate = new Date()
  const defaultStartDate = subDays(defaultEndDate, 7)

  const [internalStartDate, setInternalStartDate] = useState<Date | undefined>(startDate || defaultStartDate)
  const [internalEndDate, setInternalEndDate] = useState<Date | undefined>(endDate || defaultEndDate)
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false)
  const [dateSelectionStep, setDateSelectionStep] = useState<"start" | "end">("start")
  const [isRefreshing, setIsRefreshing] = useState(false)

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

  // Process trends data to ensure all days in the date range are represented
  useEffect(() => {
    if (!internalStartDate || !internalEndDate) {
      setProcessedTrends(trends)
      return
    }

    // Get all days in the date range
    const daysInRange = eachDayOfInterval({
      start: startOfDay(new Date(internalStartDate)),
      end: startOfDay(new Date(internalEndDate)),
    })

    // Create a processed trends array with all days
    const processed = daysInRange.map((day) => {
      // Find if we have data for this day by comparing dates without time
      const existingData = trends.find((trend) => {
        const trendDate = parseISO(trend.date)
        return isSameDay(trendDate, day)
      })

      if (existingData) {
        return {
          ...existingData,
          // Ensure the date is normalized to the start of day for consistent display
          date: startOfDay(parseISO(existingData.date)).toISOString(),
        }
      }

      // If no data exists for this day, create an empty entry
      return {
        date: startOfDay(day).toISOString(),
        positive: 0,
        negative: 0,
        total: 0,
        positivePercentage: 0,
      }
    })

    setProcessedTrends(processed)
  }, [trends, internalStartDate, internalEndDate])

  useEffect(() => {
    fetchFeedbackData()
  }, [campaignId, internalStartDate, internalEndDate])

  const fetchFeedbackData = async () => {
    setLoading(true)
    setIsRefreshing(true)
    try {
      const token = localStorage.getItem("token")
      if (!token) throw new Error("No authentication token found")

      let url = `/api/campaigns/${campaignId}/chat-feedback`

      // Add date filters if provided
      const params = new URLSearchParams()
      if (internalStartDate) params.append("startDate", internalStartDate.toISOString())
      if (internalEndDate) params.append("endDate", internalEndDate.toISOString())

      if (params.toString()) {
        url += `?${params.toString()}`
      }

      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        cache: "no-store",
      })

      if (!response.ok) throw new Error("Failed to fetch feedback data")

      const data = await response.json()
      setStats(data.stats)

      // Normalize dates in the trends data to handle timezone issues
      const normalizedTrends = (data.trends || []).map((trend: FeedbackTrend) => ({
        ...trend,
        // Parse the date string and convert to ISO string to normalize
        date: parseISO(trend.date).toISOString(),
      }))

      setTrends(normalizedTrends)
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load feedback data",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
      setIsRefreshing(false)
    }
  }

  // Format percentage for display
  const formatPercentage = (value: number) => {
    return `${Math.round(value)}%`
  }

  // Get color based on satisfaction rate
  const getSatisfactionColor = (percentage: number) => {
    if (percentage >= 80) return "text-green-500"
    if (percentage >= 60) return "text-yellow-500"
    return "text-red-500"
  }

  // Calculate max value for chart scaling
  const maxTrendValue = Math.max(...processedTrends.map((t) => t.total), 1)

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

  const handleRefresh = () => {
    fetchFeedbackData()
  }

  return (
    <Card className="mb-6">
      <CardHeader className="pb-2">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            User Feedback
          </CardTitle>
          <div className="flex items-center gap-2">
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
              title="Refresh feedback data"
            >
              <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex justify-center items-center h-[100px]">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
          </div>
        ) : stats?.total === 0 ? (
          <div className="text-center py-8 text-gray-500">No feedback data available for the selected time period</div>
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
              <div className="bg-gray-50 p-4 rounded-lg">
                <div className="text-sm text-gray-500">Satisfaction Rate</div>
                <div className={`text-2xl font-bold ${getSatisfactionColor(stats?.positivePercentage || 0)}`}>
                  {formatPercentage(stats?.positivePercentage || 0)}
                </div>
                <div className="text-xs text-gray-500 mt-1">Positive ratings percentage</div>
              </div>

              <div className="bg-gray-50 p-4 rounded-lg">
                <div className="text-sm text-gray-500">Total Ratings</div>
                <div className="text-2xl font-bold">{stats?.total || 0}</div>
                <div className="text-xs text-gray-500 mt-1">Number of user ratings</div>
              </div>

              <div className="bg-gray-50 p-4 rounded-lg col-span-2 md:col-span-1">
                <div className="text-sm text-gray-500">Rating Breakdown</div>
                <div className="flex items-center gap-4 mt-2">
                  <div className="flex items-center gap-1">
                    <ThumbsUp className="h-4 w-4 text-green-500" />
                    <span className="font-medium">{stats?.positive || 0}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <ThumbsDown className="h-4 w-4 text-red-500" />
                    <span className="font-medium">{stats?.negative || 0}</span>
                  </div>
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-sm font-medium mb-4">Feedback Trends</h3>
              <div className="relative h-[200px]">
                {/* Y-axis labels */}
                <div className="absolute left-0 top-0 h-full flex flex-col justify-between text-xs text-gray-500">
                  <div>{maxTrendValue}</div>
                  <div>{Math.round(maxTrendValue / 2)}</div>
                  <div>0</div>
                </div>

                {/* Chart */}
                <div className="absolute left-8 right-0 top-0 h-full flex items-end">
                  {processedTrends.map((day, index) => (
                    <div
                      key={index}
                      className="relative flex flex-col items-center justify-end h-full group"
                      style={{ width: `${100 / Math.max(processedTrends.length, 1)}%` }}
                    >
                      <div className="w-[80%] flex flex-col items-center">
                        {/* Stacked bar */}
                        <div className="w-full flex flex-col">
                          {/* Positive (green) portion */}
                          {day.positive > 0 && (
                            <div
                              className="w-full bg-green-400 rounded-t-sm"
                              style={{
                                height: `${(day.positive / maxTrendValue) * 180}px`,
                                minHeight: day.positive > 0 ? "4px" : "0",
                              }}
                            ></div>
                          )}

                          {/* Negative (red) portion */}
                          {day.negative > 0 && (
                            <div
                              className="w-full bg-red-400 rounded-t-sm"
                              style={{
                                height: `${(day.negative / maxTrendValue) * 180}px`,
                                minHeight: day.negative > 0 ? "4px" : "0",
                              }}
                            ></div>
                          )}
                        </div>
                      </div>

                      {/* Tooltip */}
                      <div className="absolute bottom-full mb-2 hidden group-hover:block bg-gray-800 text-white text-xs rounded p-1 z-10">
                        {format(new Date(day.date), "MMM d, yyyy")}:
                        {day.total > 0 ? (
                          <div className="flex items-center gap-2 mt-1">
                            <div className="flex items-center gap-1">
                              <ThumbsUp className="h-3 w-3 text-green-400" />
                              <span>{day.positive}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <ThumbsDown className="h-3 w-3 text-red-400" />
                              <span>{day.negative}</span>
                            </div>
                          </div>
                        ) : (
                          <div className="mt-1">No feedback</div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {/* X-axis */}
                <div className="absolute left-8 right-0 bottom-[-20px] flex justify-between text-xs text-gray-500">
                  {processedTrends.length > 10
                    ? // Show fewer labels if we have many days
                      Array.from({ length: 5 }).map((_, i) => {
                        const index = Math.floor((i * (processedTrends.length - 1)) / 4)
                        const date = processedTrends[index].date
                        return (
                          <div key={i} className="text-center" style={{ width: `${100 / 5}%` }}>
                            {format(new Date(date), "MMM d")}
                          </div>
                        )
                      })
                    : // Show all labels if we have few days
                      processedTrends.map((day, i) => (
                        <div key={i} className="text-center" style={{ width: `${100 / processedTrends.length}%` }}>
                          {format(new Date(day.date), "MMM d")}
                        </div>
                      ))}
                </div>
              </div>
              <div className="flex justify-center gap-4 mt-6 text-xs text-gray-500">
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 bg-green-400 rounded-sm"></div>
                  <span>Positive</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 bg-red-400 rounded-sm"></div>
                  <span>Negative</span>
                </div>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
