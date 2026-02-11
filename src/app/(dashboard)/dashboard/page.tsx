"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useSession } from "next-auth/react"
import {
  FileText,
  Clock,
  CheckCircle,
  AlertTriangle,
  TrendingUp,
  IndianRupee,
  ArrowRight,
  Building2,
  CalendarDays,
} from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { StatusBadge } from "@/components/status-badge"
import { formatCurrency, formatRelativeTime } from "@/lib/utils"

interface DashboardData {
  stats: {
    total: number
    pending: number
    approved: number
    rejected: number
    totalAmount: number
    pendingAmount: number
    thisMonthCount: number
    thisMonthAmount: number
  }
  recentRequests: Array<{
    id: string
    referenceNumber: string
    purpose: string
    totalAmountINR: number
    status: string
    createdAt: string
    requester: { name: string }
  }>
  pendingApprovals: Array<{
    id: string
    referenceNumber: string
    purpose: string
    totalAmountINR: number
    currentApprovalLevel: string
    createdAt: string
    requester: { name: string }
  }>
  slaAlerts: Array<{
    id: string
    referenceNumber: string
    currentApprovalLevel: string
    updatedAt: string
  }>
  entityStats: Array<{
    entity: string
    count: number
    amount: number
    pending: number
    approved: number
    disbursed: number
    rejected: number
  }>
}

export default function DashboardPage() {
  const { data: session } = useSession()
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)

  // Date range filter state - default to current month
  const now = new Date()
  const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  const [fromDate, setFromDate] = useState(firstOfMonth.toISOString().split("T")[0])
  const [toDate, setToDate] = useState(now.toISOString().split("T")[0])

  useEffect(() => {
    async function fetchDashboard() {
      try {
        setLoading(true)
        const params = new URLSearchParams()
        if (fromDate) params.set("from", fromDate)
        if (toDate) params.set("to", toDate)
        const response = await fetch(`/api/dashboard?${params.toString()}`)
        if (response.ok) {
          const result = await response.json()
          setData(result)
        }
      } catch (error) {
        console.error("Failed to fetch dashboard data:", error)
      } finally {
        setLoading(false)
      }
    }

    fetchDashboard()
  }, [fromDate, toDate])

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    )
  }

  const stats = data?.stats || {
    total: 0,
    pending: 0,
    approved: 0,
    rejected: 0,
    totalAmount: 0,
    pendingAmount: 0,
    thisMonthCount: 0,
    thisMonthAmount: 0,
  }

  const statCards = [
    {
      title: "Total Requests",
      value: stats.total,
      icon: FileText,
      color: "text-blue-600",
      bgColor: "bg-blue-100",
    },
    {
      title: "Pending Approval",
      value: stats.pending,
      icon: Clock,
      color: "text-amber-600",
      bgColor: "bg-amber-100",
    },
    {
      title: "Approved",
      value: stats.approved,
      icon: CheckCircle,
      color: "text-green-600",
      bgColor: "bg-green-100",
    },
    {
      title: "Total Value",
      value: formatCurrency(stats.totalAmount),
      icon: IndianRupee,
      color: "text-indigo-600",
      bgColor: "bg-indigo-100",
      isAmount: true,
    },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Welcome back, {session?.user?.name?.split(" ")[0]}!
          </h1>
          <p className="text-muted-foreground">
            Here&apos;s an overview of your finance requests
          </p>
        </div>
        <Button asChild>
          <Link href="/dashboard/requests/new">
            <FileText className="mr-2 h-4 w-4" />
            New Request
          </Link>
        </Button>
      </div>

      {/* Date Range Filter */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
            <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
              <CalendarDays className="h-4 w-4" />
              Date Range
            </div>
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 flex-1">
              <Input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="w-full sm:w-auto"
              />
              <span className="text-sm text-muted-foreground">to</span>
              <Input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="w-full sm:w-auto"
              />
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const t = new Date()
                  const f = new Date(t.getFullYear(), t.getMonth(), 1)
                  setFromDate(f.toISOString().split("T")[0])
                  setToDate(t.toISOString().split("T")[0])
                }}
              >
                This Month
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const t = new Date()
                  const f = new Date(t.getFullYear(), t.getMonth() - 1, 1)
                  const l = new Date(t.getFullYear(), t.getMonth(), 0)
                  setFromDate(f.toISOString().split("T")[0])
                  setToDate(l.toISOString().split("T")[0])
                }}
              >
                Last Month
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const t = new Date()
                  const f = new Date(t.getFullYear(), 0, 1)
                  setFromDate(f.toISOString().split("T")[0])
                  setToDate(t.toISOString().split("T")[0])
                }}
              >
                This Year
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {statCards.map((stat) => (
          <Card key={stat.title}>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{stat.title}</p>
                  <p className={`text-2xl font-bold ${stat.isAmount ? "text-lg" : ""}`}>
                    {stat.value}
                  </p>
                </div>
                <div className={`rounded-full p-3 ${stat.bgColor}`}>
                  <stat.icon className={`h-5 w-5 ${stat.color}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Period Summary */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center gap-4">
            <div className="rounded-full bg-primary/10 p-3">
              <TrendingUp className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h3 className="font-medium">Selected Period</h3>
              <p className="text-sm text-muted-foreground">
                {stats.thisMonthCount} requests totaling{" "}
                {formatCurrency(stats.thisMonthAmount)}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Entity-wise KPI */}
      {data?.entityStats && data.entityStats.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-indigo-600" />
              <CardTitle className="text-lg">Entity-wise Summary</CardTitle>
            </div>
            <CardDescription>Breakdown by entity for selected period</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="pb-3 font-medium text-muted-foreground">Entity</th>
                    <th className="pb-3 font-medium text-muted-foreground text-center">Requests</th>
                    <th className="pb-3 font-medium text-muted-foreground text-center">Pending</th>
                    <th className="pb-3 font-medium text-muted-foreground text-center">Approved</th>
                    <th className="pb-3 font-medium text-muted-foreground text-center">Disbursed</th>
                    <th className="pb-3 font-medium text-muted-foreground text-center">Rejected</th>
                    <th className="pb-3 font-medium text-muted-foreground text-right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {data.entityStats.map((es) => (
                    <tr key={es.entity} className="border-b last:border-0">
                      <td className="py-3 font-medium">
                        <div className="flex items-center gap-2">
                          <span className="inline-flex h-2 w-2 rounded-full bg-indigo-500" />
                          {es.entity}
                        </div>
                      </td>
                      <td className="py-3 text-center">{es.count}</td>
                      <td className="py-3 text-center">
                        <span className={es.pending > 0 ? "inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800" : ""}>
                          {es.pending}
                        </span>
                      </td>
                      <td className="py-3 text-center">
                        <span className={es.approved > 0 ? "inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800" : ""}>
                          {es.approved}
                        </span>
                      </td>
                      <td className="py-3 text-center">
                        <span className={es.disbursed > 0 ? "inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800" : ""}>
                          {es.disbursed}
                        </span>
                      </td>
                      <td className="py-3 text-center">
                        <span className={es.rejected > 0 ? "inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800" : ""}>
                          {es.rejected}
                        </span>
                      </td>
                      <td className="py-3 text-right font-medium">
                        {formatCurrency(es.amount)}
                      </td>
                    </tr>
                  ))}
                  {/* Totals row */}
                  <tr className="bg-gray-50 font-semibold">
                    <td className="py-3">Total</td>
                    <td className="py-3 text-center">{data.entityStats.reduce((s, e) => s + e.count, 0)}</td>
                    <td className="py-3 text-center">{data.entityStats.reduce((s, e) => s + e.pending, 0)}</td>
                    <td className="py-3 text-center">{data.entityStats.reduce((s, e) => s + e.approved, 0)}</td>
                    <td className="py-3 text-center">{data.entityStats.reduce((s, e) => s + e.disbursed, 0)}</td>
                    <td className="py-3 text-center">{data.entityStats.reduce((s, e) => s + e.rejected, 0)}</td>
                    <td className="py-3 text-right">{formatCurrency(data.entityStats.reduce((s, e) => s + e.amount, 0))}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* SLA Alerts */}
      {data?.slaAlerts && data.slaAlerts.length > 0 && (
        <Card className="border-amber-200 bg-amber-50">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-600" />
              <CardTitle className="text-lg text-amber-800">SLA Alerts</CardTitle>
            </div>
            <CardDescription className="text-amber-700">
              These requests are approaching or have breached their SLA
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {data.slaAlerts.slice(0, 3).map((alert) => (
                <Link
                  key={alert.id}
                  href={`/dashboard/requests/${alert.referenceNumber}`}
                  className="flex items-center justify-between rounded-lg bg-white p-3 hover:bg-gray-50"
                >
                  <div>
                    <span className="font-medium">{alert.referenceNumber}</span>
                    <span className="ml-2 text-sm text-muted-foreground">
                      {alert.currentApprovalLevel?.replace("_", " ")}
                    </span>
                  </div>
                  <ArrowRight className="h-4 w-4 text-gray-400" />
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Recent Requests */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Recent Requests</CardTitle>
              <CardDescription>Your latest finance requests</CardDescription>
            </div>
            <Link href="/dashboard/requests">
              <Button variant="ghost" size="sm">
                View All
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            {data?.recentRequests && data.recentRequests.length > 0 ? (
              <div className="space-y-4">
                {data.recentRequests.slice(0, 5).map((request) => (
                  <Link
                    key={request.id}
                    href={`/dashboard/requests/${request.referenceNumber}`}
                    className="flex items-center justify-between rounded-lg border p-3 transition-colors hover:bg-muted/50"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{request.referenceNumber}</span>
                        <StatusBadge status={request.status as any} />
                      </div>
                      <p className="truncate text-sm text-muted-foreground">
                        {request.purpose}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatRelativeTime(request.createdAt)}
                      </p>
                    </div>
                    <div className="ml-4 text-right">
                      <p className="font-medium">
                        {formatCurrency(request.totalAmountINR)}
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <FileText className="h-12 w-12 text-muted-foreground/50" />
                <p className="mt-2 text-muted-foreground">No requests yet</p>
                <Link href="/dashboard/requests/new" className="mt-4">
                  <Button variant="outline" size="sm">
                    Create your first request
                  </Button>
                </Link>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Pending Approvals (for approvers) */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Pending Approvals</CardTitle>
              <CardDescription>Requests awaiting your action</CardDescription>
            </div>
            <Link href="/dashboard/approvals">
              <Button variant="ghost" size="sm">
                View All
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            {data?.pendingApprovals && data.pendingApprovals.length > 0 ? (
              <div className="space-y-4">
                {data.pendingApprovals.slice(0, 5).map((request) => (
                  <Link
                    key={request.id}
                    href={`/dashboard/approvals/${request.referenceNumber}`}
                    className="flex items-center justify-between rounded-lg border p-3 transition-colors hover:bg-muted/50"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{request.referenceNumber}</span>
                      </div>
                      <p className="truncate text-sm text-muted-foreground">
                        {request.purpose}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        By {request.requester.name} • {formatRelativeTime(request.createdAt)}
                      </p>
                    </div>
                    <div className="ml-4 text-right">
                      <p className="font-medium">
                        {formatCurrency(request.totalAmountINR)}
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <CheckCircle className="h-12 w-12 text-muted-foreground/50" />
                <p className="mt-2 text-muted-foreground">No pending approvals</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
