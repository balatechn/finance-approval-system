import { Card, CardContent, CardHeader } from "@/components/ui/card"

export default function DashboardLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Stats skeleton */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <div className="h-4 w-24 rounded bg-gray-200" />
              <div className="h-8 w-8 rounded bg-gray-200" />
            </CardHeader>
            <CardContent>
              <div className="h-7 w-20 rounded bg-gray-200 mb-1" />
              <div className="h-3 w-32 rounded bg-gray-200" />
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Table skeleton */}
      <Card>
        <CardHeader>
          <div className="h-5 w-40 rounded bg-gray-200" />
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex gap-4">
                <div className="h-4 w-28 rounded bg-gray-200" />
                <div className="h-4 flex-1 rounded bg-gray-200" />
                <div className="h-4 w-20 rounded bg-gray-200" />
                <div className="h-4 w-16 rounded bg-gray-200" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
