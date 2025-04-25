"use server"

import { GoogleSpreadsheet } from "google-spreadsheet"
import { JWT } from "google-auth-library"
import { signUpSchema } from "@/lib/validations/sign-up-schema"

function getFormattedKey(key: string): string {
  // Remove any whitespace and replace "\n" with actual newlines
  const formattedKey = key.replace(/\\n/g, "\n").trim()

  // Ensure the key has the correct header and footer
  if (!formattedKey.startsWith("-----BEGIN PRIVATE KEY-----")) {
    return `-----BEGIN PRIVATE KEY-----\n${formattedKey}\n-----END PRIVATE KEY-----`
  }

  return formattedKey
}

export async function saveToGoogleSheets(formData: FormData) {
  try {
    // Extract form data
    const firstName = formData.get("firstName") as string
    const lastName = formData.get("lastName") as string
    const email = formData.get("email") as string
    const campaign = (formData.get("campaign") as string) || ""
    const termsAccepted = formData.get("terms") ? "Yes" : "No"

    // Server-side validation
    const validationResult = signUpSchema.safeParse({
      firstName,
      lastName,
      email,
      campaign,
      terms: termsAccepted === "Yes",
    })

    if (!validationResult.success) {
      console.error("Validation error:", validationResult.error)
      throw new Error("Invalid form data")
    }

    // Additional sanitization for campaign field
    const sanitizedCampaign = campaign ? campaign.replace(/[;:'"\\]/g, "") : "N/A"

    const timestamp = new Date().toISOString()

    const privateKey = getFormattedKey(process.env.GOOGLE_SHEETS_PRIVATE_KEY || "")

    if (!process.env.GOOGLE_SHEETS_CLIENT_EMAIL || !process.env.GOOGLE_SHEETS_SHEET_ID) {
      throw new Error("Missing Google Sheets configuration")
    }

    // Initialize auth
    const serviceAccountAuth = new JWT({
      email: process.env.GOOGLE_SHEETS_CLIENT_EMAIL,
      key: privateKey,
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    })

    // Initialize the sheet
    const doc = new GoogleSpreadsheet(process.env.GOOGLE_SHEETS_SHEET_ID, serviceAccountAuth)

    // Load the document properties and sheets
    await doc.loadInfo()

    // Get the first sheet
    let sheet = doc.sheetsByIndex[0]

    // If no sheet exists, create one with headers
    if (!sheet) {
      sheet = await doc.addSheet({
        title: "Email Signups",
        headerValues: ["Timestamp", "First Name", "Last Name", "Email", "Campaign", "Terms Accepted"],
      })
    }

    // Add the row
    const newRow = await sheet.addRow({
      Timestamp: timestamp,
      "First Name": firstName,
      "Last Name": lastName,
      Email: email,
      Campaign: sanitizedCampaign,
      "Terms Accepted": termsAccepted,
    })

    return { success: true }
  } catch (error) {
    console.error("Google Sheets error:", error)
    throw new Error("Failed to save data to Google Sheets")
  }
}
