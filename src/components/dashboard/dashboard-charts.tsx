"use client"

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend,
  Line, Area, AreaChart,
} from "recharts"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Building2, TrendingUp, Users, Store } from "lucide-react"
import { formatCurrency } from "@/lib/utils"

interface DashboardChartsProps {
  monthlyTrend: Array<{ month: string; total: number; approved: number; pending: number; disbursed: number }>
  departmentStats: Array<{ department: string; amount: number; count: number; percentage: string }>
  topVendors: Array<{ vendor: string; amount: number; count: number; percentage: string }>
  entityStats: Array<{ entity: string; count: number; amount: number; pending: number; approved: number; disbursed: number; rejected: number }>
  stats: { totalAmount: number; pendingAmount: number; approvedAmount: number; disbursedAmount: number }
}

const currencyTickFormatter = (value: number) =>
  value >= 100000
    ? `${(value / 100000).toFixed(0)}L`
    : value >= 1000
    ? `${(value / 1000).toFixed(0)}K`
    : value.toString()

const tooltipStyle = { borderRadius: "8px", fontSize: "13px" }

export default function DashboardCharts({ monthlyTrend, departmentStats, topVendors, entityStats, stats }: DashboardChartsProps) {
  const totalEntityAmount = entityStats.reduce((s, e) => s + e.amount, 0)

  return (
    <>
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
              {monthlyTrend && monthlyTrend.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={monthlyTrend}
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
                    <YAxis tick={{ fontSize: 10 }} tickFormatter={currencyTickFormatter} />
                    <Tooltip
                      formatter={(value) => [formatCurrency(value as number), ""]}
                      contentStyle={tooltipStyle}
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
              {departmentStats && departmentStats.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={departmentStats}
                    layout="vertical"
                    margin={{ top: 5, right: 10, left: 60, bottom: 5 }}
                    barSize={16}
                  >
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={currencyTickFormatter} />
                    <YAxis
                      type="category"
                      dataKey="department"
                      tick={{ fontSize: 10 }}
                      width={55}
                    />
                    <Tooltip
                      formatter={(value, _name, props) => [
                        `${formatCurrency(value as number)} (${props.payload.percentage}%)`,
                        "Amount",
                      ]}
                      contentStyle={tooltipStyle}
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
            {topVendors && topVendors.length > 0 ? (
              <div className="space-y-3">
                {topVendors.map((vendor, index) => (
                  <div key={vendor.vendor} className="flex items-center gap-3">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-orange-100 text-xs font-medium text-orange-700">
                      {index + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{vendor.vendor}</p>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-2 bg-white/60 rounded-full overflow-hidden">
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
                      label={({ percent }: any) =>
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
                      contentStyle={tooltipStyle}
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
        {entityStats.length > 0 && (
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
                  data={entityStats.map((es) => ({
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
                    contentStyle={tooltipStyle}
                  />
                  <Bar dataKey="amount" fill="#6366f1" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
        )}
      </div>

      {/* Entity-wise Expense Summary Table */}
      {entityStats.length > 0 && (
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
                  {entityStats.map((es) => {
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
                          <div className="w-16 h-2 bg-white/60 rounded-full overflow-hidden">
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
                        <span className={es.pending > 0 ? "inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700" : "text-muted-foreground"}>
                          {es.pending}
                        </span>
                      </td>
                      <td className="py-3 text-center">
                        <span className={es.disbursed > 0 ? "inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700" : "text-muted-foreground"}>
                          {es.disbursed}
                        </span>
                      </td>
                    </tr>
                    );
                  })}
                  {/* Totals row */}
                  <tr className="bg-white/60 font-semibold">
                    <td className="py-3">Total</td>
                    <td className="py-3 text-right text-indigo-700">{formatCurrency(totalEntityAmount)}</td>
                    <td className="py-3 text-center">100%</td>
                    <td className="py-3 text-center">{entityStats.reduce((s, e) => s + e.count, 0)}</td>
                    <td className="py-3 text-right text-muted-foreground">
                      {formatCurrency(totalEntityAmount / Math.max(entityStats.reduce((s, e) => s + e.count, 0), 1))}
                    </td>
                    <td className="py-3 text-center">{entityStats.reduce((s, e) => s + e.pending, 0)}</td>
                    <td className="py-3 text-center">{entityStats.reduce((s, e) => s + e.disbursed, 0)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </>
  )
}
