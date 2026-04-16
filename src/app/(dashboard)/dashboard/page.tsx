"use client"

import { useEffect, useState, useMemo } from "react"
import Link from "next/link"
import { useSession } from "next-auth/react"
import {
  FileText,
  Clock,
  CheckCircle,
  AlertTriangle,
  IndianRupee,
  ArrowRight,
  CalendarDays,
  Wallet,
  Target,
} from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { StatusBadge } from "@/components/status-badge"
import { formatCurrency, formatRelativeTime } from "@/lib/utils"
import dynamic from "next/dynamic"

// Lazy-load charts component (defers ~200KB recharts bundle)
const DashboardCharts = dynamic(
  () => import("@/components/dashboard/dashboard-charts"),
  {
    ssr: false,
    loading: () => (
      <div className="grid gap-4 lg:grid-cols-2 animate-pulse">
        <div className="lg:col-span-2 rounded-lg border bg-white/[0.06] backdrop-blur-xl p-4"><div className="h-[200px] bg-white/[0.06] rounded" /></div>
        <div className="rounded-lg border bg-white/[0.06] backdrop-blur-xl p-4"><div className="h-[200px] bg-white/[0.06] rounded" /></div>
        <div className="rounded-lg border bg-white/[0.06] backdrop-blur-xl p-4"><div className="h-[200px] bg-white/[0.06] rounded" /></div>
      </div>
    ),
  }
)

interface DashboardData {
  stats: {
    total: number
    pending: number
    approved: number
    rejected: number
    disbursed: number
    totalAmount: number
    pendingAmount: number
    approvedAmount: number
    disbursedAmount: number
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
  monthlyTrend: Array<{
    month: string
    total: number
    approved: number
    pending: number
    disbursed: number
  }>
  departmentStats: Array<{
    department: string
    amount: number
    count: number
    percentage: string
  }>
  topVendors: Array<{
    vendor: string
    amount: number
    count: number
    percentage: string
  }>
  forecast: {
    nextMonth: string
    projectedAmount: number
    monthlyAverage: number
    pendingPipeline: {
      amount: number
      count: number
    }
    approvedAwaiting: {
      amount: number
      count: number
    }
    trend: {
      percent: number
      direction: 'up' | 'down' | 'stable'
    }
  }
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
  const [requestTypeFilter, setRequestTypeFilter] = useState("all")

  useEffect(() => {
    async function fetchDashboard() {
      try {
        setLoading(true)
        const params = new URLSearchParams()
        if (fromDate) params.set("from", fromDate)
        if (toDate) params.set("to", toDate)
        if (requestTypeFilter !== "all") params.set("requestType", requestTypeFilter)
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
  }, [fromDate, toDate, requestTypeFilter])

  const stats = data?.stats || {
    total: 0,
    pending: 0,
    approved: 0,
    rejected: 0,
    disbursed: 0,
    totalAmount: 0,
    pendingAmount: 0,
    approvedAmount: 0,
    disbursedAmount: 0,
    thisMonthCount: 0,
    thisMonthAmount: 0,
  }

  // Cost-focused stat cards (memoized to avoid re-creating on each render)
  const statCards = useMemo(() => [
    {
      title: "Total Expenses",
      value: formatCurrency(stats.totalAmount),
      subtext: `${stats.total} requests`,
      icon: IndianRupee,
      color: "text-blue-400",
      bgColor: "bg-blue-500/20",
    },
    {
      title: "Pending Approval",
      value: formatCurrency(stats.pendingAmount),
      subtext: `${stats.pending} requests`,
      icon: Clock,
      color: "text-amber-400",
      bgColor: "bg-amber-500/20",
    },
    {
      title: "Approved (Awaiting)",
      value: formatCurrency(stats.approvedAmount),
      subtext: `${stats.approved} requests`,
      icon: CheckCircle,
      color: "text-emerald-400",
      bgColor: "bg-emerald-500/20",
    },
    {
      title: "Disbursed",
      value: formatCurrency(stats.disbursedAmount),
      subtext: `${stats.disbursed} requests`,
      icon: Wallet,
      color: "text-indigo-400",
      bgColor: "bg-indigo-500/20",
    },
  ], [stats])

  if (loading && !data) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="h-7 w-48 rounded bg-white/[0.1] mb-2" />
            <div className="h-4 w-64 rounded bg-white/[0.1]" />
          </div>
          <div className="h-10 w-32 rounded bg-white/[0.1]" />
        </div>
        <div className="h-16 rounded-lg bg-white/[0.1]" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i}><CardContent className="p-6"><div className="flex items-center justify-between"><div><div className="h-4 w-24 rounded bg-white/[0.1] mb-2" /><div className="h-6 w-20 rounded bg-white/[0.1]" /></div><div className="h-11 w-11 rounded-full bg-white/[0.1]" /></div></CardContent></Card>
          ))}
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <Card className="lg:col-span-2"><CardContent className="p-6"><div className="h-[200px] bg-white/[0.06] rounded" /></CardContent></Card>
          <Card><CardContent className="p-6"><div className="h-[200px] bg-white/[0.06] rounded" /></CardContent></Card>
          <Card><CardContent className="p-6"><div className="h-[200px] bg-white/[0.06] rounded" /></CardContent></Card>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Subtle refresh indicator */}
      {loading && data && (
        <div className="fixed top-16 left-0 right-0 z-30">
          <div className="h-0.5 bg-primary/60 animate-pulse" />
        </div>
      )}
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">
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
            <div className="flex items-center gap-2 text-sm font-medium text-white/80">
              <CalendarDays className="h-4 w-4" />
              Filters
            </div>
            <Select value={requestTypeFilter} onValueChange={setRequestTypeFilter}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Request Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="EXPENSE_APPROVAL">Expense Approval</SelectItem>
                <SelectItem value="PAYMENT_APPROVAL">Payment Approval</SelectItem>
              </SelectContent>
            </Select>
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
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                className="min-h-[44px] sm:min-h-0"
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
                className="min-h-[44px] sm:min-h-0"
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
                className="min-h-[44px] sm:min-h-0"
                onClick={() => {
                  const t = new Date()
                  const f = new Date(t.getFullYear(), 0, 1)
                  setFromDate(f.toISOString().split("T")[0])
                  setToDate(t.toISOString().split("T")[0])
                }}
              >
                This Year
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="min-h-[44px] sm:min-h-0 bg-gradient-to-r from-blue-500/20 to-indigo-500/20 border-blue-500/30 text-blue-300 hover:from-blue-500/30 hover:to-indigo-500/30"
                onClick={() => {
                  const t = new Date()
                  const f = new Date(t.getFullYear(), t.getMonth() + 1, 1)
                  const l = new Date(t.getFullYear(), t.getMonth() + 2, 0)
                  setFromDate(f.toISOString().split("T")[0])
                  setToDate(l.toISOString().split("T")[0])
                }}
              >
                <Target className="h-3 w-3 mr-1" />
                Next Month
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats Grid - Cost Focused */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {statCards.map((stat) => (
          <Card key={stat.title}>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{stat.title}</p>
                  <p className="text-xl font-bold">{stat.value}</p>
                  {stat.subtext && (
                    <p className="text-xs text-muted-foreground mt-1">{stat.subtext}</p>
                  )}
                </div>
                <div className={`rounded-full p-3 ${stat.bgColor}`}>
                  <stat.icon className={`h-5 w-5 ${stat.color}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts & Analytics (lazy-loaded for faster initial render) */}
      {data && (
        <DashboardCharts
          monthlyTrend={data.monthlyTrend || []}
          departmentStats={data.departmentStats || []}
          topVendors={data.topVendors || []}
          entityStats={data.entityStats || []}
          stats={stats}
        />
      )}

      {/* SLA Alerts */}
      {data?.slaAlerts && data.slaAlerts.length > 0 && (
        <Card className="border-amber-500/30 bg-amber-500/10">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-400" />
              <CardTitle className="text-lg text-amber-300">SLA Alerts</CardTitle>
            </div>
            <CardDescription className="text-amber-300">
              These requests are approaching or have breached their SLA
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {data.slaAlerts.slice(0, 3).map((alert) => (
                <Link
                  key={alert.id}
                  href={`/dashboard/requests/${alert.referenceNumber}`}
                  className="flex items-center justify-between rounded-lg bg-white/[0.06] backdrop-blur-xl p-3 hover:bg-white/[0.06]"
                >
                  <div>
                    <span className="font-medium">{alert.referenceNumber}</span>
                    <span className="ml-2 text-sm text-muted-foreground">
                      {alert.currentApprovalLevel?.replace("_", " ")}
                    </span>
                  </div>
                  <ArrowRight className="h-4 w-4 text-white/40" />
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
