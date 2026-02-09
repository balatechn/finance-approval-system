import { Card, CardContent, CardHeader } from "@/components/ui/card"

export default function ApprovalsLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div>
        <div className="h-7 w-48 rounded bg-gray-200 mb-2" />
        <div className="h-4 w-72 rounded bg-gray-200" />
      </div>

      <Card>
        <CardHeader>
          <div className="h-5 w-40 rounded bg-gray-200" />
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex gap-4 border-b pb-3">
              {["w-24", "flex-1", "w-24", "w-20", "w-20", "w-16"].map((w, i) => (
                <div key={i} className={`h-4 ${w} rounded bg-gray-300`} />
              ))}
            </div>
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex gap-4 py-1">
                {["w-24", "flex-1", "w-24", "w-20", "w-20", "w-16"].map((w, j) => (
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
