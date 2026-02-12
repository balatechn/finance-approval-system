"use client"

import { useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import {
  Target,
  TrendingUp,
  TrendingDown,
  Clock,
  CheckCircle,
  ArrowUpRight,
  ArrowDownRight,
  PiggyBank,
  CalendarDays,
  Wallet,
  IndianRupee,
  AlertTriangle,
  RefreshCw,
} from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { formatCurrency } from "@/lib/utils"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  Area,
  AreaChart,
  Legend,
  PieChart,
  Pie,
  Cell,
} from "recharts"

interface ForecastData {
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

interface DashboardData {
  forecast: ForecastData
  monthlyTrend: Array<{
    month: string
    total: number
    approved: number
    pending: number
    disbursed: number
  }>
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
}

const COLORS = ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6']

export default function ForecastPage() {
  const { data: session } = useSession()
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date())

  const fetchData = async () => {
    try {
      const res = await fetch('/api/dashboard')
      if (res.ok) {
        const json = await res.json()
        setData(json)
        setLastRefresh(new Date())
      }
    } catch (error) {
      console.error('Failed to fetch forecast data:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
    // Auto-refresh every 5 minutes
    const interval = setInterval(fetchData, 5 * 60 * 1000)
    return () => clearInterval(interval)
  }, [])

  if (loading) {
    return (
      <div className="space-y-6 p-6">
        <div className="h-8 w-48 bg-gray-200 animate-pulse rounded" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <div className="h-20 bg-gray-200 animate-pulse rounded" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  if (!data?.forecast) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">No forecast data available</p>
      </div>
    )
  }

  const forecast = data.forecast
  const monthlyTrend = data.monthlyTrend || []

  // Calculate additional insights
  const totalPipeline = forecast.pendingPipeline.amount + forecast.approvedAwaiting.amount
  const approvalRate = data.stats ? ((data.stats.approved + data.stats.disbursed) / data.stats.total * 100) : 0

  // Prepare chart data for forecast vs actual
  const forecastChartData = monthlyTrend.slice(-6).map((m, idx, arr) => {
    // For the last month, add projected
    const isLast = idx === arr.length - 1
    return {
      month: m.month,
      actual: m.total,
      projected: isLast ? forecast.projectedAmount : null,
    }
  })

  // Add next month projection
  forecastChartData.push({
    month: forecast.nextMonth.split(' ')[0].substring(0, 3),
    actual: 0,
    projected: forecast.projectedAmount,
  })

  // Breakdown of pipeline
  const pipelineData = [
    { name: 'Pending Approval', value: forecast.pendingPipeline.amount, count: forecast.pendingPipeline.count },
    { name: 'Approved (Disbursement)', value: forecast.approvedAwaiting.amount, count: forecast.approvedAwaiting.count },
  ]

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Target className="h-6 w-6 text-blue-600" />
            Financial Forecast
          </h1>
          <p className="text-muted-foreground mt-1">
            {forecast.nextMonth} projections and expense analysis
          </p>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-xs text-muted-foreground">
            Last updated: {lastRefresh.toLocaleTimeString()}
          </span>
          <Button variant="outline" size="sm" onClick={fetchData} className="gap-2">
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Main Forecast Card */}
      <Card className="bg-gradient-to-r from-blue-50 via-indigo-50 to-purple-50 border-blue-200">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CalendarDays className="h-5 w-5 text-blue-600" />
              <CardTitle className="text-xl text-blue-900">{forecast.nextMonth} Projection</CardTitle>
            </div>
            <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-full border">
              {forecast.trend.direction === 'up' && (
                <>
                  <ArrowUpRight className="h-4 w-4 text-red-500" />
                  <span className="text-red-600 font-semibold">+{forecast.trend.percent.toFixed(1)}%</span>
                </>
              )}
              {forecast.trend.direction === 'down' && (
                <>
                  <ArrowDownRight className="h-4 w-4 text-green-500" />
                  <span className="text-green-600 font-semibold">-{Math.abs(forecast.trend.percent).toFixed(1)}%</span>
                </>
              )}
              {forecast.trend.direction === 'stable' && (
                <span className="text-gray-600 font-medium">Stable</span>
              )}
              <span className="text-muted-foreground text-sm">vs last month</span>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {/* Projected Expenses */}
            <div className="bg-white rounded-xl p-5 border border-blue-100 shadow-sm">
              <div className="flex items-center gap-2 mb-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <TrendingUp className="h-5 w-5 text-blue-600" />
                </div>
                <span className="text-sm font-medium text-blue-700">Projected Expenses</span>
              </div>
              <p className="text-3xl font-bold text-blue-900">{formatCurrency(forecast.projectedAmount)}</p>
              <p className="text-xs text-muted-foreground mt-2">Based on 3-month average + 70% of pipeline</p>
            </div>

            {/* Monthly Average */}
            <div className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm">
              <div className="flex items-center gap-2 mb-3">
                <div className="p-2 bg-gray-100 rounded-lg">
                  <PiggyBank className="h-5 w-5 text-gray-600" />
                </div>
                <span className="text-sm font-medium text-gray-700">3-Month Average</span>
              </div>
              <p className="text-3xl font-bold text-gray-900">{formatCurrency(forecast.monthlyAverage)}</p>
              <p className="text-xs text-muted-foreground mt-2">Historical disbursement average</p>
            </div>

            {/* Pending Pipeline */}
            <div className="bg-white rounded-xl p-5 border border-amber-100 shadow-sm">
              <div className="flex items-center gap-2 mb-3">
                <div className="p-2 bg-amber-100 rounded-lg">
                  <Clock className="h-5 w-5 text-amber-600" />
                </div>
                <span className="text-sm font-medium text-amber-700">Pending Pipeline</span>
              </div>
              <p className="text-3xl font-bold text-amber-900">{formatCurrency(forecast.pendingPipeline.amount)}</p>
              <p className="text-xs text-muted-foreground mt-2">{forecast.pendingPipeline.count} requests under review</p>
            </div>

            {/* Approved Awaiting */}
            <div className="bg-white rounded-xl p-5 border border-green-100 shadow-sm">
              <div className="flex items-center gap-2 mb-3">
                <div className="p-2 bg-green-100 rounded-lg">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                </div>
                <span className="text-sm font-medium text-green-700">Ready to Disburse</span>
              </div>
              <p className="text-3xl font-bold text-green-900">{formatCurrency(forecast.approvedAwaiting.amount)}</p>
              <p className="text-xs text-muted-foreground mt-2">{forecast.approvedAwaiting.count} requests approved</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Charts Section */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Expense Trend & Forecast */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-blue-600" />
              Expense Trend & Forecast
            </CardTitle>
            <CardDescription>Historical vs projected expenses</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={forecastChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                  <YAxis 
                    tickFormatter={(v) => `₹${(v / 100000).toFixed(0)}L`}
                    tick={{ fontSize: 12 }}
                  />
                  <Tooltip
                    formatter={(value: any) => [formatCurrency(value || 0), '']}
                    labelStyle={{ color: '#374151' }}
                    contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb' }}
                  />
                  <Legend />
                  <Area 
                    type="monotone" 
                    dataKey="actual" 
                    stroke="#3b82f6" 
                    fill="#93c5fd"
                    name="Actual"
                  />
                  <Area 
                    type="monotone" 
                    dataKey="projected" 
                    stroke="#8b5cf6" 
                    fill="#c4b5fd"
                    strokeDasharray="5 5"
                    name="Projected"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Pipeline Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Wallet className="h-4 w-4 text-amber-600" />
              Pipeline Breakdown
            </CardTitle>
            <CardDescription>Total pipeline: {formatCurrency(totalPipeline)}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pipelineData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={5}
                    dataKey="value"
                    label={({ percent }) => `${((percent || 0) * 100).toFixed(0)}%`}
                  >
                    <Cell fill="#f59e0b" />
                    <Cell fill="#22c55e" />
                  </Pie>
                  <Tooltip
                    formatter={(value: any, name: any, props: any) => [
                      `${formatCurrency(value || 0)} (${props?.payload?.count || 0} requests)`,
                      name
                    ]}
                    contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb' }}
                  />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Monthly Comparison */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <CalendarDays className="h-4 w-4 text-indigo-600" />
            Monthly Expense Breakdown
          </CardTitle>
          <CardDescription>Last 6 months comparison by status</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyTrend.slice(-6)}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                <YAxis 
                  tickFormatter={(v) => `₹${(v / 100000).toFixed(0)}L`}
                  tick={{ fontSize: 12 }}
                />
                <Tooltip
                  formatter={(value: any) => [formatCurrency(value || 0), '']}
                  contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb' }}
                />
                <Legend />
                <Bar dataKey="disbursed" stackId="a" fill="#22c55e" name="Disbursed" />
                <Bar dataKey="approved" stackId="a" fill="#3b82f6" name="Approved" />
                <Bar dataKey="pending" stackId="a" fill="#f59e0b" name="Pending" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Insights */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <IndianRupee className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-blue-700 font-medium">This Month So Far</p>
                <p className="text-xl font-bold text-blue-900">
                  {formatCurrency(data.stats?.thisMonthAmount || 0)}
                </p>
                <p className="text-xs text-muted-foreground">
                  {data.stats?.thisMonthCount || 0} requests
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-green-50 border-green-200">
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <CheckCircle className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-green-700 font-medium">Approval Rate</p>
                <p className="text-xl font-bold text-green-900">
                  {approvalRate.toFixed(1)}%
                </p>
                <p className="text-xs text-muted-foreground">
                  {data.stats?.approved + data.stats?.disbursed} of {data.stats?.total} requests
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-amber-50 border-amber-200">
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-100 rounded-lg">
                <AlertTriangle className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="text-sm text-amber-700 font-medium">Total in Pipeline</p>
                <p className="text-xl font-bold text-amber-900">
                  {formatCurrency(totalPipeline)}
                </p>
                <p className="text-xs text-muted-foreground">
                  {forecast.pendingPipeline.count + forecast.approvedAwaiting.count} requests pending action
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
