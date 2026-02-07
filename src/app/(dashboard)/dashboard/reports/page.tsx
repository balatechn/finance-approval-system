"use client"

import { useState } from "react"
import { useSession } from "next-auth/react"
import {
  BarChart3,
  Download,
  FileText,
  PieChart,
  TrendingUp,
  Calendar,
  Filter,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"

const reportTypes = [
  {
    id: "summary",
    title: "Summary Report",
    description: "Overview of all requests by status, payment type, and currency",
    icon: PieChart,
  },
  {
    id: "status",
    title: "Status Report",
    description: "Detailed breakdown by approval status and levels",
    icon: BarChart3,
  },
  {
    id: "department",
    title: "Department Report",
    description: "Analysis of requests by department",
    icon: FileText,
  },
  {
    id: "sla",
    title: "SLA Compliance Report",
    description: "SLA breach analysis and compliance metrics",
    icon: TrendingUp,
  },
  {
    id: "payment",
    title: "Payment Report",
    description: "Disbursed payments, vendor analysis, and trends",
    icon: Calendar,
  },
  {
    id: "detailed",
    title: "Detailed Export",
    description: "Complete data export with all fields",
    icon: Download,
  },
]

export default function ReportsPage() {
  const { data: session } = useSession()
  const { toast } = useToast()
  const [selectedReport, setSelectedReport] = useState<string | null>(null)
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  const [department, setDepartment] = useState("all")
  const [format, setFormat] = useState("json")
  const [loading, setLoading] = useState(false)
  const [reportData, setReportData] = useState<any>(null)

  const generateReport = async () => {
    if (!selectedReport) {
      toast({
        title: "Select Report Type",
        description: "Please select a report type to generate",
        variant: "destructive",
      })
      return
    }

    try {
      setLoading(true)
      setReportData(null)

      const params = new URLSearchParams({
        type: selectedReport,
        format,
      })
      if (startDate) params.set("startDate", startDate)
      if (endDate) params.set("endDate", endDate)
      if (department !== "all") params.set("department", department)

      const response = await fetch(`/api/reports?${params}`)

      if (!response.ok) {
        throw new Error("Failed to generate report")
      }

      if (format === "csv") {
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.href = url
        a.download = `${selectedReport}-report-${new Date().toISOString().split("T")[0]}.csv`
        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(url)
        document.body.removeChild(a)
        toast({
          title: "Report Downloaded",
          description: "Your CSV report has been downloaded",
          variant: "success",
        })
      } else {
        const data = await response.json()
        setReportData(data)
        toast({
          title: "Report Generated",
          description: "Your report is ready to view",
          variant: "success",
        })
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to generate report",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Reports</h1>
        <p className="text-muted-foreground">
          Generate and export finance request reports
        </p>
      </div>

      {/* Report Type Selection */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {reportTypes.map((report) => (
          <Card
            key={report.id}
            className={`cursor-pointer transition-all hover:border-primary ${
              selectedReport === report.id ? "border-primary ring-2 ring-primary/20" : ""
            }`}
            onClick={() => setSelectedReport(report.id)}
          >
            <CardContent className="p-6">
              <div className="flex items-start gap-4">
                <div
                  className={`rounded-lg p-2 ${
                    selectedReport === report.id
                      ? "bg-primary text-white"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  <report.icon className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-medium">{report.title}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {report.description}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Report Filters
          </CardTitle>
          <CardDescription>
            Configure date range and other filters for your report
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-2">
              <Label htmlFor="startDate">Start Date</Label>
              <Input
                id="startDate"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="endDate">End Date</Label>
              <Input
                id="endDate"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="department">Department</Label>
              <Select value={department} onValueChange={setDepartment}>
                <SelectTrigger>
                  <SelectValue placeholder="All Departments" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Departments</SelectItem>
                  <SelectItem value="Engineering">Engineering</SelectItem>
                  <SelectItem value="Sales">Sales</SelectItem>
                  <SelectItem value="Marketing">Marketing</SelectItem>
                  <SelectItem value="Finance">Finance</SelectItem>
                  <SelectItem value="HR">HR</SelectItem>
                  <SelectItem value="Operations">Operations</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="format">Export Format</Label>
              <Select value={format} onValueChange={setFormat}>
                <SelectTrigger>
                  <SelectValue placeholder="Select format" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="json">View in Browser</SelectItem>
                  <SelectItem value="csv">Download CSV</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="mt-6 flex justify-end">
            <Button onClick={generateReport} loading={loading} disabled={!selectedReport}>
              <BarChart3 className="mr-2 h-4 w-4" />
              Generate Report
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Report Results */}
      {reportData && (
        <Card>
          <CardHeader>
            <CardTitle>Report Results</CardTitle>
            <CardDescription>
              Generated at {new Date(reportData.generatedAt).toLocaleString()}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {selectedReport === "summary" && (
              <div className="space-y-6">
                {/* Status Breakdown */}
                <div>
                  <h4 className="mb-3 font-medium">Status Breakdown</h4>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b">
                          <th className="pb-2 text-left font-medium">Status</th>
                          <th className="pb-2 text-right font-medium">Count</th>
                          <th className="pb-2 text-right font-medium">Total Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {reportData.statusBreakdown?.map((item: any) => (
                          <tr key={item.status} className="border-b">
                            <td className="py-2">{item.status.replace(/_/g, " ")}</td>
                            <td className="py-2 text-right">{item.count}</td>
                            <td className="py-2 text-right">
                              ₹{item.totalAmount?.toLocaleString("en-IN") || 0}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Payment Type Breakdown */}
                <div>
                  <h4 className="mb-3 font-medium">Payment Type Breakdown</h4>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b">
                          <th className="pb-2 text-left font-medium">Payment Type</th>
                          <th className="pb-2 text-right font-medium">Count</th>
                          <th className="pb-2 text-right font-medium">Total Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {reportData.paymentTypeBreakdown?.map((item: any) => (
                          <tr key={item.paymentType} className="border-b">
                            <td className="py-2">{item.paymentType.replace(/_/g, " ")}</td>
                            <td className="py-2 text-right">{item.count}</td>
                            <td className="py-2 text-right">
                              ₹{item.totalAmount?.toLocaleString("en-IN") || 0}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Monthly Trend */}
                {reportData.monthlyTrend && reportData.monthlyTrend.length > 0 && (
                  <div>
                    <h4 className="mb-3 font-medium">Monthly Trend</h4>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b">
                            <th className="pb-2 text-left font-medium">Month</th>
                            <th className="pb-2 text-right font-medium">Count</th>
                            <th className="pb-2 text-right font-medium">Total Amount</th>
                          </tr>
                        </thead>
                        <tbody>
                          {reportData.monthlyTrend.map((item: any) => (
                            <tr key={item.month} className="border-b">
                              <td className="py-2">{item.month}</td>
                              <td className="py-2 text-right">{item.count}</td>
                              <td className="py-2 text-right">
                                ₹{item.amount?.toLocaleString("en-IN") || 0}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}

            {selectedReport === "sla" && (
              <div className="space-y-6">
                {/* Overall Compliance */}
                <div className="grid gap-4 sm:grid-cols-4">
                  <Card>
                    <CardContent className="p-4">
                      <p className="text-sm text-muted-foreground">Total Tracked</p>
                      <p className="text-2xl font-bold">
                        {reportData.overallSLACompliance?.total || 0}
                      </p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4">
                      <p className="text-sm text-muted-foreground">Compliant</p>
                      <p className="text-2xl font-bold text-green-600">
                        {reportData.overallSLACompliance?.compliant || 0}
                      </p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4">
                      <p className="text-sm text-muted-foreground">Breached</p>
                      <p className="text-2xl font-bold text-red-600">
                        {reportData.overallSLACompliance?.breached || 0}
                      </p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4">
                      <p className="text-sm text-muted-foreground">Compliance Rate</p>
                      <p className="text-2xl font-bold">
                        {reportData.overallSLACompliance?.complianceRate?.toFixed(1) || 100}%
                      </p>
                    </CardContent>
                  </Card>
                </div>

                {/* Recent Breaches */}
                {reportData.recentBreaches && reportData.recentBreaches.length > 0 && (
                  <div>
                    <h4 className="mb-3 font-medium">Recent SLA Breaches</h4>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b">
                            <th className="pb-2 text-left font-medium">Reference</th>
                            <th className="pb-2 text-left font-medium">Department</th>
                            <th className="pb-2 text-left font-medium">Level</th>
                            <th className="pb-2 text-right font-medium">Expected (h)</th>
                            <th className="pb-2 text-right font-medium">Actual (h)</th>
                          </tr>
                        </thead>
                        <tbody>
                          {reportData.recentBreaches.map((item: any, index: number) => (
                            <tr key={index} className="border-b">
                              <td className="py-2">{item.referenceNumber}</td>
                              <td className="py-2">{item.department}</td>
                              <td className="py-2">{item.level?.replace(/_/g, " ")}</td>
                              <td className="py-2 text-right">{item.expectedHours}</td>
                              <td className="py-2 text-right text-red-600">
                                {item.actualHours?.toFixed(1)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}

            {selectedReport === "detailed" && reportData.requests && (
              <div>
                <p className="mb-4 text-muted-foreground">
                  Showing {reportData.requests.length} of {reportData.totalRecords} records.
                  Use CSV export for full data.
                </p>
                <div className="max-h-96 overflow-auto">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-background">
                      <tr className="border-b">
                        <th className="pb-2 text-left font-medium">Reference</th>
                        <th className="pb-2 text-left font-medium">Requester</th>
                        <th className="pb-2 text-left font-medium">Department</th>
                        <th className="pb-2 text-right font-medium">Amount</th>
                        <th className="pb-2 text-left font-medium">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reportData.requests.slice(0, 50).map((item: any) => (
                        <tr key={item.referenceNumber} className="border-b">
                          <td className="py-2">{item.referenceNumber}</td>
                          <td className="py-2">{item.requester}</td>
                          <td className="py-2">{item.department}</td>
                          <td className="py-2 text-right">
                            ₹{item.totalAmountINR?.toLocaleString("en-IN") || 0}
                          </td>
                          <td className="py-2">{item.status?.replace(/_/g, " ")}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Other report types can be added similarly */}
            {!["summary", "sla", "detailed"].includes(selectedReport || "") && (
              <pre className="max-h-96 overflow-auto rounded-lg bg-muted p-4 text-sm">
                {JSON.stringify(reportData, null, 2)}
              </pre>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
