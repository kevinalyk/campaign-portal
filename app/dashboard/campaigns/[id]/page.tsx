"use client"

import type React from "react"
import { useState, useEffect, useRef } from "react"
import { useRouter, useParams } from "next/navigation"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { AddUserModal } from "@/components/add-user-modal"
import type { UserRole } from "@/models/UserCampaign"
import { Chatbot } from "@/components/chatbot"
import { EmbedCodeGenerator } from "@/components/embed-code-generator"
import { DocumentList } from "@/components/document-list"
import { WebsiteResourceList } from "@/components/website-resource-list"
import { Input } from "@/components/ui/input"
import { SettingsTab } from "@/components/settings-tab"
import { LinkIcon, ExternalLink, Save, Upload, ImageIcon, X, Maximize2 } from "lucide-react"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { ImageCropper } from "@/components/image-cropper"
import { toast } from "@/hooks/use-toast"
import { ChatLogsTab } from "@/components/chat-logs-tab"
import { ActivityLogsTab } from "@/components/activity-logs-tab"
import { ActionButtonsConfig } from "@/components/action-buttons-config"
import { PeopleTab } from "@/components/people-tab"

interface Campaign {
  _id: string
  name: string
  url: string
  donationUrl: string
  description: string
  logoUrl?: string
  chatColor?: string
  accentColor?: string
  createdAt: string
  updatedAt: string
  websiteUrl: string
  chatWelcomeMessage?: string
  contactEmail?: string
  contactPhone?: string
  contactAddress?: string
  addressStreet?: string
  addressCity?: string
  addressState?: string
  addressZip?: string
  chatBotName?: string
  botTextColor?: string
  assistantIdentity?: string
  chatBotIcon?: string
  enableDropShadow?: boolean
  headerTextColor?: string
  actionButtons?: any
}

// Function to sanitize text and remove potential XSS
const sanitizeText = (text: string): string => {
  if (!text) return ""

  // Replace HTML tags and potentially dangerous content
  return text
    .replace(/<[^>]*>?/g, "") // Remove all HTML tags
    .replace(/javascript:/gi, "") // Remove javascript: protocol
    .replace(/on\w+=/gi, "") // Remove event handlers
    .replace(/src\s*=\s*["']?[^"'>]*["']?/gi, "") // Remove src attributes
    .replace(/data:/gi, "") // Remove data: URIs
    .replace(/&lt;/g, "<") // Convert HTML entities back to characters for further sanitization
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, "/")
    .replace(/&#\d+;/g, "")
    .replace(/<[^>]*>?/g, "") // Remove any remaining HTML tags after entity conversion
}

interface CampaignUser {
  userId: string
  role: string
  userDetails?: {
    firstName: string
    email: string
  }
}

export default function CampaignDetailPage() {
  const router = useRouter()
  const params = useParams()
  const [campaign, setCampaign] = useState<Campaign | null>(null)
  const [campaignUsers, setCampaignUsers] = useState<CampaignUser[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isAddUserModalOpen, setIsAddUserModalOpen] = useState(false)
  const [addUserSuccess, setAddUserSuccess] = useState<string | null>(null)
  const [userRole, setUserRole] = useState<string>("viewer")
  const [activeTab, setActiveTab] = useState("details")
  const [showIconCropper, setShowIconCropper] = useState(false)
  const [showChatPreview, setShowChatPreview] = useState(false)
  const [showMobilePreview, setShowMobilePreview] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const designTabRef = useRef<HTMLDivElement>(null)

  // Chat settings state
  const [chatSettings, setChatSettings] = useState({
    chatColor: "#FF0000",
    accentColor: "#192745",
    chatWelcomeMessage: "Hello! Welcome to our campaign portal. How can I assist you today?",
    chatBotName: "Campaign Chat Support",
    chatBotIcon: "",
    enableDropShadow: false,
    headerTextColor: "#FFFFFF",
    actionButtons: [
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
    ],
  })
  const [isSavingChatSettings, setIsSavingChatSettings] = useState(false)
  const [chatSettingsChanged, setChatSettingsChanged] = useState(false)
  const [chatSettingsSaveSuccess, setChatSettingsSaveSuccess] = useState(false)

  // Contact information state
  const [contactInfo, setContactInfo] = useState({
    contactEmail: "",
    contactPhone: "",
    addressStreet: "",
    addressCity: "",
    addressState: "",
    addressZip: "",
  })
  const [isSavingContactInfo, setIsSavingContactInfo] = useState(false)
  const [contactInfoChanged, setContactInfoChanged] = useState(false)
  const [contactInfoSaveSuccess, setContactInfoSaveSuccess] = useState(false)

  // Check for mobile
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 1024)
    }

    checkMobile()
    window.addEventListener("resize", checkMobile)

    return () => {
      window.removeEventListener("resize", checkMobile)
    }
  }, [])

  // Listen for hash changes to update the active tab
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.replace("#", "")
      if (hash) {
        setActiveTab(hash)
      } else {
        setActiveTab("details")
      }
    }

    // Set initial tab based on hash
    handleHashChange()

    // Add event listener for hash changes
    window.addEventListener("hashchange", handleHashChange)

    // Clean up
    return () => {
      window.removeEventListener("hashchange", handleHashChange)
    }
  }, [])

  // Show/hide chat preview based on active tab
  useEffect(() => {
    if (activeTab !== "design") {
      setShowChatPreview(false)
    }
  }, [activeTab])

  useEffect(() => {
    const fetchCampaign = async () => {
      try {
        const token = localStorage.getItem("token")
        const campaignIdOrUrl = params.id as string

        if (!token || !campaignIdOrUrl) {
          router.push("/login")
          return
        }

        // Add a timestamp to prevent caching
        const timestamp = new Date().getTime()
        const response = await fetch(`/api/campaigns/${campaignIdOrUrl}?t=${timestamp}`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          cache: "no-store",
        })

        if (!response.ok) {
          throw new Error("Failed to fetch organization")
        }

        const data = await response.json()
        setCampaign(data.campaign)

        // Initialize chat settings with sanitized values
        setChatSettings({
          chatColor: data.campaign.chatColor || "#FF0000",
          accentColor: data.campaign.accentColor || "#192745",
          chatWelcomeMessage: sanitizeText(
            data.campaign.chatWelcomeMessage || "Hello! Welcome to our campaign portal. How can I assist you today?",
          ),
          chatBotName: sanitizeText(data.campaign.chatBotName || "Campaign Chat Support"),
          chatBotIcon: data.campaign.chatBotIcon || "",
          enableDropShadow: data.campaign.enableDropShadow || false,
          headerTextColor: data.campaign.headerTextColor || "#FFFFFF",
          actionButtons: Array.isArray(data.campaign.actionButtons)
            ? data.campaign.actionButtons.map((button) => ({
                ...button,
                label: sanitizeText(button.label),
                icon: sanitizeText(button.icon),
                message: button.message ? sanitizeText(button.message) : undefined,
              }))
            : [
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
              ],
        })

        // Initialize contact information
        // First check if we have the contactAddress field and it contains data not in the individual fields
        if (
          data.campaign.contactAddress &&
          (!data.campaign.addressStreet ||
            (data.campaign.contactAddress.includes("NW") && !data.campaign.addressStreet.includes("NW")))
        ) {
          // Parse the contact address to get individual components
          const addressParts = parseAddress(data.campaign.contactAddress || "")
          setContactInfo({
            contactEmail: data.campaign.contactEmail || "",
            contactPhone: data.campaign.contactPhone || "",
            addressStreet: addressParts.street || data.campaign.addressStreet || "",
            addressCity: addressParts.city || data.campaign.addressCity || "",
            addressState: addressParts.state || data.campaign.addressState || "",
            addressZip: addressParts.zip || data.campaign.addressZip || "",
          })
        } else if (
          data.campaign.addressStreet ||
          data.campaign.addressCity ||
          data.campaign.addressState ||
          data.campaign.addressZip
        ) {
          setContactInfo({
            contactEmail: data.campaign.contactEmail || "",
            contactPhone: data.campaign.contactPhone || "",
            addressStreet: data.campaign.addressStreet || "",
            addressCity: data.campaign.addressCity || "",
            addressState: data.campaign.addressState || "",
            addressZip: data.campaign.addressZip || "",
          })
        } else {
          setContactInfo({
            contactEmail: data.campaign.contactEmail || "",
            contactPhone: data.campaign.contactPhone || "",
            addressStreet: "",
            addressCity: "",
            addressState: "",
            addressZip: "",
          })
        }

        // Fetch campaign users - use the actual campaign ID from the response
        const usersResponse = await fetch(`/api/campaigns/${data.campaign._id}/users`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        })

        if (usersResponse.ok) {
          const usersData = await usersResponse.json()
          const users = usersData.users || []

          // Find current user's role
          const userId = JSON.parse(localStorage.getItem("user") || "{}").id
          const currentUserData = users.find((user: CampaignUser) => user.userId === userId)
          if (currentUserData) {
            setUserRole(currentUserData.role)
          }

          // Fetch user details for each user
          const usersWithDetails = await Promise.all(
            users.map(async (user: CampaignUser) => {
              try {
                const userResponse = await fetch(`/api/users/${user.userId}`, {
                  headers: {
                    Authorization: `Bearer ${token}`,
                  },
                })

                if (userResponse.ok) {
                  const userData = await userResponse.json()
                  return {
                    ...user,
                    userDetails: {
                      firstName: userData.user.firstName,
                      email: userData.user.email,
                    },
                  }
                }
                return user
              } catch (error) {
                return user
              }
            }),
          )

          setCampaignUsers(usersWithDetails)
        }
      } catch (error) {
        setError(error.message)
      } finally {
        setLoading(false)
      }
    }

    fetchCampaign()
  }, [router, params.id])

  // Helper function to parse an address string into components
  const parseAddress = (addressStr: string) => {
    // Default empty values
    const result = {
      street: "",
      city: "",
      state: "",
      zip: "",
    }

    if (!addressStr) return result

    // Try to match common address patterns
    // Example: "123 Main St NW, Anytown, ST 12345"
    const parts = addressStr.split(",").map((part) => part.trim())

    if (parts.length >= 1) {
      result.street = parts[0]
    }

    if (parts.length >= 2) {
      result.city = parts[1]
    }

    if (parts.length >= 3) {
      // Last part might contain state and zip
      const stateZip = parts[parts.length - 1].split(" ")
      if (stateZip.length >= 2) {
        // Assume the last element is the zip code
        result.zip = stateZip.pop() || ""
        // Join the rest as the state
        result.state = stateZip.join(" ")
      } else {
        result.state = parts[parts.length - 1]
      }
    }

    return result
  }

  // Check if chat settings have changed
  useEffect(() => {
    if (campaign && chatSettings) {
      // Check if action buttons have changed by stringifying them for comparison
      const currentActionButtons = JSON.stringify(chatSettings.actionButtons)
      const originalActionButtons = JSON.stringify(
        campaign.actionButtons || [
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
        ],
      )

      const hasChanged =
        chatSettings.chatColor !== (campaign.chatColor || "#FF0000") ||
        chatSettings.accentColor !== (campaign.accentColor || "#192745") ||
        chatSettings.chatWelcomeMessage !==
          sanitizeText(
            campaign.chatWelcomeMessage || "Hello! Welcome to our campaign portal. How can I assist you today?",
          ) ||
        chatSettings.chatBotName !== sanitizeText(campaign.chatBotName || "Campaign Chat Support") ||
        chatSettings.chatBotIcon !== (campaign.chatBotIcon || "") ||
        chatSettings.enableDropShadow !== (campaign.enableDropShadow || false) ||
        chatSettings.headerTextColor !== (campaign.headerTextColor || "#FFFFFF") ||
        currentActionButtons !== originalActionButtons

      setChatSettingsChanged(hasChanged)
    }
  }, [chatSettings, campaign])

  // Check if contact information has changed
  useEffect(() => {
    if (campaign) {
      const hasChanged =
        contactInfo.contactEmail !== (campaign.contactEmail || "") ||
        contactInfo.contactPhone !== (campaign.contactPhone || "") ||
        contactInfo.addressStreet !== (campaign.addressStreet || "") ||
        contactInfo.addressCity !== (campaign.addressCity || "") ||
        contactInfo.addressState !== (campaign.addressState || "") ||
        contactInfo.addressZip !== (campaign.addressZip || "")

      setContactInfoChanged(hasChanged)
    }
  }, [contactInfo, campaign])

  const handleChatSettingChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target

    // Aggressively sanitize text inputs
    let sanitizedValue = value

    if (name === "chatWelcomeMessage" || name === "chatBotName") {
      sanitizedValue = sanitizeText(value)
    }

    setChatSettings((prev) => ({
      ...prev,
      [name]: sanitizedValue,
    }))

    // Reset success message when settings change
    if (chatSettingsSaveSuccess) {
      setChatSettingsSaveSuccess(false)
    }
  }

  const handleContactInfoChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setContactInfo((prev) => ({
      ...prev,
      [name]: value,
    }))

    // Reset success message when settings change
    if (contactInfoSaveSuccess) {
      setContactInfoSaveSuccess(false)
    }
  }

  const handleCroppedImage = (croppedImage: string) => {
    // Set the image directly in the UI for immediate feedback
    setChatSettings((prev) => ({
      ...prev,
      chatBotIcon: croppedImage,
    }))
    setShowIconCropper(false)
    setChatSettingsChanged(true)
  }

  const saveChatSettings = async () => {
    if (!campaign) return

    setIsSavingChatSettings(true)

    try {
      const token = localStorage.getItem("token")
      if (!token) {
        throw new Error("No authentication token found")
      }

      // Sanitize inputs to prevent XSS
      const sanitizedSettings = {
        chatColor: chatSettings.chatColor,
        accentColor: chatSettings.accentColor,
        chatWelcomeMessage: sanitizeText(chatSettings.chatWelcomeMessage),
        chatBotName: sanitizeText(chatSettings.chatBotName),
        chatBotIcon: chatSettings.chatBotIcon,
        enableDropShadow: chatSettings.enableDropShadow,
        headerTextColor: chatSettings.headerTextColor,
        actionButtons: chatSettings.actionButtons.map((button) => ({
          ...button,
          label: sanitizeText(button.label),
          icon: sanitizeText(button.icon),
          action: button.action
            ? {
                type: button.action.type,
                content: sanitizeText(button.action.content),
              }
            : undefined,
        })),
      }

      // Only update the chat settings fields
      const response = await fetch(`/api/campaigns/${campaign._id}/chat-settings`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(sanitizedSettings),
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Failed to update chat settings: ${errorText}`)
      }

      const data = await response.json()

      // Update the campaign object with new settings
      setCampaign((prev) => {
        if (!prev) return null
        return {
          ...prev,
          chatColor: sanitizedSettings.chatColor,
          accentColor: sanitizedSettings.accentColor,
          chatWelcomeMessage: sanitizedSettings.chatWelcomeMessage,
          chatBotName: sanitizedSettings.chatBotName,
          chatBotIcon: sanitizedSettings.chatBotIcon,
          enableDropShadow: sanitizedSettings.enableDropShadow,
          headerTextColor: sanitizedSettings.headerTextColor,
          actionButtons: sanitizedSettings.actionButtons,
        }
      })

      // Update the chat settings state with sanitized values
      setChatSettings(sanitizedSettings)

      setChatSettingsChanged(false)
      setChatSettingsSaveSuccess(true)

      // Hide success message after 3 seconds
      setTimeout(() => {
        setChatSettingsSaveSuccess(false)
      }, 3000)
    } catch (error) {
      setError(error.message)
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      })
    } finally {
      setIsSavingChatSettings(false)
    }
  }

  const saveContactInfo = async () => {
    if (!campaign) return

    setIsSavingContactInfo(true)

    try {
      const token = localStorage.getItem("token")
      if (!token) {
        throw new Error("No authentication token found")
      }

      // First, check if the contactAddress contains information not in the individual fields
      // This handles cases where someone might have edited the contactAddress directly in the past
      if (campaign.contactAddress && !contactInfo.addressStreet) {
        // Try to parse the existing address
        const parsedAddress = parseAddress(campaign.contactAddress)

        // Update the contact info with parsed values if they're not already set
        if (!contactInfo.addressStreet) contactInfo.addressStreet = parsedAddress.street
        if (!contactInfo.addressCity) contactInfo.addressCity = parsedAddress.city
        if (!contactInfo.addressState) contactInfo.addressState = parsedAddress.state
        if (!contactInfo.addressZip) contactInfo.addressZip = parsedAddress.zip
      }

      // Prepare the data to send to the API
      const contactData = {
        contactEmail: contactInfo.contactEmail,
        contactPhone: contactInfo.contactPhone,
        addressStreet: contactInfo.addressStreet,
        addressCity: contactInfo.addressCity,
        addressState: contactInfo.addressState,
        addressZip: contactInfo.addressZip,
        // Also include a formatted address for backward compatibility
        contactAddress: [
          contactInfo.addressStreet,
          contactInfo.addressCity,
          `${contactInfo.addressState} ${contactInfo.addressZip}`,
        ]
          .filter(Boolean)
          .join(", "),
      }

      // Only update the contact information fields
      const response = await fetch(`/api/campaigns/${campaign._id}/contact-info`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(contactData),
      })

      if (!response.ok) {
        throw new Error("Failed to update contact information")
      }

      // Update the campaign object with new contact info
      setCampaign((prev) => {
        if (!prev) return null
        return {
          ...prev,
          ...contactData,
        }
      })

      setContactInfoChanged(false)
      setContactInfoSaveSuccess(true)

      // Hide success message after 3 seconds
      setTimeout(() => {
        setContactInfoSaveSuccess(false)
      }, 3000)
    } catch (error) {
      setError(error.message)
    } finally {
      setIsSavingContactInfo(false)
    }
  }

  const handleAddUser = (email: string, role: UserRole) => {
    // In a real implementation, this would call an API to send the invitation
    // For now, we'll just show a success message
    setAddUserSuccess(`Invitation sent to ${email} with role: ${role}`)

    // Clear the success message after 5 seconds
    setTimeout(() => {
      setAddUserSuccess(null)
    }, 5000)
  }

  const getUserDisplayName = (user: CampaignUser) => {
    if (user.userDetails) {
      if (user.userDetails.firstName && user.userDetails.lastName) {
        return `${user.userDetails.firstName} ${user.userDetails.lastName}`
      }
      return user.userDetails.email
    }
    return user.userId
  }

  // Handle tab change from the tabs component
  const handleTabChange = (value: string) => {
    setActiveTab(value)
  }

  const handleRemoveUser = async (userId: string) => {
    if (!campaign) return

    try {
      const token = localStorage.getItem("token")
      if (!token) {
        router.push("/login")
        return
      }

      const response = await fetch(`/api/campaigns/${campaign._id}/users/${userId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      if (!response.ok) {
        throw new Error("Failed to remove user")
      }

      // Update the local state
      setCampaignUsers((prev) => prev.filter((user) => user.userId !== userId))

      toast({
        title: "Success",
        description: "User removed successfully",
      })
    } catch (error) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      })
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
      <div className="max-w-4xl mx-auto">
        <Card>
          <CardContent className="pt-6">
            <p className="text-red-500">{error}</p>
            <Button variant="outline" className="mt-4" onClick={() => router.push("/dashboard/campaigns")}>
              Return to Campaigns
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!campaign) {
    return (
      <div className="max-w-4xl mx-auto">
        <Card>
          <CardContent className="pt-6 text-center">
            <p className="text-gray-500">Campaign not found</p>
            <Button variant="outline" className="mt-4" onClick={() => router.push("/dashboard/campaigns")}>
              Return to Campaigns
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Get the campaign ID for use in components
  const campaignId = campaign._id.toString()

  // Render the chat preview component
  const renderChatPreview = () => (
    <div>
      <div className="sticky top-0 bg-white p-4 border-b flex justify-between items-center">
        <h3 className="font-medium">Chat Preview</h3>
        {isMobile && (
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => setShowMobilePreview(false)}>
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>
      <div className="p-4">
        <p className="text-sm text-gray-600 mb-4">
          This is how your chat will appear to users visiting your organization page.
        </p>

        <div className="h-[500px] relative border rounded-md bg-white">
          <Chatbot
            key={`${chatSettings.chatWelcomeMessage}-${chatSettings.chatBotName}-${chatSettings.chatBotIcon}-${chatSettings.enableDropShadow}-${chatSettings.headerTextColor}`}
            customColor={chatSettings.chatColor}
            accentColor={chatSettings.accentColor}
            donationUrl={campaign.donationUrl}
            welcomeMessage={chatSettings.chatWelcomeMessage}
            contactEmail={contactInfo.contactEmail}
            contactPhone={contactInfo.contactPhone}
            contactAddress={[
              contactInfo.addressStreet,
              contactInfo.addressCity,
              `${contactInfo.addressState} ${contactInfo.addressZip}`,
            ]
              .filter(Boolean)
              .join(", ")}
            botName={chatSettings.chatBotName}
            botIcon={chatSettings.chatBotIcon}
            enableDropShadow={chatSettings.enableDropShadow}
            headerTextColor={chatSettings.headerTextColor}
            actionButtons={chatSettings.actionButtons}
            inline={true}
            isPreview={true}
            initiallyOpen={false}
          />
        </div>
      </div>
    </div>
  )

  return (
    <div className="max-w-4xl mx-auto">
      <Card>
        <CardContent className="pt-6 space-y-6">
          {/* Render content based on activeTab state */}
          {activeTab === "details" && (
            <div className="space-y-6">
              <h3 className="text-2xl font-bold mb-4">Details</h3>
              <div>
                <h3 className="text-sm font-medium text-gray-500 mb-1">Description</h3>
                <p className="text-gray-900">{campaign.description}</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h3 className="text-sm font-medium text-gray-500 mb-1">Organization URL</h3>
                  <div className="flex items-center space-x-2">
                    <p className="text-gray-900 break-all">campaign/{campaign.url}</p>
                    <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                      <LinkIcon className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-medium text-gray-500 mb-1">WinRed Donation URL</h3>
                  <div className="flex items-center space-x-2">
                    <p className="text-gray-900 truncate max-w-[200px]">{campaign.donationUrl}</p>
                    <a href={campaign.donationUrl} target="_blank" rel="noopener noreferrer">
                      <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                    </a>
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-medium text-gray-500 mb-1">Organization Website URL</h3>
                  <div className="flex items-center space-x-2">
                    <p className="text-gray-900 truncate max-w-[200px]">{campaign.websiteUrl}</p>
                    <a href={campaign.websiteUrl} target="_blank" rel="noopener noreferrer">
                      <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                    </a>
                  </div>
                </div>

                {campaign.logoUrl && (
                  <div>
                    <h3 className="text-sm font-medium text-gray-500 mb-1">Logo</h3>
                    <div className="mt-2 w-24 h-24 relative">
                      <img
                        src={campaign.logoUrl || "/placeholder.svg"}
                        alt={`${campaign.name} logo`}
                        className="object-contain"
                        onError={(e) => {
                          e.currentTarget.src = "/placeholder.svg?height=96&width=96"
                        }}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Contact Information Section */}
              <div className="mt-8 pt-6 border-t">
                <h3 className="text-lg font-medium mb-4">Contact Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {contactInfo.contactEmail && (
                    <div>
                      <h3 className="text-sm font-medium text-gray-500 mb-1">Email</h3>
                      <p className="text-gray-900">{contactInfo.contactEmail}</p>
                    </div>
                  )}

                  {contactInfo.contactPhone && (
                    <div>
                      <h3 className="text-sm font-medium text-gray-500 mb-1">Phone</h3>
                      <p className="text-gray-900">{contactInfo.contactPhone}</p>
                    </div>
                  )}

                  {(contactInfo.addressStreet ||
                    contactInfo.addressCity ||
                    contactInfo.addressState ||
                    contactInfo.addressZip) && (
                    <div className="md:col-span-2">
                      <h3 className="text-sm font-medium text-gray-500 mb-1">Address</h3>
                      <p className="text-gray-900">
                        {contactInfo.addressStreet && <span className="block">{contactInfo.addressStreet}</span>}
                        {(contactInfo.addressCity || contactInfo.addressState || contactInfo.addressZip) && (
                          <span className="block">
                            {contactInfo.addressCity && `${contactInfo.addressCity}, `}
                            {contactInfo.addressState} {contactInfo.addressZip}
                          </span>
                        )}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === "documents" && (
            <div className="space-y-6">
              <h3 className="text-2xl font-bold mb-4">Documents</h3>
              <DocumentList campaignId={campaignId} userRole={userRole} />
            </div>
          )}

          {activeTab === "website" && (
            <div className="space-y-6">
              <h3 className="text-2xl font-bold mb-4">Website Resources</h3>
              <WebsiteResourceList campaignId={campaignId} userRole={userRole} />
            </div>
          )}

          {activeTab === "design" && (
            <div className="space-y-6" ref={designTabRef}>
              <div>
                <h3 className="text-xl font-medium mb-6">Design Settings</h3>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  <div className="space-y-6">
                    {/* Chat Bot Icon */}
                    <div className="p-6 bg-gray-50 rounded-lg space-y-4">
                      <Label htmlFor="chatBotIcon" className="text-base">
                        Chat Bot Icon
                      </Label>
                      <div className="flex items-center space-x-4">
                        <div className="w-16 h-16 rounded-full border overflow-hidden flex items-center justify-center bg-gray-100">
                          {chatSettings.chatBotIcon ? (
                            <img
                              src={chatSettings.chatBotIcon || "/placeholder.svg"}
                              alt="Chat Bot Icon"
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <ImageIcon className="h-8 w-8 text-gray-400" />
                          )}
                        </div>
                        <Button
                          variant="outline"
                          onClick={() => setShowIconCropper(true)}
                          className="flex items-center"
                        >
                          <Upload className="h-4 w-4 mr-2" />
                          {chatSettings.chatBotIcon ? "Change Icon" : "Upload Icon"}
                        </Button>
                      </div>
                      <p className="text-gray-500 text-xs">
                        This icon will be displayed next to AI messages in the chat. For best results, use a square
                        image.
                      </p>
                    </div>

                    {/* Chat Color Setting */}
                    <div className="p-6 bg-gray-50 rounded-lg space-y-4">
                      <Label htmlFor="chatColor" className="text-base">
                        Chat Color
                      </Label>
                      <div className="flex gap-3">
                        <Input
                          id="chatColor"
                          name="chatColor"
                          type="color"
                          value={chatSettings.chatColor}
                          onChange={handleChatSettingChange}
                          className="w-16 h-10 p-1"
                        />
                        <Input
                          id="chatColorText"
                          name="chatColor"
                          value={chatSettings.chatColor}
                          onChange={handleChatSettingChange}
                          placeholder="#FF0000"
                          className="flex-1"
                        />
                      </div>
                      <p className="text-gray-500 text-xs">
                        This color will be used for the chat interface when users interact with this organization.
                      </p>
                    </div>

                    {/* Header Color Setting */}
                    <div className="p-6 bg-gray-50 rounded-lg space-y-4">
                      <Label htmlFor="accentColor" className="text-base">
                        Header Color
                      </Label>
                      <div className="flex gap-3">
                        <Input
                          id="accentColor"
                          name="accentColor"
                          type="color"
                          value={chatSettings.accentColor}
                          onChange={handleChatSettingChange}
                          className="w-16 h-10 p-1"
                        />
                        <Input
                          id="accentColorText"
                          name="accentColor"
                          value={chatSettings.accentColor}
                          onChange={handleChatSettingChange}
                          placeholder="#192745"
                          className="flex-1"
                        />
                      </div>
                      <p className="text-gray-500 text-xs">
                        This color will be used for the chat header and chat bubble when closed.
                      </p>
                    </div>
                  </div>

                  <div className="space-y-6">
                    {/* Header Text Color Setting */}
                    <div className="p-6 bg-gray-50 rounded-lg space-y-4">
                      <Label htmlFor="headerTextColor" className="text-base">
                        Header Text Color
                      </Label>
                      <div className="flex gap-3">
                        <Input
                          id="headerTextColor"
                          name="headerTextColor"
                          type="color"
                          value={chatSettings.headerTextColor}
                          onChange={handleChatSettingChange}
                          className="w-16 h-10 p-1"
                        />
                        <Input
                          id="headerTextColorText"
                          name="headerTextColor"
                          value={chatSettings.headerTextColor}
                          onChange={handleChatSettingChange}
                          placeholder="#FFFFFF"
                          className="flex-1"
                        />
                      </div>
                      <p className="text-gray-500 text-xs">
                        This color will be used for the text in the chat header. Choose a color that contrasts well with
                        the header background.
                      </p>
                    </div>

                    {/* Chat Bot Name Setting */}
                    <div className="p-6 bg-gray-50 rounded-lg space-y-4">
                      <Label htmlFor="chatBotName" className="text-base">
                        Chat Bot Name
                      </Label>
                      <Input
                        id="chatBotName"
                        name="chatBotName"
                        value={chatSettings.chatBotName}
                        onChange={handleChatSettingChange}
                        placeholder="Campaign Chat Support"
                      />
                      <p className="text-gray-500 text-xs">The name that will be displayed in the chat header.</p>
                    </div>

                    {/* Chat Welcome Message Setting */}
                    <div className="p-6 bg-gray-50 rounded-lg space-y-4">
                      <Label htmlFor="chatWelcomeMessage" className="text-base">
                        Chat Welcome Message
                      </Label>
                      <Textarea
                        id="chatWelcomeMessage"
                        name="chatWelcomeMessage"
                        value={chatSettings.chatWelcomeMessage}
                        onChange={handleChatSettingChange}
                        placeholder="Hello! Welcome to our campaign portal. How can I assist you today?"
                        rows={3}
                      />
                      <p className="text-gray-500 text-xs">
                        This is the first message users will see when they open the chat.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Drop Shadow Option */}
                <div className="mt-6 p-6 bg-gray-50 rounded-lg">
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="enableDropShadow"
                      name="enableDropShadow"
                      checked={chatSettings.enableDropShadow}
                      onChange={(e) => {
                        setChatSettings((prev) => ({
                          ...prev,
                          enableDropShadow: e.target.checked,
                        }))
                        setChatSettingsChanged(true)
                      }}
                      className="h-4 w-4 text-primary border-gray-300 rounded focus:ring-primary"
                    />
                    <Label htmlFor="enableDropShadow">Enable drop shadow on logo</Label>
                  </div>
                  <p className="text-gray-500 text-xs ml-6 mt-1">
                    Adds a subtle shadow to make the logo pop more against the background.
                  </p>
                </div>

                {/* Action Buttons Configuration */}
                <div className="mt-6 p-6 bg-gray-50 rounded-lg">
                  <h4 className="font-medium mb-4">Action Buttons</h4>
                  <ActionButtonsConfig
                    buttons={
                      chatSettings.actionButtons || [
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
                    }
                    onChange={(buttons) => {
                      // Sanitize button data
                      const sanitizedButtons = buttons.map((button) => ({
                        ...button,
                        label: sanitizeText(button.label || ""),
                        icon: sanitizeText(button.icon || ""),
                        message: button.message ? sanitizeText(button.message) : undefined,
                        url: button.url || undefined,
                      }))

                      setChatSettings((prev) => ({
                        ...prev,
                        actionButtons: sanitizedButtons,
                      }))
                      setChatSettingsChanged(true)
                    }}
                  />
                </div>

                {/* Save Button */}
                <div className="mt-8">
                  <Button
                    onClick={saveChatSettings}
                    disabled={!chatSettingsChanged || isSavingChatSettings}
                    className="w-full"
                    size="lg"
                  >
                    {isSavingChatSettings ? (
                      "Saving..."
                    ) : (
                      <>
                        <Save className="h-4 w-4 mr-2" />
                        Save Design Settings
                      </>
                    )}
                  </Button>

                  {chatSettingsSaveSuccess && (
                    <p className="text-green-600 text-sm mt-2 text-center">Design settings saved successfully!</p>
                  )}
                </div>

                {/* Mobile Preview Button */}
                {isMobile && (
                  <div className="mt-6">
                    <Button onClick={() => setShowMobilePreview(true)} variant="outline" className="w-full" size="lg">
                      <Maximize2 className="h-4 w-4 mr-2" />
                      View Chat Preview
                    </Button>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === "embed" && (
            <div className="space-y-6">
              <h3 className="text-2xl font-bold mb-4">Embed Code</h3>
              <p className="text-sm text-gray-600">
                Use this code to embed your organization chatbot on your website. The chatbot will use your
                organization's color and donation URL.
              </p>
              <EmbedCodeGenerator campaignId={campaignId} />
            </div>
          )}

          {activeTab === "settings" && (
            <div className="space-y-6">
              <h3 className="text-2xl font-bold mb-4">Settings</h3>
              <SettingsTab organizationId={campaignId} organizationName={campaign.name} />
            </div>
          )}

          {activeTab === "logs" && (
            <div className="space-y-6">
              <h3 className="text-2xl font-bold mb-4">Reporting</h3>
              <ChatLogsTab campaignId={campaignId} />
            </div>
          )}

          {activeTab === "activity" && (
            <div className="space-y-6">
              <h3 className="text-2xl font-bold mb-4">Activity</h3>
              <ActivityLogsTab organizationId={campaignId} />
            </div>
          )}

          {activeTab === "users" && (
            <div className="space-y-6">
              <h3 className="text-2xl font-bold mb-4">Users</h3>
              <div className="flex justify-between items-center mb-4">
                {(userRole === "owner" || userRole === "admin") && (
                  <Button onClick={() => setIsAddUserModalOpen(true)}>Add User</Button>
                )}
              </div>

              {addUserSuccess && <p className="text-green-600 text-sm">{addUserSuccess}</p>}

              <div className="space-y-4">
                {campaignUsers.length === 0 ? (
                  <p className="text-gray-500">No users found.</p>
                ) : (
                  campaignUsers.map((user) => (
                    <div key={user.userId} className="flex items-center justify-between p-3 bg-gray-50 rounded-md">
                      <div>
                        <p className="font-medium">{user.userDetails?.firstName || user.userId}</p>
                        <p className="text-sm text-gray-500">{user.userDetails?.email || "No email available"}</p>
                        <p className="text-xs text-gray-400 capitalize">{user.role}</p>
                      </div>
                      {userRole === "owner" && user.role !== "owner" && (
                        <Button variant="outline" size="sm" onClick={() => handleRemoveUser(user.userId)}>
                          Remove
                        </Button>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {activeTab === "people" && (
            <div className="space-y-6">
              <h3 className="text-2xl font-bold mb-4">People</h3>
              <PeopleTab campaignId={campaignId} />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Chat Preview Toggle Button (Desktop) */}
      {activeTab === "design" && !isMobile && !showChatPreview && (
        <div className="hidden lg:block fixed right-4 top-20 z-50">
          <Button onClick={() => setShowChatPreview(true)} className="flex items-center shadow-lg">
            <Maximize2 className="h-4 w-4 mr-2" />
            Show Chat Preview
          </Button>
        </div>
      )}

      {/* Floating Chat Preview */}
      {showChatPreview && !isMobile && (
        <div className="hidden lg:block fixed right-4 top-20 w-[350px] bg-white rounded-lg shadow-xl border z-50 max-h-[calc(100vh-120px)] overflow-auto">
          <div className="sticky top-0 bg-white p-4 border-b flex justify-between items-center">
            <h3 className="font-medium">Chat Preview</h3>
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => setShowChatPreview(false)}>
              <X className="h-4 w-4" />
            </Button>
          </div>
          <div className="p-4">
            <p className="text-sm text-gray-600 mb-4">
              This is how your chat will appear to users visiting your organization page.
            </p>

            <div className="h-[500px] relative border rounded-md bg-white">
              <Chatbot
                key={`${chatSettings.chatWelcomeMessage}-${chatSettings.chatBotName}-${chatSettings.chatBotIcon}-${chatSettings.enableDropShadow}-${chatSettings.headerTextColor}`}
                customColor={chatSettings.chatColor}
                accentColor={chatSettings.accentColor}
                donationUrl={campaign.donationUrl}
                welcomeMessage={chatSettings.chatWelcomeMessage}
                contactEmail={contactInfo.contactEmail}
                contactPhone={contactInfo.contactPhone}
                contactAddress={[
                  contactInfo.addressStreet,
                  contactInfo.addressCity,
                  `${contactInfo.addressState} ${contactInfo.addressZip}`,
                ]
                  .filter(Boolean)
                  .join(", ")}
                botName={chatSettings.chatBotName}
                botIcon={chatSettings.chatBotIcon}
                enableDropShadow={chatSettings.enableDropShadow}
                headerTextColor={chatSettings.headerTextColor}
                actionButtons={chatSettings.actionButtons}
                inline={true}
                isPreview={true}
                initiallyOpen={false}
              />
            </div>
          </div>
        </div>
      )}

      {/* Mobile Chat Preview Modal */}
      {showMobilePreview && isMobile && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg w-full max-w-md max-h-[90vh] overflow-auto">{renderChatPreview()}</div>
        </div>
      )}

      {showIconCropper && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full">
            <ImageCropper onCrop={handleCroppedImage} onCancel={() => setShowIconCropper(false)} circular={true} />
          </div>
        </div>
      )}

      <AddUserModal
        isOpen={isAddUserModalOpen}
        onClose={() => setIsAddUserModalOpen(false)}
        campaignId={params.id}
        onAddUser={handleAddUser}
      />
    </div>
  )
}
