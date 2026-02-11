"use client"

import { useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import {
  FileText,
  Clock,
  CheckCircle,
  TrendingUp,
  IndianRupee,
} from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { formatCurrency } from "@/lib/utils"

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
}

export default function DashboardPage() {
  const { data: session } = useSession()
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchDashboard() {
      try {
        const response = await fetch("/api/dashboard")
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
  }, [])

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
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          Welcome back, {session?.user?.name?.split(" ")[0]}!
        </h1>
        <p className="text-muted-foreground">
          Here&apos;s an overview of your finance activity
        </p>
      </div>

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

      {/* This Month Summary */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center gap-4">
            <div className="rounded-full bg-primary/10 p-3">
              <TrendingUp className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h3 className="font-medium">This Month</h3>
              <p className="text-sm text-muted-foreground">
                {stats.thisMonthCount} requests totaling{" "}
                {formatCurrency(stats.thisMonthAmount)}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
