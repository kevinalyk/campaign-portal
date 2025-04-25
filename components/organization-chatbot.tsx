"use client"

import { useState, useEffect } from "react"
import { Chatbot } from "@/components/chatbot"

interface OrganizationChatbotProps {
  organizationId?: string
  customColor?: string
  accentColor?: string
  welcomeMessage?: string
  botName?: string
  botIcon?: string
  contactEmail?: string
  contactPhone?: string
  contactAddress?: string
  isPreview?: boolean
  inline?: boolean
  initiallyOpen?: boolean
  actionButtons?: any[]
}

// Default action buttons to use as fallback
const defaultActionButtons = [
  {
    enabled: true,
    type: "donate",
    label: "Donate",
    textColor: "#000000",
    icon: "$",
  },
  {
    enabled: true,
    type: "contact",
    label: "Contact",
    textColor: "#000000",
    icon: "✉️",
  },
]

export function OrganizationChatbot({
  organizationId,
  customColor,
  accentColor,
  welcomeMessage,
  botName,
  botIcon,
  contactEmail,
  contactPhone,
  contactAddress,
  isPreview = false,
  inline = false,
  initiallyOpen = true,
  actionButtons,
}: OrganizationChatbotProps) {
  const [organization, setOrganization] = useState<any>(null)
  const [loading, setLoading] = useState(!isPreview)

  useEffect(() => {
    const fetchOrganization = async () => {
      if (isPreview || !organizationId) return

      try {
        setLoading(true)
        const response = await fetch(`/api/public/campaigns/${organizationId}`)

        if (!response.ok) {
          throw new Error("Failed to fetch organization")
        }

        const data = await response.json()
        setOrganization(data.campaign)
      } catch (error) {
        // console.error("Error fetching organization:", error)
      } finally {
        setLoading(false)
      }
    }

    fetchOrganization()
  }, [organizationId, isPreview])

  if (loading) {
    return null // Don't show anything while loading
  }

  // If in preview mode, use the props directly
  if (isPreview) {
    return (
      <Chatbot
        customColor={customColor || "#FF3B30"}
        accentColor={accentColor || "#192745"}
        welcomeMessage={welcomeMessage || "Hello! How can I help you today?"}
        botName={botName || "Campaign Chat Support"}
        botIcon={botIcon || ""}
        contactEmail={contactEmail || ""}
        contactPhone={contactPhone || ""}
        contactAddress={contactAddress || ""}
        isPreview={true}
        inline={inline}
        campaignId={organizationId}
        initiallyOpen={initiallyOpen}
        actionButtons={actionButtons}
      />
    )
  }

  // If no organizationId is provided, don't render anything
  if (!organizationId) {
    return null
  }

  // Otherwise, use the organization data
  return (
    <Chatbot
      campaignId={organizationId}
      customColor={organization?.chatColor || "#FF3B30"}
      accentColor={organization?.accentColor || "#192745"}
      donationUrl={organization?.donationUrl || ""}
      welcomeMessage={organization?.chatWelcomeMessage || "Hello! How can I help you today?"}
      contactEmail={organization?.contactEmail || ""}
      contactPhone={organization?.contactPhone || ""}
      contactAddress={organization?.contactAddress || ""}
      botName={organization?.chatBotName || "Campaign Chat Support"}
      botIcon={organization?.chatBotIcon || ""}
      enableDropShadow={organization?.enableDropShadow || false}
      headerTextColor={organization?.headerTextColor || "#FFFFFF"}
      actionButtons={organization?.actionButtons || defaultActionButtons} // Use default if not available
      inline={inline}
      initiallyOpen={initiallyOpen}
    />
  )
}
