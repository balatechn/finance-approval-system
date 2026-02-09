import { Card, CardContent, CardHeader } from "@/components/ui/card"

export default function RequestsLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Header skeleton */}
      <div className="flex items-center justify-between">
        <div>
          <div className="h-7 w-48 rounded bg-gray-200 mb-2" />
          <div className="h-4 w-64 rounded bg-gray-200" />
        </div>
        <div className="h-10 w-32 rounded bg-gray-200" />
      </div>

      {/* Search/filter skeleton */}
      <div className="flex gap-4">
        <div className="h-10 w-48 rounded bg-gray-200" />
        <div className="h-10 w-40 rounded bg-gray-200" />
        <div className="ml-auto h-10 w-20 rounded bg-gray-200" />
      </div>

      {/* Table skeleton */}
      <Card>
        <CardHeader>
          <div className="h-5 w-32 rounded bg-gray-200" />
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex gap-4 border-b pb-3">
              {["w-24", "flex-1", "w-24", "w-20", "w-20", "w-16", "w-12"].map((w, i) => (
                <div key={i} className={`h-4 ${w} rounded bg-gray-300`} />
              ))}
            </div>
            {[...Array(6)].map((_, i) => (
              <div key={i} className="flex gap-4 py-1">
                {["w-24", "flex-1", "w-24", "w-20", "w-20", "w-16", "w-12"].map((w, j) => (
                  <div key={j} className={`h-4 ${w} rounded bg-gray-200`} />
                ))}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
