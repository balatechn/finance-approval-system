import { Card, CardContent, CardHeader } from "@/components/ui/card"

export default function ReportsLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div>
        <div className="h-7 w-32 rounded bg-gray-200 mb-2" />
        <div className="h-4 w-56 rounded bg-gray-200" />
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i}>
            <CardHeader className="pb-2">
              <div className="h-4 w-24 rounded bg-gray-200" />
            </CardHeader>
            <CardContent>
              <div className="h-7 w-16 rounded bg-gray-200" />
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <div className="h-5 w-40 rounded bg-gray-200" />
        </CardHeader>
        <CardContent>
          <div className="h-64 rounded bg-gray-200" />
        </CardContent>
      </Card>
    </div>
  )
}
