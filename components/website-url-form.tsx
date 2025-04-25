"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Info } from "lucide-react"
import { websiteUrlSchema } from "@/lib/validations/website-schema"

interface WebsiteUrlFormProps {
  campaignId: string
  onComplete: (result: { message: string; type: "success" | "error" }) => void
  onCancel: () => void
}

export function WebsiteUrlForm({ campaignId, onComplete, onCancel }: WebsiteUrlFormProps) {
  const [url, setUrl] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    try {
      // Validate the URL with Zod
      const validatedData = websiteUrlSchema.parse({ url })

      setIsSubmitting(true)

      const token = localStorage.getItem("token")
      if (!token) {
        throw new Error("No authentication token found")
      }

      const formData = new FormData()
      formData.append("type", "url")
      formData.append("url", validatedData.url)

      const response = await fetch(`/api/campaigns/${campaignId}/website-resources`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.message || "Failed to add website URL")
      }

      onComplete({
        message:
          "Website URL added successfully and is now being processed. You're free to leave this page - processing will continue in the background.",
        type: "success",
      })
    } catch (error) {
      console.error("Error adding website URL:", error)
      // Handle Zod validation errors
      if (error.errors) {
        setError(error.errors[0]?.message || "Invalid URL format")
      } else {
        setError(error.message)
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Add Website URL</CardTitle>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="url">Website URL</Label>
            <Input
              id="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://www.example.com"
              required
            />
            <p className="text-sm text-gray-500">
              Enter the URL of a website you want to include as a knowledge source for your AI assistant.
            </p>
          </div>

          <div className="p-4 bg-blue-50 rounded-md flex items-start space-x-3">
            <Info className="h-5 w-5 text-blue-500 flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="font-medium text-blue-700">How Website Indexing Works</h4>
              <p className="text-sm text-blue-600">
                When you add a website, our system will create a lightweight index of its pages. When users ask
                questions, the AI will search this index to find relevant pages and retrieve the most up-to-date content
                in real-time. This ensures your AI assistant always has access to current information without storing
                entire websites.
              </p>
            </div>
          </div>

          {error && <div className="bg-red-50 p-3 rounded-md text-red-500 text-sm">{error}</div>}
        </CardContent>
        <CardFooter className="flex justify-between">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Processing..." : "Add Website"}
          </Button>
        </CardFooter>
      </form>
    </Card>
  )
}
