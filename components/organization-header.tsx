import Link from "next/link"
import { Button } from "@/components/ui/button"
import { ArrowLeft, Pencil, Trash2 } from "lucide-react"

interface OrganizationHeaderProps {
  organizationId: string
  organizationName: string
  createdDate?: string
}

export function OrganizationHeader({ organizationId, organizationName, createdDate }: OrganizationHeaderProps) {
  return (
    <div className="mb-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4">
        <div className="flex items-center mb-4 sm:mb-0">
          <Link href="/dashboard/campaigns" className="mr-4">
            <Button variant="ghost" size="sm" className="gap-1 text-gray-600">
              <ArrowLeft className="h-4 w-4" />
              <span className="hidden sm:inline">Back to Organizations</span>
              <span className="sm:hidden">Back</span>
            </Button>
          </Link>
        </div>

        <div className="flex gap-2">
          <Link href={`/dashboard/campaigns/${organizationId}/edit`}>
            <Button variant="outline" size="sm" className="gap-1">
              <Pencil className="h-4 w-4" />
              <span>Edit Organization</span>
            </Button>
          </Link>

          <Button variant="outline" size="sm" className="gap-1 text-red-600 border-red-200 hover:bg-red-50">
            <Trash2 className="h-4 w-4" />
            <span>Delete</span>
          </Button>
        </div>
      </div>

      <div className="mb-6">
        <h1 className="text-2xl font-bold">{organizationName}</h1>
        {createdDate && <p className="text-sm text-gray-500">Created on {createdDate}</p>}
      </div>
    </div>
  )
}
