"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { toast } from "@/hooks/use-toast"

interface ContactInfoProps {
  campaignId: string
}

export function ContactInfoTab({ campaignId }: ContactInfoProps) {
  const [contactInfo, setContactInfo] = useState({
    contactEmail: "",
    contactPhone: "",
    addressStreet: "",
    addressCity: "",
    addressState: "",
    addressZip: "",
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const fetchContactInfo = async () => {
      try {
        const token = localStorage.getItem("token")
        if (!token) return

        const response = await fetch(`/api/campaigns/${campaignId}`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        })

        if (!response.ok) throw new Error("Failed to fetch campaign")

        const data = await response.json()

        // Handle both new format and legacy format
        setContactInfo({
          contactEmail: data.campaign.contactEmail || "",
          contactPhone: data.campaign.contactPhone || "",
          addressStreet: data.campaign.addressStreet || "",
          addressCity: data.campaign.addressCity || "",
          addressState: data.campaign.addressState || "",
          addressZip: data.campaign.addressZip || "",
        })
      } catch (error) {
        console.error("Error fetching contact info:", error)
        toast({
          title: "Error",
          description: "Failed to load contact information",
          variant: "destructive",
        })
      } finally {
        setLoading(false)
      }
    }

    fetchContactInfo()
  }, [campaignId])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)

    try {
      const token = localStorage.getItem("token")
      if (!token) return

      const response = await fetch(`/api/campaigns/${campaignId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(contactInfo),
      })

      if (!response.ok) throw new Error("Failed to update contact information")

      toast({
        title: "Success",
        description: "Contact information updated successfully",
      })
    } catch (error) {
      console.error("Error updating contact info:", error)
      toast({
        title: "Error",
        description: "Failed to update contact information",
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setContactInfo((prev) => ({ ...prev, [name]: value }))
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Contact Information</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="contactEmail" className="text-sm font-medium">
              Contact Email
            </label>
            <Input
              id="contactEmail"
              name="contactEmail"
              type="email"
              value={contactInfo.contactEmail}
              onChange={handleChange}
              placeholder="example@email.com"
            />
            <p className="text-sm text-gray-500">
              The email address that will be provided when users ask for contact information.
            </p>
          </div>

          <div className="space-y-2">
            <label htmlFor="contactPhone" className="text-sm font-medium">
              Contact Phone
            </label>
            <Input
              id="contactPhone"
              name="contactPhone"
              type="tel"
              value={contactInfo.contactPhone}
              onChange={handleChange}
              placeholder="555-555-5555"
            />
            <p className="text-sm text-gray-500">
              The phone number that will be provided when users ask for contact information.
            </p>
          </div>

          <div className="space-y-4">
            <h3 className="text-sm font-medium">Address</h3>

            <div className="space-y-2">
              <label htmlFor="addressStreet" className="text-sm font-medium">
                Street Address
              </label>
              <Input
                id="addressStreet"
                name="addressStreet"
                value={contactInfo.addressStreet}
                onChange={handleChange}
                placeholder="123 Main St"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label htmlFor="addressCity" className="text-sm font-medium">
                  City
                </label>
                <Input
                  id="addressCity"
                  name="addressCity"
                  value={contactInfo.addressCity}
                  onChange={handleChange}
                  placeholder="City"
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="addressState" className="text-sm font-medium">
                  State
                </label>
                <Input
                  id="addressState"
                  name="addressState"
                  value={contactInfo.addressState}
                  onChange={handleChange}
                  placeholder="State"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label htmlFor="addressZip" className="text-sm font-medium">
                ZIP Code
              </label>
              <Input
                id="addressZip"
                name="addressZip"
                value={contactInfo.addressZip}
                onChange={handleChange}
                placeholder="ZIP"
              />
            </div>

            <p className="text-sm text-gray-500">
              The address that will be provided when users ask for contact information.
            </p>
          </div>

          <Button type="submit" disabled={saving}>
            {saving ? "Saving..." : "Save Contact Information"}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
