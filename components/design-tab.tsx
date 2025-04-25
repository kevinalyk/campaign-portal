"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { useToast } from "@/components/ui/use-toast"
import { useAuth } from "@/hooks/use-auth"
import { Skeleton } from "@/components/ui/skeleton"
import { ActionButtonsConfig } from "@/components/action-buttons-config"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm, Controller } from "react-hook-form"
import * as z from "zod"

interface DesignTabProps {
  campaignId: string
}

// Define the XSS check function
const containsXSSPatterns = (value: string): boolean => {
  if (!value) return false

  // Convert to lowercase for case-insensitive matching
  const lowerValue = value.toLowerCase()

  // Check for JavaScript protocol
  if (lowerValue.includes("javascript:")) return true

  // Check for HTML tags and event handlers
  if (/<[a-z][\s\S]*>/i.test(value)) return true
  if (/on\w+\s*=/i.test(value)) return true

  // Check for HTML encoded characters that might be used for XSS
  if (/&[#\w]+;/i.test(value)) return true

  return false
}

// Define the schema directly in this file to ensure it's used
const designSchema = z.object({
  chatBotName: z
    .string()
    .min(1, "Chat bot name is required")
    .max(50, "Chat bot name must be less than 50 characters")
    .refine((value) => !containsXSSPatterns(value), {
      message: "Chat bot name contains potentially unsafe content",
    }),
  chatWelcomeMessage: z
    .string()
    .min(1, "Welcome message is required")
    .max(200, "Welcome message must be less than 200 characters")
    .refine((value) => !containsXSSPatterns(value), {
      message: "Welcome message contains potentially unsafe content",
    }),
  chatColor: z.string().min(1, "Chat color is required"),
  accentColor: z.string().min(1, "Accent color is required"),
  chatBotIcon: z
    .string()
    .refine((value) => !value || !containsXSSPatterns(value), {
      message: "Chat bot icon URL contains potentially unsafe content",
    })
    .optional(),
  actionButtons: z.array(
    z.object({
      enabled: z.boolean(),
      type: z.string(),
      label: z
        .string()
        .min(1, "Button label is required")
        .max(50, "Button label must be less than 50 characters")
        .refine((value) => !containsXSSPatterns(value), {
          message: "Button label contains potentially unsafe content",
        }),
      textColor: z.string().optional(),
      icon: z
        .string()
        .max(10, "Icon must be less than 10 characters")
        .refine((value) => !value || !containsXSSPatterns(value), {
          message: "Icon contains potentially unsafe content",
        })
        .optional(),
    }),
  ),
})

type DesignFormValues = z.infer<typeof designSchema>

const DesignTab: React.FC<DesignTabProps> = ({ campaignId }) => {
  const { token } = useAuth()
  const { toast } = useToast()

  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)

  // Use the form with the schema
  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
    reset,
    control,
  } = useForm<DesignFormValues>({
    resolver: zodResolver(designSchema),
    defaultValues: {
      chatBotName: "Campaign Chat Support",
      chatWelcomeMessage: "Hello! Welcome to our campaign portal. How can I assist you today?",
      chatColor: "#FF0000",
      accentColor: "#192745",
      chatBotIcon: "",
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
    },
  })

  useEffect(() => {
    const fetchChatSettings = async () => {
      try {
        const response = await fetch(`/api/campaigns/${campaignId}`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        })

        if (!response.ok) {
          throw new Error("Failed to fetch campaign")
        }

        const data = await response.json()
        const campaign = data.campaign

        // Reset form with campaign data
        reset({
          chatBotName: campaign.chatBotName || "Campaign Chat Support",
          chatWelcomeMessage:
            campaign.chatWelcomeMessage || "Hello! Welcome to our campaign portal. How can I assist you today?",
          chatColor: campaign.chatColor || "#FF0000",
          accentColor: campaign.accentColor || "#192745",
          chatBotIcon: campaign.chatBotIcon || "",
          actionButtons: campaign.actionButtons || [
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
      } catch (error) {
        console.error("Error fetching chat settings:", error)
        toast({
          title: "Error",
          description: "Failed to fetch chat settings",
          variant: "destructive",
        })
      } finally {
        setIsLoading(false)
      }
    }

    fetchChatSettings()
  }, [campaignId, token, reset])

  // Form submission handler with validation
  const onSubmit = async (data: DesignFormValues) => {
    // Additional validation check before submission
    const hasXSS = Object.values(data).some((value) => {
      if (typeof value === "string") {
        return containsXSSPatterns(value)
      }
      return false
    })

    // Check action buttons for XSS
    const buttonsHaveXSS = data.actionButtons.some(
      (button) => containsXSSPatterns(button.label) || (button.icon && containsXSSPatterns(button.icon)),
    )

    if (hasXSS || buttonsHaveXSS) {
      toast({
        title: "Error",
        description: "Form contains potentially unsafe content",
        variant: "destructive",
      })
      return
    }

    setIsSaving(true)
    try {
      const response = await fetch(`/api/campaigns/${campaignId}/chat-settings`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(data),
      })

      if (!response.ok) {
        throw new Error("Failed to update chat settings")
      }

      toast({
        title: "Success",
        description: "Chat settings updated successfully",
      })
    } catch (error) {
      console.error("Error updating chat settings:", error)
      toast({
        title: "Error",
        description: "Failed to update chat settings",
        variant: "destructive",
      })
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-10 w-32" />
        <Skeleton className="h-10 w-32" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium mb-2">Chat Bot Name</h3>
        <Input type="text" {...register("chatBotName")} placeholder="Enter chat bot name" />
        {errors.chatBotName && <p className="text-sm text-red-500 mt-1">{errors.chatBotName.message}</p>}
        <p className="text-sm text-gray-500 mt-2">This name will be displayed in the chat widget.</p>
      </div>

      <div>
        <h3 className="text-lg font-medium mb-2">Welcome Message</h3>
        <Input type="text" {...register("chatWelcomeMessage")} placeholder="Enter welcome message" />
        {errors.chatWelcomeMessage && <p className="text-sm text-red-500 mt-1">{errors.chatWelcomeMessage.message}</p>}
        <p className="text-sm text-gray-500 mt-2">This message will be displayed when the chat is opened.</p>
      </div>

      <div>
        <h3 className="text-lg font-medium mb-2">Chat Color</h3>
        <div className="flex items-center space-x-2">
          <div className="h-10 w-10 rounded-md border" style={{ backgroundColor: watch("chatColor") }} />
          <Input type="text" {...register("chatColor")} className="w-32" />
          <Input type="color" {...register("chatColor")} className="h-10 w-10 cursor-pointer" />
        </div>
        {errors.chatColor && <p className="text-sm text-red-500 mt-1">{errors.chatColor.message}</p>}
        <p className="text-sm text-gray-500 mt-2">This color will be used for the chat bubble.</p>
      </div>

      <div>
        <h3 className="text-lg font-medium mb-2">Header Color</h3>
        <div className="flex items-center space-x-2">
          <div className="h-10 w-10 rounded-md border" style={{ backgroundColor: watch("accentColor") }} />
          <Input type="text" {...register("accentColor")} className="w-32" />
          <Input type="color" {...register("accentColor")} className="h-10 w-10 cursor-pointer" />
        </div>
        {errors.accentColor && <p className="text-sm text-red-500 mt-1">{errors.accentColor.message}</p>}
        <p className="text-sm text-gray-500 mt-2">
          This color will be used for the chat header and chat bubble when closed.
        </p>
      </div>

      <div>
        <h3 className="text-lg font-medium mb-2">Chat Bot Icon URL</h3>
        <Input type="text" {...register("chatBotIcon")} placeholder="Enter chat bot icon URL" />
        {errors.chatBotIcon && <p className="text-sm text-red-500 mt-1">{errors.chatBotIcon.message}</p>}
        <p className="text-sm text-gray-500 mt-2">This icon will be displayed in the chat widget.</p>
      </div>

      <div className="border-t pt-6 mt-6">
        <Controller
          name="actionButtons"
          control={control}
          render={({ field }) => (
            <ActionButtonsConfig
              buttons={field.value}
              onChange={(buttons) => {
                // Validate each button before setting
                const validButtons = buttons.map((button) => ({
                  ...button,
                  label: button.label ? button.label.replace(/<[^>]*>?/gm, "") : button.label, // Strip HTML
                  icon: button.icon ? button.icon.replace(/<[^>]*>?/gm, "") : button.icon, // Strip HTML
                }))
                field.onChange(validButtons)
              }}
            />
          )}
        />
        {errors.actionButtons && (
          <p className="text-sm text-red-500 mt-1">Action buttons contain potentially unsafe content</p>
        )}
      </div>

      <Button onClick={handleSubmit(onSubmit)} disabled={isSaving}>
        {isSaving ? "Saving..." : "Save Changes"}
      </Button>
    </div>
  )
}

export default DesignTab
