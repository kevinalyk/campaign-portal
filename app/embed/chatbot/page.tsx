"use client"

import { useSearchParams } from "next/navigation"
import { Chatbot } from "@/components/chatbot"
import { useEffect, useState } from "react"

export default function EmbeddedChatbotPage() {
  const searchParams = useSearchParams()
  const [campaignData, setCampaignData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const campaignId = searchParams.get("campaignId") || ""

  // Fetch campaign data when the component mounts
  useEffect(() => {
    async function fetchCampaignData() {
      if (!campaignId) {
        setLoading(false)
        setError("No campaign ID provided")
        return
      }

      try {
        const response = await fetch(`/api/public/campaigns/${campaignId}`)

        if (!response.ok) {
          throw new Error(`Failed to fetch campaign data: ${response.status}`)
        }

        const data = await response.json()
        console.log("Fetched campaign data:", data)
        setCampaignData(data.campaign)
        setLoading(false)
      } catch (err) {
        console.error("Error fetching campaign data:", err)
        setError(err.message)
        setLoading(false)
      }
    }

    fetchCampaignData()
  }, [campaignId])

  // Add meta tag to allow embedding
  useEffect(() => {
    const meta = document.createElement("meta")
    meta.name = "x-frame-options"
    meta.content = "ALLOWALL"
    document.head.appendChild(meta)
  }, [])

  if (loading) {
    return <div className="p-4">Loading chatbot...</div>
  }

  if (error) {
    return <div className="p-4 text-red-500">Error: {error}</div>
  }

  if (!campaignData) {
    return <div className="p-4">Campaign not found</div>
  }

  return (
    <div className="h-screen w-full overflow-visible" style={{ margin: 0, padding: 0 }}>
      <Chatbot
        customColor={campaignData.chatColor}
        accentColor={campaignData.accentColor}
        donationUrl={campaignData.donationUrl}
        isEmbedded={true}
        welcomeMessage={campaignData.chatWelcomeMessage}
        contactEmail={campaignData.contactEmail}
        contactPhone={campaignData.contactPhone}
        contactAddress={campaignData.contactAddress}
        botName={campaignData.chatBotName}
        botTextColor={campaignData.botTextColor}
        inline={true}
        initiallyOpen={true}
        botIcon={campaignData.chatBotIcon}
        enableDropShadow={campaignData.enableDropShadow}
        headerTextColor={campaignData.headerTextColor}
        actionButtons={campaignData.actionButtons || []}
        campaignId={campaignId}
      />
    </div>
  )
}
