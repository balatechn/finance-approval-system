import { Card, CardContent, CardHeader } from "@/components/ui/card"

export default function UsersLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="flex items-center justify-between">
        <div>
          <div className="h-7 w-40 rounded bg-gray-200 mb-2" />
          <div className="h-4 w-56 rounded bg-gray-200" />
        </div>
        <div className="h-10 w-28 rounded bg-gray-200" />
      </div>

      <Card>
        <CardHeader>
          <div className="flex gap-4">
            <div className="h-10 w-48 rounded bg-gray-200" />
            <div className="h-10 w-32 rounded bg-gray-200" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="flex gap-4 items-center">
                <div className="h-8 w-8 rounded-full bg-gray-200" />
                <div className="h-4 w-32 rounded bg-gray-200" />
                <div className="h-4 flex-1 rounded bg-gray-200" />
                <div className="h-4 w-24 rounded bg-gray-200" />
                <div className="h-6 w-16 rounded bg-gray-200" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
