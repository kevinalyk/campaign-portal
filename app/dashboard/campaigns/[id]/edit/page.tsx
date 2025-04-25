"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Info } from "lucide-react"

// Replace the sanitizeInput function with this version that completely removes HTML tags
// instead of encoding them, to be consistent with other tabs

const sanitizeInput = (input: string): string => {
  if (!input) return input
  return input
    .replace(/<[^>]*>/g, "") // Remove all HTML tags
    .replace(/javascript:/gi, "")
    .replace(/on\w+=/gi, "")
    .replace(/data:/gi, "")
    .replace(/vbscript:/gi, "")
}

interface Campaign {
  _id: string
  name: string
  url: string
  donationUrl: string
  websiteUrl: string
  description: string
  logoUrl?: string
  chatColor?: string
  chatWelcomeMessage?: string
  contactEmail?: string
  contactPhone?: string
  contactAddress?: string
  assistantIdentity?: string
  createdAt: string
  updatedAt: string
  addressStreet?: string
  addressCity?: string
  addressState?: string
  addressZip?: string
}

export default function EditCampaignPage({ params }: { params: { id: string } }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const returnTab = searchParams.get("returnTab") || "details"

  const [formData, setFormData] = useState({
    name: "",
    url: "",
    donationUrl: "",
    websiteUrl: "",
    description: "",
    logoUrl: "",
    chatColor: "#FF0000",
    chatWelcomeMessage: "Hello! Welcome to our organization portal. How can I assist you today?",
    contactEmail: "",
    contactPhone: "",
    contactAddress: "",
    addressStreet: "",
    addressCity: "",
    addressState: "",
    addressZip: "",
    assistantIdentity: "",
  })
  const [originalUrl, setOriginalUrl] = useState("")
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Add event listener for browser back button
  useEffect(() => {
    const handlePopState = () => {
      router.push(`/dashboard/campaigns/${params.id}#${returnTab}`)
    }

    window.addEventListener("popstate", handlePopState)

    return () => {
      window.removeEventListener("popstate", handlePopState)
    }
  }, [params.id, returnTab, router])

  useEffect(() => {
    const fetchCampaign = async () => {
      try {
        const token = localStorage.getItem("token")
        if (!token) {
          throw new Error("No authentication token found")
        }

        // Add timestamp to prevent caching
        const timestamp = new Date().getTime()
        const response = await fetch(`/api/campaigns/${params.id}?t=${timestamp}`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          cache: "no-store",
        })

        if (!response.ok) {
          throw new Error("Failed to fetch organization")
        }

        const data = await response.json()
        const campaign = data.campaign as Campaign

        // Check if contactAddress has information not in addressStreet
        let addressStreet = campaign.addressStreet || ""
        let addressCity = campaign.addressCity || ""
        let addressState = campaign.addressState || ""
        let addressZip = campaign.addressZip || ""

        if (
          campaign.contactAddress &&
          (!addressStreet || (campaign.contactAddress.includes("NW") && !addressStreet.includes("NW")))
        ) {
          // Parse the contact address
          const parts = campaign.contactAddress.split(",").map((p) => p.trim())
          if (parts.length >= 1) addressStreet = parts[0]
          if (parts.length >= 2) addressCity = parts[1]
          if (parts.length >= 3) {
            const stateZip = parts[parts.length - 1].split(" ")
            if (stateZip.length >= 2) {
              addressZip = stateZip.pop() || ""
              addressState = stateZip.join(" ")
            } else {
              addressState = parts[parts.length - 1]
            }
          }
        }

        setFormData({
          name: campaign.name,
          url: campaign.url,
          donationUrl: campaign.donationUrl,
          websiteUrl: campaign.websiteUrl || "",
          description: campaign.description,
          logoUrl: campaign.logoUrl || "",
          chatColor: campaign.chatColor || "#FF0000",
          chatWelcomeMessage:
            campaign.chatWelcomeMessage || "Hello! Welcome to our organization portal. How can I assist you today?",
          contactEmail: campaign.contactEmail || "",
          contactPhone: campaign.contactPhone || "",
          contactAddress: campaign.contactAddress || "",
          addressStreet: addressStreet,
          addressCity: addressCity,
          addressState: addressState,
          addressZip: addressZip,
          assistantIdentity: campaign.assistantIdentity || "",
        })

        setOriginalUrl(campaign.url)
      } catch (error) {
        console.error("Error fetching organization:", error)
        setError(error.message)
      } finally {
        setLoading(false)
      }
    }

    fetchCampaign()
  }, [params.id])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    // Sanitize the input value
    const sanitizedValue = sanitizeInput(value)

    setFormData((prev) => ({ ...prev, [name]: sanitizedValue }))

    // Clear error when field is edited
    if (errors[name]) {
      setErrors((prev) => {
        const newErrors = { ...prev }
        delete newErrors[name]
        return newErrors
      })
    }
  }

  const validateForm = () => {
    const newErrors: Record<string, string> = {}

    if (!formData.name.trim()) {
      newErrors.name = "Organization name is required"
    } else if (/javascript:|on\w+=|data:|vbscript:/i.test(formData.name)) {
      newErrors.name = "Organization name contains invalid characters"
    }

    if (!formData.url.trim()) {
      newErrors.url = "URL is required"
    } else if (!/^[a-z0-9-]+$/.test(formData.url)) {
      newErrors.url = "URL can only contain lowercase letters, numbers, and hyphens"
    }

    if (!formData.donationUrl.trim()) {
      newErrors.donationUrl = "Donation URL is required"
    } else if (!/^https?:\/\//.test(formData.donationUrl)) {
      newErrors.donationUrl = "Donation URL must start with http:// or https://"
    } else if (/javascript:|on\w+=|data:|vbscript:/i.test(formData.donationUrl)) {
      newErrors.donationUrl = "Donation URL contains invalid characters"
    }

    if (!formData.websiteUrl.trim()) {
      newErrors.websiteUrl = "Organization website URL is required"
    } else if (!/^https?:\/\//.test(formData.websiteUrl)) {
      newErrors.websiteUrl = "Website URL must start with http:// or https://"
    } else if (/javascript:|on\w+=|data:|vbscript:/i.test(formData.websiteUrl)) {
      newErrors.websiteUrl = "Website URL contains invalid characters"
    }

    if (!formData.description.trim()) {
      newErrors.description = "Description is required"
    } else if (/javascript:|on\w+=|data:|vbscript:/i.test(formData.description)) {
      newErrors.description = "Description contains invalid characters"
    }

    if (formData.logoUrl && !/^https?:\/\//.test(formData.logoUrl)) {
      newErrors.logoUrl = "Logo URL must start with http:// or https://"
    } else if (formData.logoUrl && /javascript:|on\w+=|data:|vbscript:/i.test(formData.logoUrl)) {
      newErrors.logoUrl = "Logo URL contains invalid characters"
    }

    if (formData.contactEmail && /javascript:|on\w+=|data:|vbscript:/i.test(formData.contactEmail)) {
      newErrors.contactEmail = "Contact email contains invalid characters"
    }

    if (formData.contactPhone && /javascript:|on\w+=|data:|vbscript:/i.test(formData.contactPhone)) {
      newErrors.contactPhone = "Contact phone contains invalid characters"
    }

    if (formData.addressStreet && /javascript:|on\w+=|data:|vbscript:/i.test(formData.addressStreet)) {
      newErrors.addressStreet = "Street address contains invalid characters"
    }

    if (formData.addressCity && /javascript:|on\w+=|data:|vbscript:/i.test(formData.addressCity)) {
      newErrors.addressCity = "City contains invalid characters"
    }

    if (formData.addressState && /javascript:|on\w+=|data:|vbscript:/i.test(formData.addressState)) {
      newErrors.addressState = "State contains invalid characters"
    }

    if (formData.addressZip && /javascript:|on\w+=|data:|vbscript:/i.test(formData.addressZip)) {
      newErrors.addressZip = "ZIP code contains invalid characters"
    }

    if (formData.assistantIdentity && /javascript:|on\w+=|data:|vbscript:/i.test(formData.assistantIdentity)) {
      newErrors.assistantIdentity = "AI Assistant Identity contains invalid characters"
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!validateForm()) {
      return
    }

    setIsSubmitting(true)
    setSubmitError(null)

    try {
      const token = localStorage.getItem("token")
      if (!token) {
        throw new Error("No authentication token found")
      }

      // Sanitize all form data before sending
      const sanitizedFormData = Object.entries(formData).reduce(
        (acc, [key, value]) => {
          if (typeof value === "string") {
            acc[key] = sanitizeInput(value)
          } else {
            acc[key] = value
          }
          return acc
        },
        {} as typeof formData,
      )

      // Prepare the data to send to the API
      const dataToSend = {
        ...sanitizedFormData,
        // Include both the individual address fields and the combined contactAddress
        contactAddress: [
          sanitizedFormData.addressStreet,
          sanitizedFormData.addressCity,
          `${sanitizedFormData.addressState} ${sanitizedFormData.addressZip}`,
        ]
          .filter(Boolean)
          .join(", "),
      }

      // Determine if we're using an ID or URL slug
      const campaignId = params.id
      const response = await fetch(`/api/campaigns/${campaignId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(dataToSend),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.message || "Failed to update organization")
      }

      // Force a refresh of the campaign data by adding a timestamp to the URL
      const timestamp = new Date().getTime()
      router.push(`/dashboard/campaigns/${params.id}?refresh=${timestamp}#${returnTab}`)
    } catch (error) {
      console.error("Error updating organization:", error)
      setSubmitError(error.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="max-w-2xl mx-auto">
        <Card>
          <CardContent className="pt-6">
            <p className="text-red-500">{error}</p>
            <Button
              variant="outline"
              className="mt-4"
              onClick={() => router.push(`/dashboard/campaigns/${params.id}#${returnTab}`)}
            >
              Return to Organization
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (returnTab === undefined) {
    return (
      <div className="max-w-2xl mx-auto">
        <Card>
          <CardContent className="pt-6">
            <p className="text-red-500">returnTab is undefined</p>
            <Button variant="outline" className="mt-4" onClick={() => router.push(`/dashboard/campaigns/${params.id}`)}>
              Return to Organization
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto">
      <Card>
        <CardHeader>
          <CardTitle>Edit Organization</CardTitle>
          <CardDescription>Update your organization details</CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Organization Name</Label>
              <Input
                id="name"
                name="name"
                value={formData.name}
                onChange={handleChange}
                placeholder="My Organization"
                className={errors.name ? "border-red-500" : ""}
              />
              {errors.name && <p className="text-red-500 text-sm">{errors.name}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="url">Organization URL</Label>
              <div className="relative">
                <Input
                  id="url"
                  name="url"
                  value={formData.url}
                  className="bg-gray-100 text-gray-500"
                  disabled={true}
                  required
                />
                <div className="absolute inset-0 bg-gray-50 opacity-50 pointer-events-none"></div>
              </div>
              <p className="text-sm text-gray-500">Organization URL cannot be changed after creation.</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="donationUrl">Donation URL</Label>
              <Input
                id="donationUrl"
                name="donationUrl"
                value={formData.donationUrl}
                onChange={handleChange}
                placeholder="https://example.com/donate"
                className={errors.donationUrl ? "border-red-500" : ""}
              />
              {errors.donationUrl && <p className="text-red-500 text-sm">{errors.donationUrl}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="websiteUrl">Website URL</Label>
              <Input
                id="websiteUrl"
                name="websiteUrl"
                type="text"
                value={formData.websiteUrl}
                onChange={handleChange}
                className="bg-gray-100 text-gray-500"
                disabled
              />
              <p className="text-sm text-gray-500">
                The website URL cannot be changed after campaign creation. You can add additional website resources in
                the campaign dashboard.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                name="description"
                value={formData.description}
                onChange={handleChange}
                placeholder="Describe your organization..."
                className={errors.description ? "border-red-500" : ""}
                rows={4}
              />
              {errors.description && <p className="text-red-500 text-sm">{errors.description}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="logoUrl">Logo URL (Optional)</Label>
              <div className="flex gap-2">
                <Input
                  id="logoUrl"
                  name="logoUrl"
                  value={formData.logoUrl}
                  onChange={handleChange}
                  placeholder="https://example.com/logo.png"
                  className={`flex-1 ${errors.logoUrl ? "border-red-500" : ""}`}
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={async () => {
                    try {
                      // Create a file input element
                      const input = document.createElement("input")
                      input.type = "file"
                      input.accept = "image/*"

                      // Handle file selection
                      input.onchange = async (e) => {
                        const file = (e.target as HTMLInputElement).files?.[0]
                        if (!file) return

                        // Validate file type
                        if (!file.type.startsWith("image/")) {
                          setErrors((prev) => ({ ...prev, logoUrl: "Only image files are allowed" }))
                          return
                        }

                        // Validate file size (max 5MB)
                        if (file.size > 5 * 1024 * 1024) {
                          setErrors((prev) => ({ ...prev, logoUrl: "Image must be less than 5MB" }))
                          return
                        }

                        // Create form data for upload
                        const formData = new FormData()
                        formData.append("file", file)

                        // Show loading state
                        setIsSubmitting(true)

                        try {
                          // Upload to Vercel Blob
                          const token = localStorage.getItem("token")
                          if (!token) {
                            throw new Error("No authentication token found")
                          }

                          const response = await fetch(`/api/upload-logo`, {
                            method: "POST",
                            headers: {
                              Authorization: `Bearer ${token}`,
                            },
                            body: formData,
                          })

                          if (!response.ok) {
                            throw new Error("Failed to upload image")
                          }

                          const { url } = await response.json()

                          // Update the logo URL field
                          setFormData((prev) => ({ ...prev, logoUrl: url }))

                          // Clear any errors
                          if (errors.logoUrl) {
                            setErrors((prev) => {
                              const newErrors = { ...prev }
                              delete newErrors.logoUrl
                              return newErrors
                            })
                          }
                        } catch (error) {
                          console.error("Error uploading logo:", error)
                          setErrors((prev) => ({ ...prev, logoUrl: "Failed to upload image" }))
                        } finally {
                          // Reset the submitting state
                          setIsSubmitting(false)
                        }
                      }

                      // Trigger the file input click
                      input.click()
                    } catch (error) {
                      console.error("Error uploading logo:", error)
                      setErrors((prev) => ({ ...prev, logoUrl: "Failed to upload image" }))
                      setIsSubmitting(false)
                    }
                  }}
                >
                  Upload
                </Button>
              </div>
              {errors.logoUrl && <p className="text-red-500 text-sm">{errors.logoUrl}</p>}
              <p className="text-gray-500 text-xs">Upload or provide a URL for your organization's logo.</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="contactEmail">Contact Email</Label>
              <Input
                id="contactEmail"
                name="contactEmail"
                type="email"
                value={formData.contactEmail}
                onChange={handleChange}
                placeholder="contact@example.com"
                className={errors.contactEmail ? "border-red-500" : ""}
              />
              {errors.contactEmail && <p className="text-red-500 text-sm">{errors.contactEmail}</p>}
              <p className="text-gray-500 text-xs">Email address for contact information.</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="contactPhone">Contact Phone</Label>
              <Input
                id="contactPhone"
                name="contactPhone"
                value={formData.contactPhone}
                onChange={handleChange}
                placeholder="(555) 123-4567"
                className={errors.contactPhone ? "border-red-500" : ""}
              />
              {errors.contactPhone && <p className="text-red-500 text-sm">{errors.contactPhone}</p>}
              <p className="text-gray-500 text-xs">Phone number for contact information.</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="addressStreet">Street Address</Label>
              <Input
                id="addressStreet"
                name="addressStreet"
                value={formData.addressStreet}
                onChange={handleChange}
                placeholder="123 Main St"
                className={errors.addressStreet ? "border-red-500" : ""}
              />
              {errors.addressStreet && <p className="text-red-500 text-sm">{errors.addressStreet}</p>}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="addressCity">City</Label>
                <Input
                  id="addressCity"
                  name="addressCity"
                  value={formData.addressCity}
                  onChange={handleChange}
                  placeholder="Anytown"
                  className={errors.addressCity ? "border-red-500" : ""}
                />
                {errors.addressCity && <p className="text-red-500 text-sm">{errors.addressCity}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="addressState">State</Label>
                <Input
                  id="addressState"
                  name="addressState"
                  value={formData.addressState}
                  onChange={handleChange}
                  placeholder="ST"
                  className={errors.addressState ? "border-red-500" : ""}
                />
                {errors.addressState && <p className="text-red-500 text-sm">{errors.addressState}</p>}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="addressZip">ZIP Code</Label>
              <Input
                id="addressZip"
                name="addressZip"
                value={formData.addressZip}
                onChange={handleChange}
                placeholder="12345"
                className={errors.addressZip ? "border-red-500" : ""}
              />
              {errors.addressZip && <p className="text-red-500 text-sm">{errors.addressZip}</p>}
              <p className="text-gray-500 text-xs">Address information for contact details.</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="assistantIdentity">
                AI Assistant Identity <span className="text-gray-500">(Optional)</span>
              </Label>
              <Input
                id="assistantIdentity"
                name="assistantIdentity"
                value={formData.assistantIdentity}
                onChange={handleChange}
                placeholder="AI assistant for [Your Organization Name]"
              />
              <p className="text-gray-500 text-xs">
                This is how the AI will identify itself when users ask who they're talking to. Example: "AI assistant
                for Congressman Tom Emmer" or "AI assistant for Minnesota GOP"
              </p>
            </div>

            {/* Info Notes */}
            <div className="space-y-4">
              {/* Chat Settings Note */}
              <div className="p-4 bg-blue-50 rounded-md flex items-start space-x-3">
                <Info className="h-5 w-5 text-blue-500 flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-medium text-blue-700">Chat Settings</h4>
                  <p className="text-sm text-blue-600">
                    You can customize the chat appearance and welcome message in the Chat Settings tab on the
                    organization details page.
                  </p>
                </div>
              </div>

              {/* Contact Information Note */}
              <div className="p-4 bg-blue-50 rounded-md flex items-start space-x-3">
                <Info className="h-5 w-5 text-blue-500 flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-medium text-blue-700">Contact Information</h4>
                  <p className="text-sm text-blue-600">
                    This information will be used when users ask the chatbot for contact details.
                  </p>
                </div>
              </div>
            </div>

            {submitError && <div className="bg-red-50 p-3 rounded-md text-red-500 text-sm">{submitError}</div>}
          </CardContent>
          <CardFooter className="flex justify-between">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.push(`/dashboard/campaigns/${params.id}#${returnTab}`)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Saving..." : "Save Changes"}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  )
}
