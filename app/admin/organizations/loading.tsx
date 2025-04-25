import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

export default function OrganizationsLoading() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-10 w-24" />
      </div>

      <div className="flex flex-col sm:flex-row gap-4">
        <Skeleton className="h-10 flex-1" />
        <Skeleton className="h-10 w-[180px]" />
      </div>

      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-64" />
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <div className="border-b">
              <div className="flex p-4">
                <Skeleton className="h-5 w-1/5" />
                <Skeleton className="h-5 w-1/5 ml-4" />
                <Skeleton className="h-5 w-1/5 ml-4" />
                <Skeleton className="h-5 w-1/5 ml-4" />
                <Skeleton className="h-5 w-1/5 ml-4" />
              </div>
            </div>
            <div>
              {Array(5)
                .fill(null)
                .map((_, index) => (
                  <div key={index} className="border-b p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex flex-1 items-center">
                        <Skeleton className="h-5 w-1/5" />
                        <Skeleton className="h-5 w-1/5 ml-4" />
                        <Skeleton className="h-5 w-20 ml-4" />
                        <Skeleton className="h-5 w-24 ml-4" />
                      </div>
                      <div className="flex space-x-2">
                        <Skeleton className="h-9 w-20" />
                        <Skeleton className="h-9 w-28" />
                        <Skeleton className="h-9 w-24" />
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
