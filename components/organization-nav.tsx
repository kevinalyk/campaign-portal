"use client"

import type React from "react"
import { usePathname, useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { cn } from "@/lib/utils"
import { Info, Users, FileText, Globe, Code, Palette, Settings, Clock, BarChart, UserCircle } from "lucide-react"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

interface OrganizationNavProps {
  organizationId: string
  onTabChange?: (tab: string) => void
}

export function OrganizationNav({ organizationId, onTabChange }: OrganizationNavProps) {
  const pathname = usePathname()
  const router = useRouter()

  // State to track the active tab
  const [activeTab, setActiveTab] = useState("details")

  // Get the current tab from the hash if available
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

  const navItems = [
    {
      title: "Details",
      value: "details",
      icon: Info,
      description: "View and edit basic campaign information and settings",
    },
    {
      title: "Users",
      value: "users",
      icon: Users,
      description: "Manage team members who have access to this campaign",
    },
    {
      title: "People",
      value: "people",
      icon: UserCircle,
      description:
        "Track visitors who interact with your chatbot, including donor status, interaction history, and contact information",
    },
    {
      title: "Documents",
      value: "documents",
      icon: FileText,
      description: "Upload and manage campaign documents and files",
    },
    {
      title: "Website",
      value: "website",
      icon: Globe,
      description: "Add website URLs for crawling and knowledge base creation",
    },
    {
      title: "Design",
      value: "design",
      icon: Palette,
      description: "Customize the appearance and branding of your chatbot",
    },
    {
      title: "Embed Code",
      value: "embed",
      icon: Code,
      description: "Get code to embed your chatbot on your website",
    },
    {
      title: "Activity",
      value: "activity",
      icon: Clock,
      description: "View recent activity and changes to your campaign",
    },
    {
      title: "Reporting",
      value: "logs",
      icon: BarChart,
      description: "Access analytics and chat logs for your campaign",
    },
    {
      title: "Settings",
      value: "settings",
      icon: Settings,
      description: "Configure campaign settings and preferences",
    },
  ]

  const handleNavClick = (e: React.MouseEvent<HTMLAnchorElement>, value: string) => {
    e.preventDefault()

    // Update the active tab state
    setActiveTab(value)

    // Update the URL hash
    window.location.hash = value

    // If onTabChange is provided, call it
    if (onTabChange) {
      onTabChange(value)
    }

    // If we're not on the campaign detail page, navigate to it
    if (!pathname.includes(`/dashboard/campaigns/${organizationId}`)) {
      router.push(`/dashboard/campaigns/${organizationId}#${value}`)
    }
  }

  return (
    <TooltipProvider>
      <nav className="space-y-1 px-2 py-4">
        {navItems.map((item) => {
          const isActive = activeTab === item.value

          return (
            <Tooltip key={item.value} delayDuration={300}>
              <TooltipTrigger asChild>
                <a
                  href={`#${item.value}`}
                  onClick={(e) => handleNavClick(e, item.value)}
                  className={cn(
                    "flex items-center px-3 py-2 text-sm rounded-md group cursor-pointer",
                    isActive ? "bg-blue-50 text-blue-700 font-medium" : "text-gray-700 hover:bg-gray-100",
                  )}
                >
                  <item.icon
                    className={cn(
                      "h-4 w-4 mr-3 flex-shrink-0",
                      isActive ? "text-blue-700" : "text-gray-500 group-hover:text-gray-600",
                    )}
                  />
                  {item.title}
                </a>
              </TooltipTrigger>
              <TooltipContent side="right" className="max-w-[200px] text-sm">
                {item.description}
              </TooltipContent>
            </Tooltip>
          )
        })}
      </nav>
    </TooltipProvider>
  )
}
