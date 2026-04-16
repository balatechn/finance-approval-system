"use client"

import { Badge } from "@/components/ui/badge"

interface StatusBadgeProps {
  status: string
  className?: string
}

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" | "success" | "warning" | "info" | "pending" }> = {
  DRAFT: { label: "Draft", variant: "secondary" },
  SUBMITTED: { label: "Submitted", variant: "info" },
  PENDING_FINANCE_VETTING: { label: "Pending Vetting", variant: "pending" },
  PENDING_FINANCE_PLANNER: { label: "Pending Finance Planner", variant: "pending" },
  PENDING_FINANCE_CONTROLLER: { label: "Pending Finance Controller", variant: "pending" },
  PENDING_DIRECTOR: { label: "Pending Director", variant: "pending" },
  PENDING_MD: { label: "Pending MD", variant: "pending" },
  PENDING_ADMIN_REVIEW: { label: "Admin Review Required", variant: "destructive" },
  APPROVED: { label: "Approved", variant: "success" },
  DISBURSED: { label: "Disbursed", variant: "success" },
  EXPENSE_APPROVED: { label: "Expense Approved", variant: "success" },
  REJECTED: { label: "Rejected", variant: "destructive" },
  SENT_BACK: { label: "Sent Back", variant: "warning" },
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = statusConfig[status] || { label: status, variant: "default" as const }
  
  return (
    <Badge variant={config.variant} className={className}>
      {config.label}
    </Badge>
  )
}

interface ApprovalLevelBadgeProps {
  level: string
  className?: string
}

const levelConfig: Record<string, { label: string; color: string }> = {
  FINANCE_VETTING: { label: "Finance Vetting", color: "bg-orange-500/20 text-orange-300" },
  FINANCE_PLANNER: { label: "Finance Planner", color: "bg-cyan-500/20 text-cyan-300" },
  FINANCE_CONTROLLER: { label: "Finance Controller", color: "bg-blue-500/20 text-blue-300" },
  FINANCE_COORDINATOR: { label: "Finance Co-Ordinator", color: "bg-teal-500/20 text-teal-300" },
  DIRECTOR: { label: "Director", color: "bg-purple-500/20 text-purple-300" },
  MD: { label: "Managing Director", color: "bg-indigo-500/20 text-indigo-300" },
  ADMIN: { label: "Admin Review", color: "bg-red-500/20 text-red-300" },
  DISBURSEMENT: { label: "Disbursement", color: "bg-emerald-500/20 text-emerald-300" },
}

export function ApprovalLevelBadge({ level, className }: ApprovalLevelBadgeProps) {
  const config = levelConfig[level] || { label: level, color: "bg-white/[0.06] text-white" }
  
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${config.color} ${className || ""}`}>
      {config.label}
    </span>
  )
}
