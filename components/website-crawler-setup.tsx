"use client"

import type React from "react"

import { useState, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Upload, X, FileText, Info } from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"

interface WebsiteCrawlerSetupProps {
  campaignId: string
  onComplete: () => void
  onCancel: () => void
}

export function WebsiteCrawlerSetup({ campaignId, onComplete, onCancel }: WebsiteCrawlerSetupProps) {
  const [activeTab, setActiveTab] = useState<"url" | "robots" | "sitemap">("url")
  const [websiteUrl, setWebsiteUrl] = useState("")
  const [robotsTxt, setRobotsTxt] = useState("")
  const [sitemapFile, setSitemapFile] = useState<File | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0]
      setSitemapFile(selectedFile)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (activeTab === "url" && !websiteUrl.trim()) {
      setError("Please enter a website URL")
      return
    }

    if (activeTab === "robots" && !robotsTxt.trim()) {
      setError("Please enter robots.txt content")
      return
    }

    if (activeTab === "sitemap" && !sitemapFile) {
      setError("Please select a sitemap XML file")
      return
    }

    setIsSubmitting(true)

    try {
      const token = localStorage.getItem("token")
      if (!token) {
        throw new Error("No authentication token found")
      }

      const formData = new FormData()
      formData.append("type", activeTab)

      if (activeTab === "url") {
        formData.append("url", websiteUrl)
      } else if (activeTab === "robots") {
        formData.append("robotsTxt", robotsTxt)
      } else if (activeTab === "sitemap" && sitemapFile) {
        formData.append("sitemapFile", sitemapFile)
      }

      const response = await fetch(`/api/campaigns/${campaignId}/crawler`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.message || "Failed to set up website crawler")
      }

      onComplete()
    } catch (error) {
      console.error("Error setting up website crawler:", error)
      setError(error.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  const clearFile = () => {
    setSitemapFile(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Website Crawler Setup</CardTitle>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-4">
          <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as any)}>
            <TabsList className="mb-4">
              <TabsTrigger value="url">Website URL</TabsTrigger>
              <TabsTrigger value="robots">Robots.txt</TabsTrigger>
              <TabsTrigger value="sitemap">Sitemap XML</TabsTrigger>
            </TabsList>

            <TabsContent value="url" className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="websiteUrl">Website URL</Label>
                <Input
                  id="websiteUrl"
                  value={websiteUrl}
                  onChange={(e) => setWebsiteUrl(e.target.value)}
                  placeholder="https://www.example.com"
                />
                <p className="text-sm text-gray-500">
                  Enter your website URL. We'll crawl the site respecting robots.txt rules to train the AI assistant.
                </p>
              </div>
            </TabsContent>

            <TabsContent value="robots" className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="robotsTxt">Robots.txt Content</Label>
                <Textarea
                  id="robotsTxt"
                  value={robotsTxt}
                  onChange={(e) => setRobotsTxt(e.target.value)}
                  placeholder="User-agent: *\nAllow: /\nDisallow: /private/"
                  rows={8}
                />
                <p className="text-sm text-gray-500">
                  Paste the contents of your robots.txt file. This helps our crawler respect your website's crawling
                  rules.
                </p>
              </div>
            </TabsContent>

            <TabsContent value="sitemap" className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="sitemapFile">Sitemap XML File</Label>
                {!sitemapFile ? (
                  <div className="border-2 border-dashed rounded-md p-6 text-center">
                    <Input
                      id="sitemapFile"
                      type="file"
                      ref={fileInputRef}
                      onChange={handleFileChange}
                      className="hidden"
                      accept=".xml"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => fileInputRef.current?.click()}
                      className="mx-auto"
                    >
                      <Upload className="h-4 w-4 mr-2" />
                      Select Sitemap XML
                    </Button>
                    <p className="text-sm text-gray-500 mt-2">
                      Upload your sitemap.xml file to help our crawler find all important pages.
                    </p>
                  </div>
                ) : (
                  <div className="border rounded-md p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <FileText className="h-8 w-8 text-blue-500" />
                        <div>
                          <p className="font-medium">{sitemapFile.name}</p>
                          <p className="text-sm text-gray-500">{sitemapFile.size} bytes</p>
                        </div>
                      </div>
                      <Button type="button" variant="ghost" size="sm" onClick={clearFile}>
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>

          <div className="p-4 bg-blue-50 rounded-md flex items-start space-x-3">
            <Info className="h-5 w-5 text-blue-500 flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="font-medium text-blue-700">About Website Crawling</h4>
              <p className="text-sm text-blue-600">
                Our crawler will index your website content to train the AI assistant to answer questions about your
                organization. The process respects robots.txt rules and focuses on public pages. This helps create a
                more knowledgeable chatbot that can accurately answer visitor questions.
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
            {isSubmitting ? "Processing..." : "Start Crawling"}
          </Button>
        </CardFooter>
      </form>
    </Card>
  )
}
