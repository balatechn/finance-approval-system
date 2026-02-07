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
  className?: string
}

const levelOrder = [
  "MANAGER",
  "DEPARTMENT_HEAD",
  "FINANCE_VETTING",
  "FINANCE_APPROVAL",
  "DISBURSEMENT",
] as const

const levelLabels: Record<string, string> = {
  MANAGER: "Manager Approval",
  DEPARTMENT_HEAD: "Department Head",
  FINANCE_VETTING: "Finance Vetting",
  FINANCE_APPROVAL: "Finance Approval",
  DISBURSEMENT: "Disbursement",
}

export function ApprovalTimeline({ steps, currentLevel, className }: ApprovalTimelineProps) {
  const stepsMap = new Map(steps.map(s => [s.level, s]))

  return (
    <div className={cn("relative", className)}>
      <div className="space-y-6">
        {levelOrder.map((level, index) => {
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
              {index < levelOrder.length - 1 && (
                <div
                  className={cn(
                    "absolute left-4 top-8 h-full w-0.5 -translate-x-1/2",
                    isCompleted ? "bg-green-500" : "bg-gray-200"
                  )}
                />
              )}

              {/* Status icon */}
              <div
                className={cn(
                  "relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2",
                  isCompleted && "border-green-500 bg-green-500 text-white",
                  isRejected && "border-red-500 bg-red-500 text-white",
                  isSentBack && "border-amber-500 bg-amber-500 text-white",
                  isCurrent && isPending && "border-blue-500 bg-blue-50 text-blue-500",
                  isCurrent && isPending && isOverdue && "border-red-500 bg-red-50 text-red-500",
                  !step && "border-gray-200 bg-gray-50 text-gray-400",
                  isPending && !isCurrent && "border-gray-200 bg-gray-50 text-gray-400"
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
                      isCompleted && "text-green-700",
                      isRejected && "text-red-700",
                      isSentBack && "text-amber-700",
                      isCurrent && isPending && "text-blue-700",
                      (!step || (isPending && !isCurrent)) && "text-gray-500"
                    )}
                  >
                    {levelLabels[level]}
                  </h4>
                  {step?.slaHours && isPending && (
                    <span
                      className={cn(
                        "text-xs",
                        isOverdue ? "text-red-500" : "text-gray-500"
                      )}
                    >
                      SLA: {step.slaHours}h
                    </span>
                  )}
                </div>

                {step?.approverName && (
                  <p className="mt-1 text-sm text-gray-600">
                    {isCompleted && "Approved by "}
                    {isRejected && "Rejected by "}
                    {isSentBack && "Sent back by "}
                    <span className="font-medium">{step.approverName}</span>
                  </p>
                )}

                {step?.completedAt && (
                  <p className="mt-0.5 text-xs text-gray-500">
                    {formatDateTime(step.completedAt)}
                  </p>
                )}

                {step?.comments && (
                  <div className="mt-2 rounded-md bg-gray-50 p-3 text-sm text-gray-600">
                    <p className="font-medium text-gray-700">Comments:</p>
                    <p className="mt-1">{step.comments}</p>
                  </div>
                )}

                {isCurrent && isPending && isOverdue && (
                  <div className="mt-2 flex items-center gap-1 text-sm text-red-600">
                    <AlertCircle className="h-4 w-4" />
                    <span>Overdue - SLA breached</span>
                  </div>
                )}

                {isCurrent && isPending && !isOverdue && (
                  <p className="mt-1 text-sm text-blue-600">Awaiting approval</p>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
