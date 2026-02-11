"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useSession } from "next-auth/react"
import { CheckCircle, XCircle, ArrowLeftCircle, Clock, AlertTriangle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { ApprovalLevelBadge, StatusBadge } from "@/components/status-badge"
import { formatCurrency, formatRelativeTime } from "@/lib/utils"

interface PendingApproval {
  id: string
  referenceNumber: string
  purpose: string
  paymentType: string
  totalAmountINR: number
  currentApprovalLevel: string
  entity?: string
  createdAt: string
  updatedAt: string
  requester: {
    name: string
    department: string
  }
  isOverdue?: boolean
}

export default function ApprovalsPage() {
  const { data: session } = useSession()
  const [pendingApprovals, setPendingApprovals] = useState<PendingApproval[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchApprovals() {
      try {
        const response = await fetch("/api/dashboard")
        if (response.ok) {
          const data = await response.json()
          setPendingApprovals(data.pendingApprovals || [])
        }
      } catch (error) {
        console.error("Failed to fetch approvals:", error)
      } finally {
        setLoading(false)
      }
    }

    fetchApprovals()
  }, [])

  const overdueCount = pendingApprovals.filter((a) => a.isOverdue).length

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Pending Approvals</h1>
        <p className="text-muted-foreground">
          Review and take action on requests awaiting your approval
        </p>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Pending</p>
                <p className="text-2xl font-bold">{pendingApprovals.length}</p>
              </div>
              <div className="rounded-full bg-amber-100 p-3">
                <Clock className="h-5 w-5 text-amber-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Overdue</p>
                <p className="text-2xl font-bold text-red-600">{overdueCount}</p>
              </div>
              <div className="rounded-full bg-red-100 p-3">
                <AlertTriangle className="h-5 w-5 text-red-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Value</p>
                <p className="text-2xl font-bold">
                  {formatCurrency(
                    pendingApprovals.reduce((sum, a) => sum + a.totalAmountINR, 0)
                  )}
                </p>
              </div>
              <div className="rounded-full bg-blue-100 p-3">
                <CheckCircle className="h-5 w-5 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Overdue Alert */}
      {overdueCount > 0 && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 text-red-600" />
              <div>
                <p className="font-medium text-red-800">
                  {overdueCount} request{overdueCount > 1 ? "s" : ""} overdue
                </p>
                <p className="text-sm text-red-700">
                  Please review and take action on overdue requests to maintain SLA compliance.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Approvals Table */}
      <Card>
        <CardHeader>
          <CardTitle>Requests Awaiting Your Action</CardTitle>
          <CardDescription>
            Click on a request to view details and take action
          </CardDescription>
        </CardHeader>
        <CardContent>
          {pendingApprovals.length === 0 ? (
            <div className="flex h-64 flex-col items-center justify-center text-center">
              <CheckCircle className="h-12 w-12 text-green-500" />
              <p className="mt-4 text-lg font-medium">All caught up!</p>
              <p className="text-muted-foreground">
                You have no pending approvals at this time.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Reference</TableHead>
                    <TableHead>Requester</TableHead>
                    <TableHead>Purpose</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Entity</TableHead>
                    <TableHead>Stage</TableHead>
                    <TableHead>Submitted</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pendingApprovals.map((approval) => (
                    <TableRow
                      key={approval.id}
                      className={approval.isOverdue ? "bg-red-50" : ""}
                    >
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <Link
                            href={`/dashboard/approvals/${approval.referenceNumber}`}
                            className="text-primary hover:underline"
                          >
                            {approval.referenceNumber}
                          </Link>
                          {approval.isOverdue && (
                            <Badge variant="destructive" className="text-xs">
                              Overdue
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{approval.requester.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {approval.requester.department}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell className="max-w-xs truncate">
                        {approval.purpose}
                      </TableCell>
                      <TableCell className="font-medium">
                        {formatCurrency(approval.totalAmountINR)}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {approval.entity || "—"}
                      </TableCell>
                      <TableCell>
                        <ApprovalLevelBadge level={approval.currentApprovalLevel as any} />
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatRelativeTime(approval.createdAt)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Link href={`/dashboard/approvals/${approval.referenceNumber}`}>
                          <Button size="sm">Review</Button>
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quick Actions Legend */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions Guide</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-green-100 p-2">
                <CheckCircle className="h-4 w-4 text-green-600" />
              </div>
              <div>
                <p className="font-medium">Approve</p>
                <p className="text-sm text-muted-foreground">
                  Forward to next stage
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-red-100 p-2">
                <XCircle className="h-4 w-4 text-red-600" />
              </div>
              <div>
                <p className="font-medium">Reject</p>
                <p className="text-sm text-muted-foreground">
                  Close the request
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-amber-100 p-2">
                <ArrowLeftCircle className="h-4 w-4 text-amber-600" />
              </div>
              <div>
                <p className="font-medium">Send Back</p>
                <p className="text-sm text-muted-foreground">
                  Return for revision
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
