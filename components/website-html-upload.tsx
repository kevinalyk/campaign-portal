"use client"

import type React from "react"

import { useState, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Upload, X, FileText } from "lucide-react"

interface WebsiteHtmlUploadProps {
  campaignId: string
  onComplete: (result: { message: string; type: string }) => void
  onCancel: () => void
}

export function WebsiteHtmlUpload({ campaignId, onComplete, onCancel }: WebsiteHtmlUploadProps) {
  const [file, setFile] = useState<File | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0]

      // Validate file type
      if (selectedFile.type !== "text/html") {
        setError("Only HTML files are allowed")
        return
      }

      setFile(selectedFile)
      setError(null)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!file) {
      setError("Please select an HTML file to upload")
      return
    }

    setIsSubmitting(true)

    try {
      const token = localStorage.getItem("token")
      if (!token) {
        throw new Error("No authentication token found")
      }

      const formData = new FormData()
      formData.append("type", "html")
      formData.append("file", file)

      const response = await fetch(`/api/campaigns/${campaignId}/website-resources`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.message || "Failed to upload HTML file")
      }

      onComplete({
        message:
          "HTML file uploaded successfully and is now being processed. You're free to leave this page - processing will continue in the background.",
        type: "success",
      })
    } catch (error) {
      console.error("Error uploading HTML file:", error)
      setError(error.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  const clearFile = () => {
    setFile(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + " bytes"
    else if (bytes < 1048576) return (bytes / 1024).toFixed(1) + " KB"
    else return (bytes / 1048576).toFixed(1) + " MB"
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Upload HTML File</CardTitle>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="file">HTML File</Label>
            {!file ? (
              <div className="border-2 border-dashed rounded-md p-6 text-center">
                <Input
                  id="file"
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  className="hidden"
                  accept=".html,.htm"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  className="mx-auto"
                >
                  <Upload className="h-4 w-4 mr-2" />
                  Select HTML File
                </Button>
                <p className="text-sm text-gray-500 mt-2">Upload an HTML file of your campaign website (Max 5MB)</p>
              </div>
            ) : (
              <div className="border rounded-md p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <FileText className="h-8 w-8 text-blue-500" />
                    <div>
                      <p className="font-medium">{file.name}</p>
                      <p className="text-sm text-gray-500">{formatFileSize(file.size)}</p>
                    </div>
                  </div>
                  <Button type="button" variant="ghost" size="sm" onClick={clearFile}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </div>

          {error && <div className="bg-red-50 p-3 rounded-md text-red-500 text-sm">{error}</div>}
        </CardContent>
        <CardFooter className="flex justify-between">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting || !file}>
            {isSubmitting ? "Uploading..." : "Upload HTML"}
          </Button>
        </CardFooter>
      </form>
    </Card>
  )
}
