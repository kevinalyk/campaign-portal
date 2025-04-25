"use client"

import { useState } from "react"
import { ThumbsUp, ThumbsDown } from "lucide-react"
import { Button } from "@/components/ui/button"

interface FeedbackBarProps {
  onSubmit: (rating: "positive" | "negative") => void
  onDismiss: () => void
  customColor?: string
}

export function FeedbackBar({ onSubmit, onDismiss, customColor = "#FF3B30" }: FeedbackBarProps) {
  const [submitted, setSubmitted] = useState(false)

  const handleSubmit = (rating: "positive" | "negative") => {
    setSubmitted(true)
    onSubmit(rating)

    // Hide the thank you message after 3 seconds
    setTimeout(() => {
      onDismiss()
    }, 3000)
  }

  return (
    <div className="p-2 bg-gray-50 border-t rounded-b-lg animate-fade-in">
      {!submitted ? (
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-600">Was this conversation helpful?</span>
          <div className="flex space-x-2">
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-1 rounded-full hover:bg-gray-200"
              onClick={() => handleSubmit("positive")}
              aria-label="Thumbs up"
            >
              <ThumbsUp className="h-5 w-5 text-gray-600" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-1 rounded-full hover:bg-gray-200"
              onClick={() => handleSubmit("negative")}
              aria-label="Thumbs down"
            >
              <ThumbsDown className="h-5 w-5 text-gray-600" />
            </Button>
          </div>
        </div>
      ) : (
        <div className="text-sm text-center text-gray-600 py-1">Thank you for your feedback!</div>
      )}
    </div>
  )
}
