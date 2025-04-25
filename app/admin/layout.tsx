"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { LogOut, Users, Home, Shield, Building } from "lucide-react"
import Image from "next/image"

interface UserData {
  email: string
  id: string
  firstName: string
  lastName: string
  isSuperAdmin?: boolean
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const [user, setUser] = useState<UserData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Check if user is logged in and is a super admin
    const token = localStorage.getItem("token")
    const userData = localStorage.getItem("user")

    if (!token || !userData) {
      router.push("/login")
      return
    }

    try {
      const parsedUser = JSON.parse(userData)
      if (!parsedUser.isSuperAdmin) {
        router.push("/dashboard")
        return
      }
      setUser(parsedUser)
    } catch (error) {
      console.error("Error parsing user data:", error)
      router.push("/login")
    } finally {
      setLoading(false)
    }
  }, [router])

  const handleLogout = () => {
    localStorage.removeItem("token")
    localStorage.removeItem("user")
    router.push("/login")
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="bg-[#192745] text-white shadow-sm sticky top-0 z-10 h-16">
        <div className="w-full h-full px-4 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Link href="/admin" className="flex items-center">
              <div className="flex items-center">
                <div className="h-10 w-10 relative">
                  <Image
                    src="/images/logo-icon.png"
                    alt="Campaign Portal Logo"
                    width={40}
                    height={40}
                    className="h-10 w-10"
                    priority
                  />
                </div>
                <div className="hidden sm:block ml-4">
                  <Image
                    src="/images/logo-text.png"
                    alt="Campaign Portal Text"
                    width={240}
                    height={32}
                    className="h-8 w-auto"
                    priority
                  />
                </div>
              </div>
            </Link>
            <div className="flex items-center pl-4 border-l border-gray-700 ml-4">
              <Shield className="h-5 w-5 mr-2" />
              <span className="font-semibold">Super Admin</span>
            </div>
          </div>
          <div className="flex items-center space-x-4">
            <span className="text-sm">{user?.firstName ? `${user.firstName} ${user.lastName}` : user?.email}</span>
            <Button variant="ghost" size="sm" onClick={handleLogout} className="text-white hover:bg-gray-700">
              <LogOut className="h-4 w-4 mr-2" />
              Logout
            </Button>
          </div>
        </div>
      </header>

      {/* Main content */}
      <div className="flex-1 flex">
        {/* Sidebar */}
        <div className="w-64 bg-[#192745] text-white shadow-sm">
          <nav className="mt-8">
            <ul className="space-y-2 px-2">
              <li>
                <Link href="/admin" className="flex items-center px-4 py-3 text-sm rounded-md hover:bg-gray-700">
                  <Home className="h-4 w-4 mr-3" />
                  Dashboard
                </Link>
              </li>
              <li>
                <Link href="/admin/users" className="flex items-center px-4 py-3 text-sm rounded-md hover:bg-gray-700">
                  <Users className="h-4 w-4 mr-3" />
                  User Management
                </Link>
              </li>
              <li>
                <Link
                  href="/admin/organizations"
                  className="flex items-center px-4 py-3 text-sm rounded-md hover:bg-gray-700"
                >
                  <Building className="h-4 w-4 mr-3" />
                  Organizations
                </Link>
              </li>
              <li>
                <Link href="/dashboard" className="flex items-center px-4 py-3 text-sm rounded-md hover:bg-gray-700">
                  <Home className="h-4 w-4 mr-3" />
                  Return to Dashboard
                </Link>
              </li>
            </ul>
          </nav>
        </div>

        {/* Content */}
        <div className="flex-1 p-8 overflow-auto">{children}</div>
      </div>
    </div>
  )
}
