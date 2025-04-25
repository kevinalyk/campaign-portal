import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

export default function UserManagementLoading() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-10 w-24" />
      </div>

      <div className="flex flex-col sm:flex-row gap-4">
        <Skeleton className="h-10 flex-1" />
        <Skeleton className="h-10 w-[180px]" />
      </div>

      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent>
          <div className="rounded-md border p-4">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Skeleton className="h-5 w-full max-w-[100px]" />
                <Skeleton className="h-5 w-full max-w-[100px]" />
                <Skeleton className="h-5 w-full max-w-[80px]" />
                <Skeleton className="h-5 w-full max-w-[120px]" />
                <Skeleton className="h-5 w-full max-w-[120px]" />
                <Skeleton className="h-5 w-full max-w-[100px]" />
                <Skeleton className="h-5 w-full max-w-[150px]" />
              </div>

              {/* Skeleton rows for users */}
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center justify-between pt-4">
                  <Skeleton className="h-5 w-full max-w-[180px]" />
                  <Skeleton className="h-5 w-full max-w-[120px]" />
                  <Skeleton className="h-5 w-full max-w-[60px]" />
                  <Skeleton className="h-5 w-full max-w-[100px]" />
                  <Skeleton className="h-5 w-full max-w-[100px]" />
                  <Skeleton className="h-5 w-full max-w-[60px]" />
                  <div className="flex space-x-2">
                    <Skeleton className="h-8 w-20" />
                    <Skeleton className="h-8 w-24" />
                    <Skeleton className="h-8 w-20" />
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
