"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Plus, Search, Filter, ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { StatusBadge } from "@/components/status-badge"
import { formatCurrency, formatDate } from "@/lib/utils"

interface FinanceRequest {
  id: string
  referenceNumber: string
  purpose: string
  paymentType: string
  totalAmount: number
  currency: string
  totalAmountINR: number
  status: string
  currentApprovalLevel: string | null
  createdAt: string
  requester: {
    name: string
    department: string
  }
}

interface PaginationInfo {
  total: number
  page: number
  limit: number
  pages: number
}

export default function RequestsPage() {
  const [requests, setRequests] = useState<FinanceRequest[]>([])
  const [pagination, setPagination] = useState<PaginationInfo>({
    total: 0,
    page: 1,
    limit: 10,
    pages: 0,
  })
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")

  useEffect(() => {
    fetchRequests()
  }, [pagination.page, statusFilter])

  async function fetchRequests() {
    try {
      setLoading(true)
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
      })
      if (statusFilter !== "all") {
        params.set("status", statusFilter)
      }
      if (search) {
        params.set("search", search)
      }

      const response = await fetch(`/api/finance-requests?${params}`)
      if (response.ok) {
        const data = await response.json()
        setRequests(data.requests)
        setPagination(data.pagination)
      }
    } catch (error) {
      console.error("Failed to fetch requests:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setPagination((prev) => ({ ...prev, page: 1 }))
    fetchRequests()
  }

  const statusOptions = [
    { value: "all", label: "All Statuses" },
    { value: "DRAFT", label: "Draft" },
    { value: "PENDING_FINANCE_VETTING", label: "Pending Vetting" },
    { value: "PENDING_FINANCE_PLANNER", label: "Pending Finance Planner" },
    { value: "PENDING_FINANCE_CONTROLLER", label: "Pending Finance Controller" },
    { value: "PENDING_DIRECTOR", label: "Pending Director" },
    { value: "PENDING_MD", label: "Pending MD" },
    { value: "APPROVED", label: "Approved" },
    { value: "DISBURSED", label: "Disbursed" },
    { value: "REJECTED", label: "Rejected" },
    { value: "SENT_BACK", label: "Sent Back" },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Finance Requests</h1>
          <p className="text-muted-foreground">
            Manage and track all your finance requests
          </p>
        </div>
        <Link href="/dashboard/requests/new">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            New Request
          </Button>
        </Link>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <form onSubmit={handleSearch} className="flex flex-col gap-4 sm:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by reference number or purpose..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select
              value={statusFilter}
              onValueChange={(value) => {
                setStatusFilter(value)
                setPagination((prev) => ({ ...prev, page: 1 }))
              }}
            >
              <SelectTrigger className="w-full sm:w-48">
                <Filter className="mr-2 h-4 w-4" />
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                {statusOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button type="submit" variant="secondary">
              Search
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Requests</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex h-64 items-center justify-center">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            </div>
          ) : requests.length === 0 ? (
            <div className="flex h-64 flex-col items-center justify-center text-center">
              <p className="text-muted-foreground">No requests found</p>
              <Link href="/dashboard/requests/new" className="mt-4">
                <Button variant="outline">Create a new request</Button>
              </Link>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Reference</TableHead>
                      <TableHead>Purpose</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {requests.map((request) => (
                      <TableRow key={request.id}>
                        <TableCell className="font-medium">
                          <Link
                            href={`/dashboard/requests/${request.referenceNumber}`}
                            className="text-primary hover:underline"
                          >
                            {request.referenceNumber}
                          </Link>
                        </TableCell>
                        <TableCell className="max-w-xs truncate">
                          {request.purpose}
                        </TableCell>
                        <TableCell>
                          <span className="rounded bg-muted px-2 py-1 text-xs">
                            {request.paymentType.replace("_", " ")}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium">
                              {formatCurrency(request.totalAmountINR)}
                            </p>
                            {request.currency !== "INR" && (
                              <p className="text-xs text-muted-foreground">
                                {request.currency} {request.totalAmount.toLocaleString()}
                              </p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <StatusBadge status={request.status} />
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {formatDate(request.createdAt)}
                        </TableCell>
                        <TableCell className="text-right">
                          <Link href={`/dashboard/requests/${request.referenceNumber}`}>
                            <Button variant="ghost" size="sm">
                              View
                            </Button>
                          </Link>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination */}
              <div className="mt-4 flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  Showing {(pagination.page - 1) * pagination.limit + 1} to{" "}
                  {Math.min(pagination.page * pagination.limit, pagination.total)} of{" "}
                  {pagination.total} results
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setPagination((prev) => ({ ...prev, page: prev.page - 1 }))
                    }
                    disabled={pagination.page === 1}
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setPagination((prev) => ({ ...prev, page: prev.page + 1 }))
                    }
                    disabled={pagination.page >= pagination.pages}
                  >
                    Next
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
