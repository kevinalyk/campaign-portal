"use client"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

type ActionButtonType = "donate" | "contact" | "custom"

type ActionButtonAction = { type: "url"; content: string } | { type: "message"; content: string }

type ActionButton = {
  enabled: boolean
  type: ActionButtonType
  label: string
  textColor?: string
  icon?: string
  action?: ActionButtonAction
}

interface ActionButtonsConfigProps {
  buttons: ActionButton[]
  onChange: (buttons: ActionButton[]) => void
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

export function ActionButtonsConfig({ buttons, onChange }: ActionButtonsConfigProps) {
  const updateButton = (index: number, updates: Partial<ActionButton>) => {
    const newButtons = [...buttons]
    newButtons[index] = { ...newButtons[index], ...updates }
    onChange(newButtons)
  }

  const handleTypeChange = (index: number, type: ActionButtonType) => {
    const updates: Partial<ActionButton> = { type }

    // Set default values based on type
    if (type === "donate") {
      updates.label = "Donate"
      updates.icon = "$"
      updates.action = undefined
    } else if (type === "contact") {
      updates.label = "Contact"
      updates.icon = "✉️"
      updates.action = undefined
    } else if (type === "custom") {
      // For custom type, remove the default icon
      updates.icon = undefined
      updates.action = { type: "url", content: "" }
    }

    updateButton(index, updates)
  }

  const handleActionTypeChange = (index: number, actionType: "url" | "message") => {
    const button = buttons[index]
    if (button.type === "custom") {
      updateButton(index, {
        action: { type: actionType, content: "" },
      })
    }
  }

  const handleActionContentChange = (index: number, content: string) => {
    const button = buttons[index]
    if (button.type === "custom" && button.action) {
      // Sanitize the content before updating
      const sanitizedContent = sanitizeText(content)

      updateButton(index, {
        action: {
          type: button.action.type,
          content: sanitizedContent,
        },
      })
    }
  }

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-medium">Action Buttons</h3>
      <p className="text-sm text-gray-500">
        Configure up to two buttons that appear at the bottom of the chat interface.
      </p>

      {buttons.map((button, index) => (
        <div key={index} className="border rounded-md p-4 space-y-4">
          <div className="flex items-center justify-between">
            <Label htmlFor={`button-${index}-enabled`}>Button {index + 1}</Label>
            <Switch
              id={`button-${index}-enabled`}
              checked={button.enabled}
              onCheckedChange={(checked) => updateButton(index, { enabled: checked })}
            />
          </div>

          {button.enabled && (
            <>
              <div className="space-y-2">
                <Label htmlFor={`button-${index}-type`}>Button Type</Label>
                <Select value={button.type} onValueChange={(value: ActionButtonType) => handleTypeChange(index, value)}>
                  <SelectTrigger id={`button-${index}-type`}>
                    <SelectValue placeholder="Select button type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="donate">Donate</SelectItem>
                    <SelectItem value="contact">Contact</SelectItem>
                    <SelectItem value="custom">Custom</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-gray-500">
                  {button.type === "donate"
                    ? "Starts the donation flow when clicked."
                    : button.type === "contact"
                      ? "Shows contact information when clicked."
                      : "Custom action when clicked."}
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor={`button-${index}-label`}>Button Label</Label>
                <Input
                  id={`button-${index}-label`}
                  value={button.label}
                  onChange={(e) => updateButton(index, { label: sanitizeText(e.target.value) })}
                  placeholder="Enter button label"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor={`button-${index}-color`}>Text Color</Label>
                <div className="flex items-center space-x-2">
                  <Input
                    id={`button-${index}-color`}
                    type="text"
                    value={button.textColor || "#000000"}
                    onChange={(e) => updateButton(index, { textColor: e.target.value })}
                    className="flex-1"
                  />
                  <Input
                    type="color"
                    value={button.textColor || "#000000"}
                    onChange={(e) => updateButton(index, { textColor: e.target.value })}
                    className="w-12 h-10 p-1 cursor-pointer"
                    aria-label="Color picker"
                  />
                </div>
              </div>

              {button.type === "custom" && (
                <>
                  <div className="space-y-2">
                    <Label>Action Type</Label>
                    <RadioGroup
                      value={button.action?.type || "url"}
                      onValueChange={(value: "url" | "message") => handleActionTypeChange(index, value)}
                      className="flex flex-col space-y-1"
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="url" id={`button-${index}-action-url`} />
                        <Label htmlFor={`button-${index}-action-url`}>Open URL</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="message" id={`button-${index}-action-message`} />
                        <Label htmlFor={`button-${index}-action-message`}>Send Message</Label>
                      </div>
                    </RadioGroup>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor={`button-${index}-action-content`}>
                      {button.action?.type === "url" ? "URL" : "Message"}
                    </Label>
                    <Input
                      id={`button-${index}-action-content`}
                      value={button.action?.content || ""}
                      onChange={(e) => handleActionContentChange(index, e.target.value)}
                      placeholder={button.action?.type === "url" ? "https://example.com" : "Enter message to send"}
                    />
                    <p className="text-xs text-gray-500">
                      {button.action?.type === "url"
                        ? "The URL will open in a new tab when the button is clicked."
                        : "This message will be sent to the chatbot when the button is clicked."}
                    </p>
                  </div>
                </>
              )}
            </>
          )}
        </div>
      ))}
    </div>
  )
}
