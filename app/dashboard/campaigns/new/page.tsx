"use client"

import type React from "react"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Info, AlertCircle } from "lucide-react"
import { organizationSchema } from "@/lib/validations/organization-schema"
import { ZodError } from "zod"

export default function NewCampaignPage() {
  const router = useRouter()
  const [formData, setFormData] = useState({
    name: "",
    url: "",
    donationUrl: "",
    websiteUrl: "", // New field for main campaign website
    description: "",
    logoUrl: "",
    chatColor: "#FF0000", // Default to red
    chatWelcomeMessage: "Hello! Welcome to our organization portal. How can I assist you today?", // Default welcome message
    contactEmail: "",
    contactPhone: "",
    contactAddress: "",
    assistantIdentity: "", // New field for AI assistant identity
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))

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
    try {
      organizationSchema.parse(formData)
      setErrors({})
      return true
    } catch (error) {
      if (!(error instanceof ZodError)) {
        // Handle non-zod errors
        setErrors({ form: error.message })
        return false
      }

      // Handle zod errors
      const formattedErrors: Record<string, string> = {}

      error.errors.forEach((err) => {
        if (err.path && err.path.length > 0) {
          const fieldName = err.path[0].toString()
          formattedErrors[fieldName] = err.message
        }
      })

      setErrors(formattedErrors)

      // Set a general submit error to make it clear why the form isn't submitting
      setSubmitError("Please fix the validation errors before submitting.")

      return false
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // Clear previous submit error
    setSubmitError(null)

    if (!validateForm()) {
      return
    }

    setIsSubmitting(true)

    try {
      const token = localStorage.getItem("token")
      if (!token) {
        throw new Error("No authentication token found")
      }

      const response = await fetch("/api/campaigns", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(formData),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.message || "Failed to create organization")
      }

      const data = await response.json()
      router.push(`/dashboard/campaigns/${data.campaign._id}`)
    } catch (error) {
      console.error("Error creating organization:", error)
      setSubmitError(error.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto">
      <Card>
        <CardHeader>
          <CardTitle>Create New Organization</CardTitle>
          <CardDescription>Fill in the details to create your new organization</CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            {/* Display validation errors at the top of the form */}
            {Object.keys(errors).length > 0 && (
              <div className="bg-red-50 p-4 rounded-md border border-red-200">
                <div className="flex items-start">
                  <AlertCircle className="h-5 w-5 text-red-500 mr-2 mt-0.5" />
                  <div>
                    <h3 className="text-sm font-medium text-red-800">Please fix the following errors:</h3>
                    <ul className="mt-2 text-sm text-red-700 list-disc list-inside">
                      {Object.entries(errors).map(([field, message]) => (
                        <li key={field}>
                          {field === "form"
                            ? message
                            : `${field.charAt(0).toUpperCase() + field.slice(1).replace(/([A-Z])/g, " $1")}: ${message}`}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="name">Organization Name</Label>
              <Input
                id="name"
                name="name"
                value={formData.name}
                onChange={handleChange}
                placeholder="My Organization"
                className={errors.name ? "border-red-500" : ""}
                aria-invalid={!!errors.name}
              />
              {errors.name && (
                <p className="text-red-500 text-sm" role="alert">
                  {errors.name}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="url">Organization URL</Label>
              <Input
                id="url"
                name="url"
                value={formData.url}
                onChange={handleChange}
                placeholder="your-organization-name"
                className={errors.url ? "border-red-500" : ""}
                required
                aria-invalid={!!errors.url}
              />
              {errors.url && (
                <p className="text-red-500 text-sm" role="alert">
                  {errors.url}
                </p>
              )}
              <p className="text-sm text-gray-500">
                This will be used in your organization's URL: campaign/your-organization-name.
                <span className="font-medium text-amber-600"> Note: This cannot be changed after creation.</span>
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="donationUrl">WinRed Donation URL</Label>
              <Input
                id="donationUrl"
                name="donationUrl"
                value={formData.donationUrl}
                onChange={handleChange}
                placeholder="https://example.com/donate"
                className={errors.donationUrl ? "border-red-500" : ""}
                aria-invalid={!!errors.donationUrl}
              />
              {errors.donationUrl && (
                <p className="text-red-500 text-sm" role="alert">
                  {errors.donationUrl}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="websiteUrl">Website URL</Label>
              <Input
                id="websiteUrl"
                name="websiteUrl"
                type="text"
                value={formData.websiteUrl}
                onChange={handleChange}
                placeholder="https://example.com"
                className={errors.websiteUrl ? "border-red-500" : ""}
                required
                aria-invalid={!!errors.websiteUrl}
              />
              {errors.websiteUrl && (
                <p className="text-red-500 text-sm" role="alert">
                  {errors.websiteUrl}
                </p>
              )}
              <p className="text-sm text-gray-500">
                Enter the main website URL for your campaign. This cannot be changed after creation.
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
                aria-invalid={!!errors.description}
              />
              {errors.description && (
                <p className="text-red-500 text-sm" role="alert">
                  {errors.description}
                </p>
              )}
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
                  aria-invalid={!!errors.logoUrl}
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={async () => {
                    try {
                      setIsSubmitting(true)
                      const input = document.createElement("input")
                      input.type = "file"
                      input.accept = "image/*"

                      input.onchange = async (e) => {
                        try {
                          const file = (e.target as HTMLInputElement).files?.[0]
                          if (!file) return

                          // Check file size (max 5MB)
                          if (file.size > 5 * 1024 * 1024) {
                            setSubmitError("Image size exceeds 5MB limit")
                            return
                          }

                          const token = localStorage.getItem("token")
                          if (!token) {
                            throw new Error("No authentication token found")
                          }

                          const formData = new FormData()
                          formData.append("file", file)

                          const response = await fetch("/api/upload-logo", {
                            method: "POST",
                            headers: {
                              Authorization: `Bearer ${token}`,
                            },
                            body: formData,
                          })

                          if (!response.ok) {
                            const errorData = await response.json()
                            throw new Error(errorData.error || "Failed to upload image")
                          }

                          const data = await response.json()
                          setFormData((prev) => ({ ...prev, logoUrl: data.url }))
                          setSubmitError(null)
                        } catch (error) {
                          console.error("Error uploading image:", error)
                          setSubmitError(error.message || "Failed to upload image")
                        } finally {
                          setIsSubmitting(false)
                        }
                      }

                      input.click()
                    } catch (error) {
                      console.error("Error initiating upload:", error)
                      setSubmitError(error.message || "Failed to initiate upload")
                      setIsSubmitting(false)
                    }
                  }}
                >
                  Upload
                </Button>
              </div>
              {errors.logoUrl && (
                <p className="text-red-500 text-sm" role="alert">
                  {errors.logoUrl}
                </p>
              )}
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
                className={errors.assistantIdentity ? "border-red-500" : ""}
                aria-invalid={!!errors.assistantIdentity}
              />
              {errors.assistantIdentity && (
                <p className="text-red-500 text-sm" role="alert">
                  {errors.assistantIdentity}
                </p>
              )}
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
                    After creating your organization, you can customize the chat appearance and welcome message in the
                    Chat Settings tab.
                  </p>
                </div>
              </div>

              {/* Contact Information Note */}
              <div className="p-4 bg-blue-50 rounded-md flex items-start space-x-3">
                <Info className="h-5 w-5 text-blue-500 flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-medium text-blue-700">Contact Information</h4>
                  <p className="text-sm text-blue-600">
                    After creating your organization, you can add contact details in the Contact tab. This information
                    will be used when users ask the chatbot for contact details.
                  </p>
                </div>
              </div>
            </div>

            {submitError && (
              <div className="bg-red-50 p-3 rounded-md border border-red-200 text-red-700 text-sm flex items-center">
                <AlertCircle className="h-4 w-4 mr-2 flex-shrink-0" />
                {submitError}
              </div>
            )}
          </CardContent>
          <CardFooter className="flex justify-between">
            <Button type="button" variant="outline" onClick={() => router.push("/dashboard/campaigns")}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Creating..." : "Create Organization"}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  )
}
