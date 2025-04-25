import mongoose from "mongoose"
import type { ObjectId } from "mongodb"

// Add these new types above the Campaign interface
export type ButtonActionType = "url" | "message"

export type ButtonType = "donate" | "contact" | "custom"

export type ButtonAction = {
  type: ButtonActionType
  content: string // URL or message text
}

export type ActionButton = {
  enabled: boolean
  type: ButtonType
  label: string
  textColor: string
  icon?: string // Optional icon
  action?: ButtonAction // Only needed for custom type
}

export interface Campaign {
  _id: ObjectId
  name: string
  url: string // This will be unique
  donationUrl: string
  websiteUrl: string // Required field for main campaign website
  description: string
  logoUrl?: string
  chatColor?: string
  accentColor?: string // New field for accent color
  chatWelcomeMessage?: string // Field for custom welcome message
  contactEmail?: string // New field for contact email
  contactPhone?: string // New field for contact phone
  contactAddress?: string // New field for mailing address
  chatBotName?: string // Field for custom chatbot name
  botTextColor?: string // New field for bot text color
  assistantIdentity?: string // New field for AI assistant identity
  chatBotIcon?: string // New field for chat bot icon
  enableDropShadow?: boolean // New field for enabling drop shadow on logo
  headerTextColor?: string // New field for header text color
  actionButtons?: ActionButton[] // New field for action buttons
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}

export interface CampaignInput {
  name: string
  url: string
  donationUrl: string
  websiteUrl: string // Required field for main campaign website
  description: string
  logoUrl?: string
  chatColor?: string
  accentColor?: string // New field for accent color
  chatWelcomeMessage?: string // Field for custom welcome message
  contactEmail?: string // New field for contact email
  contactPhone?: string // New field for contact phone
  contactAddress?: string // New field for mailing address
  chatBotName?: string // Field for custom chatbot name
  botTextColor?: string // New field for bot text color
  assistantIdentity?: string // New field for AI assistant identity
  chatBotIcon?: string // New field for chat bot icon
  enableDropShadow?: boolean // New field for enabling drop shadow on logo
  headerTextColor?: string // New field for header text color
  actionButtons?: ActionButton[] // New field for action buttons
  isActive?: boolean
}

// Define the Mongoose schema
const CampaignSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    url: { type: String, required: true, unique: true },
    donationUrl: { type: String, required: true },
    websiteUrl: { type: String, required: true },
    description: { type: String, required: true },
    logoUrl: { type: String },
    chatColor: { type: String, default: "#FF0000" },
    accentColor: { type: String, default: "#192745" }, // Default accent color
    chatWelcomeMessage: {
      type: String,
      default: "Hello! Welcome to our campaign portal. How can I assist you today?",
    },
    contactEmail: { type: String },
    contactPhone: { type: String },
    contactAddress: { type: String },
    chatBotName: { type: String, default: "Campaign Chat Support" },
    botTextColor: { type: String },
    assistantIdentity: { type: String },
    chatBotIcon: { type: String },
    enableDropShadow: { type: Boolean, default: false },
    headerTextColor: { type: String, default: "#FFFFFF" },
    actionButtons: {
      type: [
        {
          enabled: Boolean,
          type: String,
          label: String,
          textColor: String,
          icon: String,
          action: {
            type: { type: String },
            content: String,
          },
        },
      ],
      default: [
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
    isActive: { type: Boolean, default: true },
  },
  {
    timestamps: true,
  },
)

// Check if the model already exists to prevent overwriting
export default mongoose.models.Campaign || mongoose.model("Campaign", CampaignSchema)
