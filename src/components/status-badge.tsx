"use client"

import { Badge } from "@/components/ui/badge"

interface StatusBadgeProps {
  status: string
  className?: string
}

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" | "success" | "warning" | "info" | "pending" }> = {
  DRAFT: { label: "Draft", variant: "secondary" },
  SUBMITTED: { label: "Submitted", variant: "info" },
  PENDING_MANAGER: { label: "Pending Manager", variant: "pending" },
  PENDING_HOD: { label: "Pending HOD", variant: "pending" },
  PENDING_FINANCE_VETTING: { label: "Pending Vetting", variant: "pending" },
  PENDING_FINANCE_APPROVAL: { label: "Pending Approval", variant: "pending" },
  APPROVED: { label: "Approved", variant: "success" },
  DISBURSED: { label: "Disbursed", variant: "success" },
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
  MANAGER: { label: "Manager", color: "bg-blue-100 text-blue-800" },
  DEPARTMENT_HEAD: { label: "Department Head", color: "bg-purple-100 text-purple-800" },
  HOD: { label: "Department Head", color: "bg-purple-100 text-purple-800" },
  FINANCE_VETTING: { label: "Finance Vetting", color: "bg-orange-100 text-orange-800" },
  FINANCE_APPROVAL: { label: "Finance Approval", color: "bg-indigo-100 text-indigo-800" },
  DISBURSEMENT: { label: "Disbursement", color: "bg-green-100 text-green-800" },
}

export function ApprovalLevelBadge({ level, className }: ApprovalLevelBadgeProps) {
  const config = levelConfig[level] || { label: level, color: "bg-gray-100 text-gray-800" }
  
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${config.color} ${className || ""}`}>
      {config.label}
    </span>
  )
}
