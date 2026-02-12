"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useSession } from "next-auth/react"
import {
  FileText,
  Clock,
  CheckCircle,
  AlertTriangle,
  IndianRupee,
  ArrowRight,
  Building2,
  CalendarDays,
  TrendingUp,
  Wallet,
  CreditCard,
  Store,
  Users,
} from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { StatusBadge } from "@/components/status-badge"
import { formatCurrency, formatRelativeTime } from "@/lib/utils"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
  LineChart,
  Line,
  Area,
  AreaChart,
} from "recharts"

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
    disbursed: 0,
    totalAmount: 0,
    pendingAmount: 0,
    approvedAmount: 0,
    disbursedAmount: 0,
    thisMonthCount: 0,
    thisMonthAmount: 0,
  }

  // Cost-focused stat cards
  const statCards = [
    {
      title: "Total Expenses",
      value: formatCurrency(stats.totalAmount),
      subtext: `${stats.total} requests`,
      icon: IndianRupee,
      color: "text-blue-600",
      bgColor: "bg-blue-100",
    },
    {
      title: "Pending Approval",
      value: formatCurrency(stats.pendingAmount),
      subtext: `${stats.pending} requests`,
      icon: Clock,
      color: "text-amber-600",
      bgColor: "bg-amber-100",
    },
    {
      title: "Approved (Awaiting)",
      value: formatCurrency(stats.approvedAmount),
      subtext: `${stats.approved} requests`,
      icon: CheckCircle,
      color: "text-green-600",
      bgColor: "bg-green-100",
    },
    {
      title: "Disbursed",
      value: formatCurrency(stats.disbursedAmount),
      subtext: `${stats.disbursed} requests`,
      icon: Wallet,
      color: "text-indigo-600",
      bgColor: "bg-indigo-100",
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

      {/* Charts Section - Cost Focused */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Monthly Expense Trend */}
        <Card className="lg:col-span-2">
          <CardHeader className="p-4 pb-1">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-blue-600" />
              <CardTitle className="text-sm font-semibold">Monthly Expense Trend</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="h-[200px]">
              {data?.monthlyTrend && data.monthlyTrend.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={data.monthlyTrend}
                    margin={{ top: 10, right: 10, left: 10, bottom: 0 }}
                  >
                    <defs>
                      <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                    <YAxis
                      tick={{ fontSize: 10 }}
                      tickFormatter={(value) =>
                        value >= 100000
                          ? `${(value / 100000).toFixed(0)}L`
                          : value >= 1000
                          ? `${(value / 1000).toFixed(0)}K`
                          : value.toString()
                      }
                    />
                    <Tooltip
                      formatter={(value) => [formatCurrency(value as number), ""]}
                      contentStyle={{ borderRadius: "8px", fontSize: "13px" }}
                    />
                    <Area
                      type="monotone"
                      dataKey="total"
                      name="Total Expenses"
                      stroke="#3b82f6"
                      fillOpacity={1}
                      fill="url(#colorTotal)"
                      strokeWidth={2}
                    />
                    <Line
                      type="monotone"
                      dataKey="disbursed"
                      name="Disbursed"
                      stroke="#22c55e"
                      strokeWidth={2}
                      dot={{ fill: "#22c55e", strokeWidth: 2, r: 3 }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                  No trend data available
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Department-wise Expenses */}
        <Card>
          <CardHeader className="p-4 pb-1">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-purple-600" />
              <CardTitle className="text-sm font-semibold">Department-wise Expenses</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="h-[200px]">
              {data?.departmentStats && data.departmentStats.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={data.departmentStats}
                    layout="vertical"
                    margin={{ top: 5, right: 10, left: 60, bottom: 5 }}
                    barSize={16}
                  >
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                    <XAxis
                      type="number"
                      tick={{ fontSize: 10 }}
                      tickFormatter={(value) =>
                        value >= 100000
                          ? `${(value / 100000).toFixed(0)}L`
                          : value >= 1000
                          ? `${(value / 1000).toFixed(0)}K`
                          : value.toString()
                      }
                    />
                    <YAxis
                      type="category"
                      dataKey="department"
                      tick={{ fontSize: 10 }}
                      width={55}
                    />
                    <Tooltip
                      formatter={(value, name, props) => [
                        `${formatCurrency(value as number)} (${props.payload.percentage}%)`,
                        "Amount",
                      ]}
                      contentStyle={{ borderRadius: "8px", fontSize: "13px" }}
                    />
                    <Bar dataKey="amount" fill="#8b5cf6" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                  No department data
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Top Vendors by Spend */}
        <Card>
          <CardHeader className="p-4 pb-1">
            <div className="flex items-center gap-2">
              <Store className="h-4 w-4 text-orange-600" />
              <CardTitle className="text-sm font-semibold">Top Vendors by Spend</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-2">
            {data?.topVendors && data.topVendors.length > 0 ? (
              <div className="space-y-3">
                {data.topVendors.map((vendor, index) => (
                  <div key={vendor.vendor} className="flex items-center gap-3">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-orange-100 text-xs font-medium text-orange-700">
                      {index + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{vendor.vendor}</p>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-orange-500 rounded-full"
                            style={{ width: `${Math.min(parseFloat(vendor.percentage), 100)}%` }}
                          />
                        </div>
                        <span className="text-xs text-muted-foreground w-10">
                          {vendor.percentage}%
                        </span>
                      </div>
                    </div>
                    <span className="text-sm font-medium">{formatCurrency(vendor.amount)}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex h-[180px] items-center justify-center text-sm text-muted-foreground">
                No vendor data
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Entity-wise Amount Summary */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Expense Distribution Pie */}
        <Card>
          <CardHeader className="p-4 pb-1">
            <CardTitle className="text-sm font-semibold">Expense Distribution</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="h-[180px]">
              {stats.totalAmount > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={[
                        { name: "Pending", value: stats.pendingAmount },
                        { name: "Approved", value: stats.approvedAmount },
                        { name: "Disbursed", value: stats.disbursedAmount },
                      ].filter((d) => d.value > 0)}
                      cx="50%"
                      cy="50%"
                      innerRadius={40}
                      outerRadius={65}
                      paddingAngle={3}
                      dataKey="value"
                      label={({ name, percent }: any) =>
                        `${((percent || 0) * 100).toFixed(0)}%`
                      }
                      labelLine={false}
                    >
                      {[
                        { fill: "#f59e0b" },
                        { fill: "#22c55e" },
                        { fill: "#6366f1" },
                      ].map((entry, index) => (
                        <Cell key={index} fill={entry.fill} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value) => [formatCurrency(value as number), ""]}
                      contentStyle={{ borderRadius: "8px", fontSize: "13px" }}
                    />
                    <Legend
                      iconType="circle"
                      wrapperStyle={{ fontSize: "11px", paddingTop: 0 }}
                      iconSize={8}
                    />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                  No data for selected period
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Entity-wise Amount Bar Chart */}
        {data?.entityStats && data.entityStats.length > 0 && (
        <Card className="lg:col-span-2">
          <CardHeader className="p-4 pb-1">
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-indigo-600" />
              <CardTitle className="text-sm font-semibold">Entity-wise Expenses</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="h-[180px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={data.entityStats.map((es) => ({
                    name: es.entity.length > 12 ? es.entity.substring(0, 10) + ".." : es.entity,
                    fullName: es.entity,
                    amount: es.amount,
                  }))}
                  margin={{ top: 5, right: 5, left: 10, bottom: 30 }}
                  barSize={32}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 9 }}
                    angle={-30}
                    textAnchor="end"
                    interval={0}
                  />
                  <YAxis
                    tick={{ fontSize: 10 }}
                    tickFormatter={(value) =>
                      value >= 100000
                        ? `${(value / 100000).toFixed(1)}L`
                        : value >= 1000
                        ? `${(value / 1000).toFixed(0)}K`
                        : value.toString()
                    }
                  />
                  <Tooltip
                    formatter={(value) => [formatCurrency(value as number), "Amount"]}
                    labelFormatter={(_label, payload) =>
                      payload?.[0]?.payload?.fullName || _label
                    }
                    contentStyle={{ borderRadius: "8px", fontSize: "13px" }}
                  />
                  <Bar dataKey="amount" fill="#6366f1" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}
      </div>

      {/* Entity-wise Expense Summary */}
      {data?.entityStats && data.entityStats.length > 0 && (() => {
        const totalEntityAmount = data.entityStats.reduce((s, e) => s + e.amount, 0);
        return (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-indigo-600" />
              <CardTitle className="text-lg">Entity-wise Expense Summary</CardTitle>
            </div>
            <CardDescription>Cost breakdown by entity for selected period</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="pb-3 font-medium text-muted-foreground">Entity</th>
                    <th className="pb-3 font-medium text-muted-foreground text-right">Total Amount</th>
                    <th className="pb-3 font-medium text-muted-foreground text-center">% Share</th>
                    <th className="pb-3 font-medium text-muted-foreground text-center">Requests</th>
                    <th className="pb-3 font-medium text-muted-foreground text-right">Avg/Request</th>
                    <th className="pb-3 font-medium text-muted-foreground text-center">Pending</th>
                    <th className="pb-3 font-medium text-muted-foreground text-center">Disbursed</th>
                  </tr>
                </thead>
                <tbody>
                  {data.entityStats.map((es) => {
                    const percentage = totalEntityAmount > 0 ? ((es.amount / totalEntityAmount) * 100).toFixed(1) : '0';
                    const avgPerRequest = es.count > 0 ? es.amount / es.count : 0;
                    return (
                    <tr key={es.entity} className="border-b last:border-0">
                      <td className="py-3 font-medium">
                        <div className="flex items-center gap-2">
                          <span className="inline-flex h-2 w-2 rounded-full bg-indigo-500" />
                          {es.entity}
                        </div>
                      </td>
                      <td className="py-3 text-right font-semibold text-indigo-700">
                        {formatCurrency(es.amount)}
                      </td>
                      <td className="py-3 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <div className="w-16 h-2 bg-gray-100 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-indigo-500 rounded-full"
                              style={{ width: `${Math.min(parseFloat(percentage), 100)}%` }}
                            />
                          </div>
                          <span className="text-xs font-medium w-10">{percentage}%</span>
                        </div>
                      </td>
                      <td className="py-3 text-center">{es.count}</td>
                      <td className="py-3 text-right text-muted-foreground">
                        {formatCurrency(avgPerRequest)}
                      </td>
                      <td className="py-3 text-center">
                        <span className={es.pending > 0 ? "inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800" : "text-muted-foreground"}>
                          {es.pending}
                        </span>
                      </td>
                      <td className="py-3 text-center">
                        <span className={es.disbursed > 0 ? "inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800" : "text-muted-foreground"}>
                          {es.disbursed}
                        </span>
                      </td>
                    </tr>
                    );
                  })}
                  {/* Totals row */}
                  <tr className="bg-gray-50 font-semibold">
                    <td className="py-3">Total</td>
                    <td className="py-3 text-right text-indigo-700">{formatCurrency(totalEntityAmount)}</td>
                    <td className="py-3 text-center">100%</td>
                    <td className="py-3 text-center">{data.entityStats.reduce((s, e) => s + e.count, 0)}</td>
                    <td className="py-3 text-right text-muted-foreground">
                      {formatCurrency(totalEntityAmount / Math.max(data.entityStats.reduce((s, e) => s + e.count, 0), 1))}
                    </td>
                    <td className="py-3 text-center">{data.entityStats.reduce((s, e) => s + e.pending, 0)}</td>
                    <td className="py-3 text-center">{data.entityStats.reduce((s, e) => s + e.disbursed, 0)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
        );
      })()}

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
