import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-white/20",
  {
    variants: {
      variant: {
        default:
          "border-white/20 bg-white/[0.15] text-white backdrop-blur-sm",
        secondary:
          "border-white/10 bg-white/[0.08] text-white/80 backdrop-blur-sm",
        destructive:
          "border-red-400/30 bg-red-500/20 text-red-300 backdrop-blur-sm",
        outline: "text-white/80 border-white/20",
        success:
          "border-emerald-400/30 bg-emerald-500/20 text-emerald-300 backdrop-blur-sm",
        warning:
          "border-amber-400/30 bg-amber-500/20 text-amber-300 backdrop-blur-sm",
        info:
          "border-blue-400/30 bg-blue-500/20 text-blue-300 backdrop-blur-sm",
        pending:
          "border-yellow-400/30 bg-yellow-500/20 text-yellow-300 backdrop-blur-sm",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}

export { Badge, badgeVariants }
