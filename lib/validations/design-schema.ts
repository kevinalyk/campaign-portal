import * as z from "zod"

// Helper function to check for common XSS patterns
const containsXSSPatterns = (value: string): boolean => {
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

// Color validation regex (hex color)
const colorRegex = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/

// URL validation schema (reused from website schema)
const urlSchema = z
  .string()
  .url("Please enter a valid URL")
  .refine((value) => !containsXSSPatterns(value), {
    message: "URL contains potentially unsafe content",
  })
  .refine(
    (value) => {
      try {
        const url = new URL(value)
        return url.protocol === "http:" || url.protocol === "https:"
      } catch {
        return false
      }
    },
    {
      message: "URL must use http or https protocol",
    },
  )

// Button action schema
const buttonActionSchema = z.object({
  type: z.enum(["url", "message"]),
  content: z
    .string()
    .min(1, "Content is required")
    .max(500, "Content must be less than 500 characters")
    .refine((value) => !containsXSSPatterns(value), {
      message: "Content contains potentially unsafe content",
    }),
})

// Button schema
const buttonSchema = z.object({
  enabled: z.boolean(),
  type: z.enum(["donate", "contact", "custom"]),
  label: z
    .string()
    .min(1, "Button label is required")
    .max(50, "Button label must be less than 50 characters")
    .refine((value) => !containsXSSPatterns(value), {
      message: "Button label contains potentially unsafe content",
    }),
  textColor: z.string().regex(colorRegex, "Please enter a valid hex color code").optional(),
  icon: z
    .string()
    .max(10, "Icon must be less than 10 characters")
    .refine((value) => !value || !containsXSSPatterns(value), {
      message: "Icon contains potentially unsafe content",
    })
    .optional(),
  action: buttonActionSchema.optional(),
})

// Design settings schema
export const designSchema = z.object({
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
  chatColor: z.string().regex(colorRegex, "Please enter a valid hex color code"),
  accentColor: z.string().regex(colorRegex, "Please enter a valid hex color code"),
  chatBotIcon: z
    .string()
    .refine((value) => !value || !containsXSSPatterns(value), {
      message: "Chat bot icon URL contains potentially unsafe content",
    })
    .optional(),
  headerTextColor: z.string().regex(colorRegex, "Please enter a valid hex color code").optional(),
  actionButtons: z.array(buttonSchema).max(2, "Maximum 2 action buttons allowed"),
})

export type DesignFormValues = z.infer<typeof designSchema>
