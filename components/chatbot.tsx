"use client"
import { useState, useRef, useEffect, useCallback } from "react"
import type React from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { FeedbackBar } from "@/components/feedback-bar"

// Import the necessary icons
import { Send, X, Maximize2, Minimize2, DollarSign, Mail, Link, MessageSquare } from "lucide-react"

// Function to determine if a color is light or dark
const isLightColor = (hexColor: string): boolean => {
  // Remove the # if present
  const color = hexColor.charAt(0) === "#" ? hexColor.substring(1) : hexColor

  // Convert hex to RGB
  const r = Number.parseInt(color.substr(0, 2), 16) / 255
  const g = Number.parseInt(color.substr(2, 2), 16) / 255
  const b = Number.parseInt(color.substr(4, 2), 16) / 255

  // Calculate luminance (perceived brightness)
  // Using the formula: 0.299*R + 0.587*G + 0.114*B
  const luminance = 0.299 * r + 0.587 * g + 0.114 * b

  // Return true if the color is light (luminance > 0.5)
  return luminance > 0.5
}

// Function to sanitize input against XSS attacks
const sanitizeInput = (input: string): string => {
  if (!input) return input

  // Remove HTML tags
  let sanitized = input.replace(/<[^>]*>/g, "")

  // Remove potentially dangerous patterns
  sanitized = sanitized.replace(/javascript:/gi, "")
  sanitized = sanitized.replace(/data:/gi, "")
  sanitized = sanitized.replace(/vbscript:/gi, "")
  sanitized = sanitized.replace(/on\w+\s*=/gi, "")

  return sanitized
}

type DonationInfo = {
  firstname: string
  lastname: string
  email: string
  address: string
  zip: string
  city: string
  state: string
}

const emptyDonationInfo: DonationInfo = {
  firstname: "",
  lastname: "",
  email: "",
  address: "",
  zip: "",
  city: "",
  state: "",
}

const donationFields: (keyof DonationInfo)[] = ["firstname", "lastname", "email", "address", "zip", "city", "state"]

const fieldLabels: Record<keyof DonationInfo, string> = {
  firstname: "First Name",
  lastname: "Last Name",
  email: "Email",
  address: "Street Address",
  zip: "Zip Code",
  city: "City",
  state: "State (2 digit code)",
}

const validateField = (field: keyof DonationInfo, value: string): boolean => {
  switch (field) {
    case "email":
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
    case "state":
      // Update to accept both uppercase and lowercase 2-letter state codes
      return /^[A-Za-z]{2}$/.test(value)
    case "zip":
      return /^\d{5}(-\d{4})?$/.test(value)
    default:
      return value.trim() !== ""
  }
}

// Default donation URL if none is provided
const DEFAULT_DONATION_URL = "https://secure.winred.com/tom-emmer/emmer-for-congress"

// Typing indicator component
const TypingIndicator = () => {
  const [dots, setDots] = useState(".")

  useEffect(() => {
    const interval = setInterval(() => {
      setDots((prev) => {
        if (prev === ".") return ".."
        if (prev === "..") return "..."
        return "."
      })
    }, 500)

    return () => clearInterval(interval)
  }, [])

  return <span>{dots}</span>
}

// Generate a unique session ID
const generateSessionId = () => {
  return Date.now().toString(36) + Math.random().toString(36).substring(2)
}

// Get or create a session ID from localStorage
const getOrCreateSessionId = (campaignId: string) => {
  if (typeof window === "undefined") return null

  const storageKey = `chat_session_${campaignId}`
  let sessionId = localStorage.getItem(storageKey)

  if (!sessionId) {
    sessionId = generateSessionId()
    localStorage.setItem(storageKey, sessionId)
  }

  return sessionId
}

type ActionButtonType = "donate" | "contact" | "custom"

type ActionButtonAction = { type: "url"; content: string } | { type: "message"; content: string }

type ActionButton = {
  enabled: boolean
  type: ActionButtonType
  label: string
  textColor?: string
  icon?: string | React.ReactNode
  action?: ActionButtonAction
}

// Add actionButtons to the props interface
interface ChatbotProps {
  customColor?: string
  accentColor?: string
  donationUrl?: string
  isEmbedded?: boolean
  welcomeMessage?: string
  contactEmail?: string
  contactPhone?: string
  contactAddress?: string
  inline?: boolean
  botName?: string
  botTextColor?: string
  botIcon?: string
  isPreview?: boolean
  initiallyOpen?: boolean
  campaignId?: string
  enableDropShadow?: boolean
  headerTextColor?: string
  actionButtons?: ActionButton[] // Add this line
}

// Add a function to get the appropriate icon for a button
const getButtonIcon = (button: ActionButton) => {
  if (button.icon) return button.icon

  switch (button.type) {
    case "donate":
      return <DollarSign className="h-4 w-4" />
    case "contact":
      return <Mail className="h-4 w-4" />
    case "custom":
      return button.action?.type === "url" ? <Link className="h-4 w-4" /> : <MessageSquare className="h-4 w-4" />
    default:
      return null
  }
}

// Add actionButtons to the props destructuring
export function Chatbot({
  customColor = "#FF3B30",
  accentColor = "#192745",
  donationUrl = DEFAULT_DONATION_URL,
  isEmbedded = false,
  welcomeMessage = "Hello! Welcome to our organization portal. How can I assist you today?",
  contactEmail = "",
  contactPhone = "",
  contactAddress = "",
  inline = false,
  botName = "Campaign Chat Support",
  botTextColor = "#FFFFFF",
  botIcon = "",
  isPreview = false,
  initiallyOpen = false,
  campaignId = "",
  enableDropShadow = false,
  headerTextColor = "#FFFFFF",
  actionButtons = [
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
}: ChatbotProps) {
  // No debug logging for action buttons
  const [isOpen, setIsOpen] = useState(initiallyOpen || inline || isPreview)
  const [isExpanded, setIsExpanded] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const [messages, setMessages] = useState<
    Array<{ role: string; content: string; showButtons?: boolean; isTyping?: boolean }>
  >([])
  const [input, setInput] = useState("")
  const [donationInfo, setDonationInfo] = useState<DonationInfo>(emptyDonationInfo)
  const [currentDonationField, setCurrentDonationField] = useState<keyof DonationInfo | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const messagesContainerRef = useRef<HTMLDivElement>(null)
  const [showConfirmation, setShowConfirmation] = useState(false) // Fixed: Initialize with false, not showConfirmation
  const [isClosing, setIsClosing] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [showFeedbackBar, setShowFeedbackBar] = useState(false)
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false)
  const [firstMessageSent, setFirstMessageSent] = useState(false)
  const [isDonationProcessActive, setIsDonationProcessActive] = useState(false)

  // Initialize session ID from localStorage
  useEffect(() => {
    if (campaignId) {
      const storedSessionId = getOrCreateSessionId(campaignId)
      if (storedSessionId) {
        setSessionId(storedSessionId)
      }
    }
  }, [campaignId])

  const generateDonationLink = (info: DonationInfo): string => {
    const baseUrl = donationUrl
    const params = new URLSearchParams()
    Object.entries(info).forEach(([key, value]) => {
      params.append(key, value)
    })
    params.append("amount", "25.00")
    return `${baseUrl}?${params.toString().replace(/\+/g, "%20")}`
  }

  const scrollToBottom = useCallback(() => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight
    }
  }, [])

  const focusInput = useCallback(() => {
    if (inputRef.current) {
      inputRef.current.focus()
    }
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [messages, scrollToBottom])

  useEffect(() => {
    if (messages.length === 0) {
      // For preview mode, add a welcome message and a sample user message only
      if (isPreview) {
        setMessages([
          {
            role: "assistant",
            content: welcomeMessage,
            showButtons: false,
          },
          {
            role: "user",
            content: "I'd like to learn more about your organization.",
          },
        ])
      } else {
        // For normal mode, just add the welcome message
        setMessages([
          {
            role: "assistant",
            content: welcomeMessage,
            showButtons: false,
          },
        ])
      }
    }
  }, [messages, welcomeMessage, isPreview])

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768)
    }
    checkMobile()
    window.addEventListener("resize", checkMobile)
    return () => window.removeEventListener("resize", checkMobile)
  }, [])

  useEffect(() => {
    if (inline || isPreview) {
      setIsOpen(true)
      setIsClosing(false)
    }
  }, [inline, isPreview])

  // Timer to show feedback bar 30 seconds after first message
  useEffect(() => {
    if (firstMessageSent && !feedbackSubmitted && !showFeedbackBar) {
      const timer = setTimeout(() => {
        setShowFeedbackBar(true)
      }, 30000) // 30 seconds

      return () => clearTimeout(timer)
    }
  }, [firstMessageSent, feedbackSubmitted, showFeedbackBar])

  const handleFeedbackSubmit = async (rating: "positive" | "negative") => {
    setFeedbackSubmitted(true)
    setShowFeedbackBar(false)

    if (campaignId && sessionId) {
      try {
        await fetch(`/api/campaigns/${campaignId}/chat-feedback`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            sessionId,
            rating,
          }),
        })
      } catch (error) {
        console.error("Error submitting feedback:", error)
      }
    }
  }

  const handleSend = async () => {
    if (!input.trim() || isLoading) return

    // Sanitize the user input before processing
    const sanitizedInput = sanitizeInput(input.trim())

    // If the sanitized input is empty after sanitization, don't proceed
    if (!sanitizedInput) return

    const userMessage = sanitizedInput
    // Set firstMessageSent to true if this is the first message
    if (!firstMessageSent) {
      setFirstMessageSent(true)
    }
    setMessages((prev) => {
      const newMessages = [...prev, { role: "user", content: userMessage }]
      return newMessages
    })
    setInput("")
    setIsLoading(true)

    // Add typing indicator immediately
    setMessages((prev) => [...prev, { role: "assistant", content: "", isTyping: true }])

    // Focus back on the input field
    setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.focus()
      }
    }, 50)

    // Log the user message if we have a campaign ID
    if (campaignId) {
      try {
        // Get or create a session ID if we don't have one yet
        const currentSessionId = sessionId || getOrCreateSessionId(campaignId)
        if (!sessionId) {
          setSessionId(currentSessionId)
        }

        // Log the message
        await fetch(`/api/campaigns/${campaignId}/chat-logs`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            sessionId: currentSessionId,
            message: userMessage,
            role: "user",
          }),
        })
      } catch (error) {
        console.error("Error logging chat message:", error)
        // Continue with the chat even if logging fails
      }
    }

    if (currentDonationField) {
      // Add a small delay before processing the donation input
      await new Promise((resolve) => setTimeout(resolve, 800))
      // Remove typing indicator before adding the real response
      setMessages((prev) => prev.slice(0, -1))
      await handleDonationInput(userMessage)
    } else if (userMessage.toLowerCase().includes("donate")) {
      // Add a small delay before starting donation process
      await new Promise((resolve) => setTimeout(resolve, 800))
      // Remove typing indicator before adding the real response
      setMessages((prev) => prev.slice(0, -1))
      startDonationProcess()
    } else if (
      userMessage.toLowerCase().includes("contact") ||
      userMessage.toLowerCase().includes("email") ||
      userMessage.toLowerCase().includes("phone") ||
      userMessage.toLowerCase().includes("address")
    ) {
      // Handle contact information request directly
      await new Promise((resolve) => setTimeout(resolve, 800))
      setMessages((prev) => prev.slice(0, -1))
      handleContactInformation()
    } else {
      // For AI responses, we'll handle the typing indicator in the handleAIResponse function
      await handleAIResponse(userMessage)
    }

    // Always focus the input field after any message is sent
    setTimeout(focusInput, 100)

    setIsLoading(false)
  }

  const handleContactInformation = () => {
    const hasContactInfo = contactEmail || contactPhone || contactAddress

    let contactResponse = hasContactInfo
      ? "Here's how you can reach our organization:"
      : "I don't have specific contact information available at the moment. You can visit our organization's website for the most up-to-date contact details, or you can ask about donating or volunteering instead."

    if (hasContactInfo) {
      if (contactEmail) {
        contactResponse += `\n\nEmail: ${contactEmail}`
      }

      if (contactPhone) {
        contactResponse += `\n\nPhone: ${contactPhone}`
      }

      if (contactAddress) {
        contactResponse += `\n\nMailing Address:\n${contactAddress}`
      }
    }

    updateMessagesAndScroll({
      role: "assistant",
      content: contactResponse,
    })

    // Focus back on the input field
    setTimeout(focusInput, 100)
  }

  const handleAIResponse = async (userMessage: string) => {
    try {
      // Typing indicator is already added in handleSend

      // If in preview mode or no campaign ID, use hardcoded responses with a delay
      if (isPreview || !campaignId) {
        // Add a realistic typing delay (longer for longer responses)
        await new Promise((resolve) => setTimeout(resolve, 1200))

        // Remove typing indicator
        setMessages((prev) => prev.slice(0, -1))

        if (userMessage.toLowerCase().includes("volunteer")) {
          updateMessagesAndScroll({
            role: "assistant",
            content:
              "We're always looking for enthusiastic volunteers! You can sign up for various volunteer opportunities on our website. Whether you're interested in phone banking, canvassing, or helping with events, we have a place for you on our team.",
          })
        } else if (
          userMessage.toLowerCase().includes("contact") ||
          userMessage.toLowerCase().includes("email") ||
          userMessage.toLowerCase().includes("phone") ||
          userMessage.toLowerCase().includes("address")
        ) {
          handleContactInformation()
        } else {
          updateMessagesAndScroll({
            role: "assistant",
            content:
              "I'm here to help with information about donating, volunteering, or contacting our organization. Could you please clarify which of these you're interested in?",
            showButtons: false,
          })
        }

        // Focus back on the input field
        setTimeout(focusInput, 100)
        return
      }

      // Call the AI API
      const response = await fetch(`/api/campaigns/${campaignId}/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: userMessage,
          sessionId: sessionId || getOrCreateSessionId(campaignId),
        }),
      })

      if (!response.ok) {
        throw new Error("Failed to get AI response")
      }

      const data = await response.json()

      // Add a realistic typing delay (longer for longer responses)
      const typingDelay = Math.min(1000 + data.response.length / 10, 3000)
      await new Promise((resolve) => setTimeout(resolve, typingDelay))

      // Remove typing indicator
      setMessages((prev) => prev.slice(0, -1))

      // Add AI response
      updateMessagesAndScroll({
        role: "assistant",
        content: data.response,
        showButtons: false,
      })

      // Focus back on the input field
      setTimeout(focusInput, 100)

      // Log the AI response
      if (campaignId) {
        try {
          // Get the current session ID
          const currentSessionId = sessionId || getOrCreateSessionId(campaignId)

          await fetch(`/api/campaigns/${campaignId}/chat-logs`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              sessionId: currentSessionId,
              message: data.response,
              role: "assistant",
            }),
          })
        } catch (error) {
          console.error("Error logging AI response:", error)
          // Continue with the chat even if logging fails
        }
      }
    } catch (error) {
      console.error("Error getting AI response:", error)

      // Add a delay before showing error
      await new Promise((resolve) => setTimeout(resolve, 1000))

      // Remove typing indicator
      setMessages((prev) => prev.slice(0, -1))

      // Add error message
      updateMessagesAndScroll({
        role: "assistant",
        content: "I'm sorry, I encountered an error while processing your request. Please try again later.",
      })

      // Focus back on the input field
      setTimeout(focusInput, 100)
    }
  }

  const updateMessagesAndScroll = (newMessage: {
    role: string
    content: string
    showButtons?: boolean
    isTyping?: boolean
  }) => {
    setMessages((prev) => {
      const newMessages = [
        ...prev,
        { ...newMessage, showButtons: newMessage.showButtons || false, isTyping: newMessage.isTyping || false },
      ]
      return newMessages
    })
  }

  const startDonationProcess = () => {
    setIsDonationProcessActive(true)
    setDonationInfo(emptyDonationInfo)
    setCurrentDonationField("firstname")
    updateMessagesAndScroll({
      role: "assistant",
      content: `Great! Let's start the donation process. What's your ${fieldLabels.firstname}?`,
    })
  }

  // Find the handleDonationInput function and replace it with this improved version:
  const handleDonationInput = async (input: string) => {
    if (!currentDonationField) return

    // For state field, convert to uppercase before validation and saving
    const processedInput = currentDonationField === "state" ? input.toUpperCase() : input

    if (validateField(currentDonationField, processedInput)) {
      // Create the updated donation info object
      const updatedDonationInfo = {
        ...donationInfo,
        [currentDonationField]: processedInput,
      }

      // Update the state with the new donation info
      setDonationInfo(updatedDonationInfo)

      // Log the updated state for debugging
      if (currentDonationField === "state") {
        console.log("State set to:", processedInput)
      }

      const nextField = donationFields[donationFields.indexOf(currentDonationField) + 1]
      if (nextField) {
        setCurrentDonationField(nextField)
        updateMessagesAndScroll({ role: "assistant", content: `Thank you. What's your ${fieldLabels[nextField]}?` })
        // Focus back on the input field
        setTimeout(focusInput, 100)
      } else {
        // Use the updated donation info directly for confirmation
        confirmDonationInfo(updatedDonationInfo)
        // Focus back on the input field
        setTimeout(focusInput, 100)
      }
    } else {
      updateMessagesAndScroll({
        role: "assistant",
        content: `I'm sorry, that doesn't seem to be a valid ${fieldLabels[currentDonationField]}. Could you please try again?`,
      })
      // Focus back on the input field
      setTimeout(focusInput, 100)
    }
  }

  // Update the confirmDonationInfo function to accept the donation info as a parameter
  const confirmDonationInfo = (info = donationInfo) => {
    // Debug logs to see what's happening

    // Create a formatted message with all donation information
    // Using string concatenation instead of array join to ensure all fields are included
    const formattedInfo =
      "First Name: " +
      info.firstname +
      "\n" +
      "Last Name: " +
      info.lastname +
      "\n" +
      "Email: " +
      info.email +
      "\n" +
      "Street Address: " +
      info.address +
      "\n" +
      "Zip Code: " +
      info.zip +
      "\n" +
      "City: " +
      info.city +
      "\n" +
      "State (2 digit code): " +
      info.state // Explicitly include state

    updateMessagesAndScroll({
      role: "assistant",
      content: `Great! Here's the information you provided:

${formattedInfo}

Is this correct?`,
    })
    setCurrentDonationField(null)
    setShowConfirmation(true)
  }

  // Update the handleConfirmation function to ensure we're using the latest state
  const handleConfirmation = async (confirmed: boolean) => {
    setShowConfirmation(false)

    if (confirmed) {
      if (campaignId && sessionId) {
        try {
          // Log the donation info before sending

          // Update the person record with donation information
          const response = await fetch(`/api/campaigns/${campaignId}/people/${sessionId}`, {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
              "x-source": "chatbot",
            },
            body: JSON.stringify({
              firstName: donationInfo.firstname,
              lastName: donationInfo.lastname,
              email: donationInfo.email,
              address: donationInfo.address,
              city: donationInfo.city,
              state: donationInfo.state, // Make sure state is included
              zip: donationInfo.zip,
              isDonor: true,
            }),
          })

          // Log the response
          const responseData = await response.json()
        } catch (error) {
          console.error("Error updating person with donation info:", error)
          // Continue with donation process even if update fails
        }
      }
      const donationLink = generateDonationLink(donationInfo)
      updateMessagesAndScroll({
        role: "assistant",
        content: `Thank you for confirming! I'm opening the donation form pre-filled with your information.`,
      })

      setTimeout(() => {
        const newWindow = window.open(donationLink, "_blank")

        if (!newWindow || newWindow.closed || typeof newWindow.closed === "undefined") {
          updateMessagesAndScroll({
            role: "assistant",
            content: `It seems I couldn't open the donation form automatically. <a href="${donationLink}" target="_blank" rel="noopener noreferrer" class="text-blue-500 underline">Click here to open it</a>.`,
          })
        }

        setTimeout(() => {
          setIsDonationProcessActive(false)
          updateMessagesAndScroll({
            role: "assistant",
            content: "Is there anything else I can help you with?",
            showButtons: false,
          })
          // Focus back on the input field
          setTimeout(focusInput, 100)
        }, 1000)
      }, 100)
    } else {
      updateMessagesAndScroll({
        role: "assistant",
        content: "I understand. Let's start over with your information. What's your first name?",
      })
      setDonationInfo(emptyDonationInfo)
      setCurrentDonationField("firstname")
      // Focus back on the input field
      setTimeout(focusInput, 100)
      // Don't reset isDonationProcessActive here since we're starting over
    }
  }

  const handleQuickReply = async (message: string) => {
    // Sanitize the message
    const sanitizedMessage = sanitizeInput(message)

    // If the sanitized message is empty after sanitization, don't proceed
    if (!sanitizedMessage) return

    setMessages((prev) => {
      const newMessages = [
        ...prev.slice(0, -1),
        { ...prev[prev.length - 1], showButtons: false },
        { role: "user", content: sanitizedMessage },
      ]
      return newMessages
    })

    setIsLoading(true)

    // Add typing indicator immediately
    setMessages((prev) => [...prev, { role: "assistant", content: "", isTyping: true }])

    // Focus back on the input field
    setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.focus()
      }
    }, 50)

    // Add a small delay for all responses to feel natural
    await new Promise((resolve) => setTimeout(resolve, 800))

    // Remove typing indicator before adding the real response
    setMessages((prev) => prev.slice(0, -1))

    if (sanitizedMessage.toLowerCase().includes("donate")) {
      startDonationProcess()
    } else if (sanitizedMessage.toLowerCase().includes("contact")) {
      // Directly show contact information without using AI
      handleContactInformation()
    } else {
      // For other queries, use AI
      // Add typing indicator back for AI response
      setMessages((prev) => [...prev, { role: "assistant", content: "", isTyping: true }])
      await handleAIResponse(sanitizedMessage)
    }

    // Always focus the input field after any message is sent
    setTimeout(focusInput, 100)

    setIsLoading(false)
  }

  const toggleExpand = () => {
    if (isPreview) return

    setIsExpanded(!isExpanded)

    if (typeof window !== "undefined" && window.parent && window.parent !== window) {
      window.parent.postMessage(
        {
          type: "resize",
          expanded: !isExpanded,
        },
        "*",
      )
    }
  }

  const dropShadowStyle = enableDropShadow ? "drop-shadow(0 4px 6px rgba(0, 0, 0, 0.5))" : "none"

  // Function to handle action button clicks
  const handleActionButtonClick = (button: ActionButton) => {
    if (button.type === "donate") {
      startDonationProcess()
    } else if (button.type === "contact") {
      handleContactInformation()
    } else if (button.type === "custom") {
      if (button.action?.type === "url" && button.action.content) {
        window.open(button.action.content, "_blank")
      } else if (button.action?.type === "message" && button.action.content) {
        handleQuickReply(button.action.content)
      }
    }
  }

  // COMPONENT RENDERING
  return (
    <>
      {!isOpen && (
        <div className="fixed z-50 bottom-4 right-4 sm:bottom-8 sm:right-8">
          <Button
            onClick={() => {
              setIsOpen(true)
              setIsExpanded(false)
            }}
            className="rounded-full w-16 h-16 p-2 shadow-lg flex items-center justify-center"
            style={{ backgroundColor: accentColor }}
          >
            <img
              src={isLightColor(accentColor) ? "/images/logo-dark.png" : "/images/logo-light.png"}
              alt="Chat"
              className="w-10 h-10"
              style={{ filter: dropShadowStyle }}
            />
          </Button>
        </div>
      )}

      {isOpen && (
        <div className={`${inline ? "h-full w-full" : "fixed z-50 bottom-4 right-4 sm:bottom-8 sm:right-8"}`}>
          <div
            className={`bg-white rounded-lg shadow-xl border overflow-hidden ${
              isMobile && !inline ? "w-[calc(100vw-32px)] h-[80vh]" : isExpanded ? "w-96 h-[90vh]" : "w-96 h-[600px]"
            } ${isPreview ? "" : isClosing ? "chat-close-animation" : "chat-open-animation"} ${
              inline ? "w-full h-full" : ""
            }`}
          >
            {/* Header - Absolute position */}
            <div className="flex items-center justify-between p-3 text-white" style={{ backgroundColor: accentColor }}>
              <div className="flex items-center">
                <img
                  src={isLightColor(accentColor) ? "/images/logo-dark.png" : "/images/logo-light.png"}
                  alt="Campaign Portal"
                  className="w-6 h-6 mr-2"
                  style={{ filter: dropShadowStyle }}
                />
                <div className="font-bold" style={{ color: headerTextColor }}>
                  {botName}
                </div>
              </div>
              <div className="flex space-x-2">
                <Button
                  variant="ghost"
                  className="h-8 w-8 p-0 hover:bg-opacity-20"
                  style={{ color: headerTextColor }}
                  onClick={toggleExpand}
                >
                  {isExpanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
                </Button>
                <Button
                  variant="ghost"
                  className="h-8 w-8 p-0 hover:bg-opacity-20"
                  style={{ color: headerTextColor }}
                  onClick={() => {
                    if (isPreview) return
                    setIsClosing(true)
                    setTimeout(() => {
                      setIsOpen(false)
                      setIsExpanded(false)
                      setIsClosing(false)
                    }, 300)
                  }}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Main container with fixed height calculation */}
            <div className="flex flex-col h-[calc(100%-170px)]">
              {/* Messages Container - Scrollable */}
              <div ref={messagesContainerRef} className="flex-1 overflow-y-auto p-4">
                {messages.map((msg, index) => (
                  <div key={index} className="mb-4">
                    <div
                      className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"} ${
                        isPreview ? "" : "message-animation"
                      }`}
                    >
                      <div className={`flex items-end ${msg.role === "user" ? "flex-row-reverse" : "flex-row"}`}>
                        <Avatar className={`h-8 w-8 ${msg.role === "user" ? "ml-2" : "mr-2"}`}>
                          {msg.role === "assistant" && botIcon ? (
                            <AvatarImage src={botIcon || "/placeholder.svg"} alt="AI" className="object-cover" />
                          ) : null}
                          <AvatarFallback>{msg.role === "user" ? "U" : "AI"}</AvatarFallback>
                        </Avatar>
                        <div
                          className={`rounded-lg px-3 py-2 max-w-[80%] whitespace-pre-wrap ${
                            msg.role === "user" ? "text-white" : "bg-gray-100"
                          }`}
                          style={msg.role === "user" ? { backgroundColor: customColor } : {}}
                        >
                          {msg.isTyping ? (
                            <TypingIndicator />
                          ) : (
                            <span dangerouslySetInnerHTML={{ __html: msg.content }} />
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
                {showConfirmation && (
                  <div className="flex justify-center space-x-2 mt-4">
                    <Button
                      onClick={() => handleConfirmation(true)}
                      size="sm"
                      className="bg-green-500 hover:bg-green-600 text-white"
                    >
                      Yes
                    </Button>
                    <Button
                      onClick={() => handleConfirmation(false)}
                      size="sm"
                      className="text-white hover:bg-opacity-80"
                      style={{
                        backgroundColor: customColor,
                      }}
                    >
                      No
                    </Button>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            </div>

            {/* Feedback Bar */}
            {showFeedbackBar && !feedbackSubmitted && (
              <div className="absolute bottom-[110px] left-0 right-0 border-t border-b">
                <FeedbackBar
                  onSubmit={handleFeedbackSubmit}
                  onDismiss={() => setShowFeedbackBar(false)}
                  customColor={customColor}
                />
              </div>
            )}

            {/* Input Area - Fixed at bottom with explicit height */}
            <div className="border-t bg-white absolute bottom-0 left-0 right-0">
              {/* Action Buttons */}
              {actionButtons && actionButtons.some((button) => button.enabled) && (
                <div className="flex border-b">
                  {actionButtons
                    .filter((button) => button.enabled)
                    .map((button, index) => (
                      <button
                        key={index}
                        onClick={() => handleActionButtonClick(button)}
                        className={`flex items-center justify-center py-4 flex-1 hover:bg-gray-50 transition-colors ${
                          actionButtons.filter((b) => b.enabled).length === 1 ? "w-full" : ""
                        } ${isPreview ? "opacity-70 cursor-not-allowed" : ""} ${isDonationProcessActive ? "opacity-50 cursor-not-allowed" : ""}`}
                        disabled={isPreview || isDonationProcessActive}
                      >
                        <span className="mr-2">
                          {typeof getButtonIcon(button) === "string" ? getButtonIcon(button) : getButtonIcon(button)}
                        </span>
                        <span style={{ color: button.textColor || "#000000" }}>{button.label}</span>
                      </button>
                    ))}
                </div>
              )}

              {/* Input Form */}
              <div className="p-3 h-[60px]">
                <form
                  onSubmit={(e) => {
                    e.preventDefault()
                    handleSend()
                  }}
                  className="flex w-full items-center space-x-2"
                >
                  <Input
                    ref={inputRef}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder={isPreview ? "Input disabled in preview" : "Type your message..."}
                    className="flex-1"
                    disabled={isLoading || isPreview}
                    onFocus={() => {
                      setTimeout(scrollToBottom, 300)
                    }}
                  />
                  <Button
                    type="submit"
                    size="icon"
                    className="text-white hover:bg-opacity-80"
                    style={{
                      backgroundColor: customColor,
                    }}
                    disabled={isLoading}
                  >
                    <Send className="h-4 w-4 text-white" />
                    <span className="sr-only">Send</span>
                  </Button>
                </form>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
