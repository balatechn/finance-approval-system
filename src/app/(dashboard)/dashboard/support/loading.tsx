import { Loader2 } from "lucide-react"

export default function SupportLoading() {
  return (
    <div className="h-[calc(100vh-120px)] flex items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
    </div>
  )
}
