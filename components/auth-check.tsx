"use client"

import type React from "react"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"

// This component checks if the user is authenticated on the client side
// It doesn't import any server-side modules
export default function AuthCheck({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const [isChecking, setIsChecking] = useState(true)

  useEffect(() => {
    // Check if we have user info in cookies
    const userInfoCookie = document.cookie.split("; ").find((row) => row.startsWith("user_info="))

    if (!userInfoCookie) {
      // No user info, redirect to login
      router.push("/login")
      return
    }

    setIsChecking(false)
  }, [router])

  if (isChecking) {
    return <div>Loading...</div>
  }

  return <>{children}</>
}
