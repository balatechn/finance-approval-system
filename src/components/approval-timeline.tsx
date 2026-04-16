"use client"

import { Check, Clock, X, AlertCircle, ArrowLeft } from "lucide-react"
import { cn } from "@/lib/utils"
import { formatDateTime } from "@/lib/utils"

interface ApprovalStep {
  id: string
  level: string
  status: string
  approverName?: string | null
  completedAt?: string | Date | null
  comments?: string | null
  isOverdue?: boolean
  slaHours?: number
}

interface ApprovalTimelineProps {
  steps: ApprovalStep[]
  currentLevel?: string | null
  requestType?: string | null
  className?: string
}

const levelOrder = [
  "FINANCE_VETTING",
  "FINANCE_PLANNER",
  "FINANCE_CONTROLLER",
  "FINANCE_COORDINATOR",
  "DIRECTOR",
  "MD",
  "DISBURSEMENT",
] as const

const levelLabels: Record<string, string> = {
  FINANCE_VETTING: "Finance Vetting",
  FINANCE_PLANNER: "Finance Planner",
  FINANCE_CONTROLLER: "Finance Controller",
  FINANCE_COORDINATOR: "Finance Co-Ordinator",
  DIRECTOR: "Director",
  MD: "Managing Director",
  DISBURSEMENT: "Disbursement",
}

export function ApprovalTimeline({ steps, currentLevel, requestType, className }: ApprovalTimelineProps) {
  const stepsMap = new Map(steps.map(s => [s.level, s]))

  // Hide DISBURSEMENT step for expense approval requests
  const displayLevels = requestType === "EXPENSE_APPROVAL"
    ? levelOrder.filter(l => l !== "DISBURSEMENT")
    : levelOrder

  return (
    <div className={cn("relative", className)}>
      <div className="space-y-6">
        {displayLevels.map((level, index) => {
          const step = stepsMap.get(level)
          const isCompleted = step?.status === "APPROVED"
          const isRejected = step?.status === "REJECTED"
          const isSentBack = step?.status === "SENT_BACK"
          const isCurrent = level === currentLevel
          const isPending = step?.status === "PENDING"
          const isOverdue = step?.isOverdue

          return (
            <div key={level} className="relative flex gap-4">
              {/* Connector line */}
              {index < displayLevels.length - 1 && (
                <div
                  className={cn(
                    "absolute left-4 top-8 h-full w-0.5 -translate-x-1/2",
                    isCompleted ? "bg-emerald-500/100" : "bg-white/[0.1]"
                  )}
                />
              )}

              {/* Status icon */}
              <div
                className={cn(
                  "relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2",
                  isCompleted && "border-green-500 bg-emerald-500/100 text-white",
                  isRejected && "border-red-500 bg-red-500/100 text-white",
                  isSentBack && "border-amber-500 bg-amber-500/100 text-white",
                  isCurrent && isPending && "border-blue-500 bg-blue-500/10 text-blue-500",
                  isCurrent && isPending && isOverdue && "border-red-500 bg-red-500/10 text-red-400",
                  !step && "border-white/[0.1] bg-white/[0.04] text-white/40",
                  isPending && !isCurrent && "border-white/[0.1] bg-white/[0.04] text-white/40"
                )}
              >
                {isCompleted && <Check className="h-4 w-4" />}
                {isRejected && <X className="h-4 w-4" />}
                {isSentBack && <ArrowLeft className="h-4 w-4" />}
                {isCurrent && isPending && !isOverdue && <Clock className="h-4 w-4" />}
                {isCurrent && isPending && isOverdue && <AlertCircle className="h-4 w-4" />}
                {(!step || (isPending && !isCurrent)) && (
                  <span className="text-xs font-medium">{index + 1}</span>
                )}
              </div>

              {/* Content */}
              <div className="flex-1 pb-6">
                <div className="flex items-center justify-between">
                  <h4
                    className={cn(
                      "font-medium",
                      isCompleted && "text-emerald-300",
                      isRejected && "text-red-300",
                      isSentBack && "text-amber-300",
                      isCurrent && isPending && "text-blue-300",
                      (!step || (isPending && !isCurrent)) && "text-white/50"
                    )}
                  >
                    {levelLabels[level]}
                  </h4>
                  {step?.slaHours && isPending && (
                    <span
                      className={cn(
                        "text-xs",
                        isOverdue ? "text-red-400" : "text-white/50"
                      )}
                    >
                      SLA: {step.slaHours}h
                    </span>
                  )}
                </div>

                {step?.approverName && (
                  <p className="mt-1 text-sm text-white/60">
                    {isCompleted && "Approved by "}
                    {isRejected && "Rejected by "}
                    {isSentBack && "Sent back by "}
                    <span className="font-medium">{step.approverName}</span>
                  </p>
                )}

                {step?.completedAt && (
                  <p className="mt-0.5 text-xs text-white/50">
                    {formatDateTime(step.completedAt)}
                  </p>
                )}

                {step?.comments && (
                  <div className="mt-2 rounded-md bg-white/[0.04] p-3 text-sm text-white/60">
                    <p className="font-medium text-white/80">Comments:</p>
                    <p className="mt-1">{step.comments}</p>
                  </div>
                )}

                {isCurrent && isPending && isOverdue && (
                  <div className="mt-2 flex items-center gap-1 text-sm text-red-400">
                    <AlertCircle className="h-4 w-4" />
                    <span>Overdue - SLA breached</span>
                  </div>
                )}

                {isCurrent && isPending && !isOverdue && (
                  <p className="mt-1 text-sm text-blue-400">Awaiting approval</p>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
