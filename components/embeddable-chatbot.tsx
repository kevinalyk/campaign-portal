"use client"

import { useState } from "react"
import { Chatbot } from "@/components/chatbot"

interface EmbeddableChatbotProps {
  campaignId: string
  chatColor?: string
  donationUrl?: string
  welcomeMessage?: string
  contactEmail?: string
  contactPhone?: string
  contactAddress?: string
  botName?: string
  botIcon?: string // Add this prop
  accentColor?: string
  chatWelcomeMessage?: string
  chatBotName?: string
  botTextColor?: string
  chatBotIcon?: string
  enableDropShadow?: boolean
  headerTextColor?: string
  actionButtons?: any // Assuming actionButtons can be of any type, adjust if needed
  inline?: boolean
}

export function EmbeddableChatbot({
  campaignId,
  chatColor,
  donationUrl,
  welcomeMessage,
  contactEmail,
  contactPhone,
  contactAddress,
  botName,
  botIcon, // Add this prop
  accentColor,
  chatWelcomeMessage,
  chatBotName,
  botTextColor,
  chatBotIcon,
  enableDropShadow,
  headerTextColor,
  actionButtons,
  inline = false,
}: EmbeddableChatbotProps) {
  // Add state to control initial open state
  const [initiallyOpen] = useState(false)

  return (
    <Chatbot
      customColor={chatColor || "#FF3B30"}
      accentColor={accentColor || "#192745"}
      donationUrl={donationUrl}
      isEmbedded={true}
      welcomeMessage={chatWelcomeMessage || welcomeMessage}
      contactEmail={contactEmail}
      contactPhone={contactPhone}
      contactAddress={contactAddress}
      inline={inline}
      botName={chatBotName || botName}
      botTextColor={botTextColor}
      botIcon={chatBotIcon || botIcon} // Pass the botIcon prop
      campaignId={campaignId}
      enableDropShadow={enableDropShadow}
      headerTextColor={headerTextColor}
      actionButtons={actionButtons} // Add this line
      initiallyOpen={initiallyOpen}
    />
  )
}
