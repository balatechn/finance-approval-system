"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import { useSession } from "next-auth/react"
import {
  ArrowLeft,
  CheckCircle,
  XCircle,
  ArrowLeftCircle,
  FileText,
  Download,
  AlertTriangle,
  DollarSign,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import { StatusBadge, ApprovalLevelBadge } from "@/components/status-badge"
import { ApprovalTimeline } from "@/components/approval-timeline"
import { formatCurrency, formatDate, formatDateTime } from "@/lib/utils"
import { useToast } from "@/hooks/use-toast"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

interface FinanceRequest {
  id: string
  referenceNumber: string
  itemName: string | null
  purpose: string
  paymentType: string
  paymentMode: string
  totalAmount: number
  currency: string
  exchangeRate: number
  totalAmountINR: number
  status: string
  currentApprovalLevel: string | null
  department: string
  costCenter: string
  entity: string
  vendorName: string
  vendorCode: string | null
  bankAccountNumber: string | null
  bankName: string | null
  ifscCode: string | null
  upiId: string | null
  panNumber: string | null
  invoiceNumber: string | null
  invoiceDate: string | null
  isGSTApplicable: boolean
  gstPercentage: number | null
  isTDSApplicable: boolean
  tdsPercentage: number | null
  netPayableAmount: number | null
  remarks: string | null
  createdAt: string
  updatedAt: string
  requester: {
    name: string
    email: string
    employeeId: string
    department: string
  }
  approvalSteps: Array<{
    id: string
    level: string
    status: string
    approverName: string | null
    completedAt: string | null
    comments: string | null
    isOverdue: boolean
    slaHours: number
  }>
  attachments: Array<{
    id: string
    fileName: string
    fileUrl: string
    fileSize: number
  }>
}

export default function ApprovalDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { data: session } = useSession()
  const { toast } = useToast()
  const [request, setRequest] = useState<FinanceRequest | null>(null)
  const [loading, setLoading] = useState(true)
  const [actionDialogOpen, setActionDialogOpen] = useState(false)
  const [disbursementDialogOpen, setDisbursementDialogOpen] = useState(false)
  const [currentAction, setCurrentAction] = useState<"APPROVED" | "REJECTED" | "SENT_BACK">("APPROVED")
  const [comments, setComments] = useState("")
  const [paymentReference, setPaymentReference] = useState("")
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split("T")[0])
  const [disbursementPaymentMode, setDisbursementPaymentMode] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  const referenceNumber = params.referenceNumber as string

  useEffect(() => {
    async function fetchRequest() {
      try {
        const response = await fetch(`/api/finance-requests/${referenceNumber}`)
        if (response.ok) {
          const data = await response.json()
          setRequest(data)
        } else if (response.status === 404) {
          toast({
            title: "Not Found",
            description: "Request not found",
            variant: "destructive",
          })
          router.push("/dashboard/approvals")
        }
      } catch (error) {
        console.error("Failed to fetch request:", error)
      } finally {
        setLoading(false)
      }
    }

    fetchRequest()
  }, [referenceNumber, router, toast])

  const handleAction = async () => {
    if (currentAction !== "APPROVED" && !comments.trim()) {
      toast({
        title: "Comments Required",
        description: "Please provide comments for rejection or sending back",
        variant: "destructive",
      })
      return
    }

    try {
      setIsSubmitting(true)

      const response = await fetch(`/api/finance-requests/${referenceNumber}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: currentAction,
          comments: comments.trim() || undefined,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Action failed")
      }

      const actionLabels = {
        APPROVED: "approved",
        REJECTED: "rejected",
        SENT_BACK: "sent back",
      }

      toast({
        title: "Action Completed",
        description: `Request has been ${actionLabels[currentAction]}`,
        variant: "success",
      })

      router.push("/dashboard/approvals")
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to process action",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
      setActionDialogOpen(false)
    }
  }

  const handleDisburse = async () => {
    if (!paymentReference.trim()) {
      toast({ title: "Required", description: "Payment reference / UTR number is required", variant: "destructive" })
      return
    }
    if (!disbursementPaymentMode) {
      toast({ title: "Required", description: "Please select a payment mode", variant: "destructive" })
      return
    }
    if (!paymentDate) {
      toast({ title: "Required", description: "Payment date is required", variant: "destructive" })
      return
    }
    try {
      setIsSubmitting(true)

      const response = await fetch(`/api/finance-requests/${referenceNumber}/disburse`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paymentReferenceNumber: paymentReference.trim(),
          actualPaymentDate: paymentDate,
          disbursementPaymentMode: disbursementPaymentMode,
          disbursementRemarks: comments.trim() || undefined,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Disbursement failed")
      }

      toast({
        title: "Payment Disbursed",
        description: "The payment has been processed successfully",
        variant: "success",
      })

      router.push("/dashboard/approvals")
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to process disbursement",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
      setDisbursementDialogOpen(false)
    }
  }

  const openActionDialog = (action: "APPROVED" | "REJECTED" | "SENT_BACK") => {
    setCurrentAction(action)
    setComments("")
    setActionDialogOpen(true)
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    )
  }

  if (!request) {
    return null
  }

  const isPendingDisbursement = request.status === "APPROVED" && (
    session?.user?.role === "FINANCE_TEAM" || session?.user?.role === "ADMIN"
  )
  const currentStep = request.approvalSteps.find((s) => s.level === request.currentApprovalLevel)
  const isOverdue = currentStep?.isOverdue

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <Link href="/dashboard/approvals">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-gray-900">
                {request.referenceNumber}
              </h1>
              <StatusBadge status={request.status as any} />
              {isOverdue && (
                <Badge variant="destructive">Overdue</Badge>
              )}
            </div>
            <p className="text-muted-foreground">
              Submitted on {formatDate(request.createdAt)} by {request.requester.name}
            </p>
          </div>
        </div>
      </div>

      {/* Overdue Alert */}
      {isOverdue && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="flex items-center gap-3 p-4">
            <AlertTriangle className="h-5 w-5 text-red-600" />
            <div>
              <p className="font-medium text-red-800">SLA Breached</p>
              <p className="text-sm text-red-700">
                This request has exceeded the expected approval time. Please take action immediately.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Action Buttons */}
      <Card>
        <CardHeader>
          <CardTitle>Take Action</CardTitle>
          <CardDescription>
            Review the request details and take appropriate action
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            {isPendingDisbursement ? (
              <Button
                onClick={() => {
                  setComments("")
                  setPaymentReference("")
                  setDisbursementDialogOpen(true)
                }}
                className="bg-green-600 hover:bg-green-700"
              >
                <DollarSign className="mr-2 h-4 w-4" />
                Process Disbursement
              </Button>
            ) : (
              <>
                <Button
                  onClick={() => openActionDialog("APPROVED")}
                  className="bg-green-600 hover:bg-green-700"
                >
                  <CheckCircle className="mr-2 h-4 w-4" />
                  Approve
                </Button>
                <Button
                  onClick={() => openActionDialog("SENT_BACK")}
                  variant="outline"
                  className="border-amber-500 text-amber-600 hover:bg-amber-50"
                >
                  <ArrowLeftCircle className="mr-2 h-4 w-4" />
                  Send Back
                </Button>
                <Button
                  onClick={() => openActionDialog("REJECTED")}
                  variant="destructive"
                >
                  <XCircle className="mr-2 h-4 w-4" />
                  Reject
                </Button>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main Content */}
        <div className="space-y-6 lg:col-span-2">
          {/* Request Summary */}
          <Card>
            <CardHeader>
              <CardTitle>Request Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <h4 className="font-medium text-muted-foreground">Purpose</h4>
                <p className="mt-1 text-lg">{request.purpose}</p>
              </div>

              {request.itemName && (
                <div>
                  <h4 className="font-medium text-muted-foreground">Item Name</h4>
                  <p className="mt-1 font-medium">{request.itemName}</p>
                </div>
              )}

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <p className="text-sm text-muted-foreground">Payment Type</p>
                  <p className="font-medium">{request.paymentType.replace("_", " ")}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Payment Mode</p>
                  <p className="font-medium">{request.paymentMode.replace("_", " ")}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Department</p>
                  <p className="font-medium">{request.department}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Cost Center</p>
                  <p className="font-medium">{request.costCenter}</p>
                </div>
              </div>

              <Separator />

              {/* Requester Info */}
              <div>
                <h4 className="mb-3 font-medium">Requester Details</h4>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <p className="text-sm text-muted-foreground">Name</p>
                    <p className="font-medium">{request.requester.name}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Employee ID</p>
                    <p className="font-medium">{request.requester.employeeId}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Email</p>
                    <p className="font-medium">{request.requester.email}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Department</p>
                    <p className="font-medium">{request.requester.department}</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Amount Details */}
          <Card>
            <CardHeader>
              <CardTitle>Amount Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-lg bg-primary/5 p-4">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Total Amount</span>
                  <span className="text-2xl font-bold">
                    {formatCurrency(request.totalAmountINR)}
                  </span>
                </div>
                {request.currency !== "INR" && (
                  <p className="mt-1 text-sm text-muted-foreground">
                    {request.currency} {request.totalAmount.toLocaleString()} @ {request.exchangeRate}
                  </p>
                )}
              </div>

              {(request.isGSTApplicable || request.isTDSApplicable) && (
                <div className="flex gap-2">
                  {request.isGSTApplicable && (
                    <Badge variant="info">GST {request.gstPercentage}%</Badge>
                  )}
                  {request.isTDSApplicable && (
                    <Badge variant="warning">TDS {request.tdsPercentage}%</Badge>
                  )}
                </div>
              )}

              {request.netPayableAmount && (
                <div className="rounded-lg bg-green-50 p-4">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-green-800">Net Payable</span>
                    <span className="text-xl font-bold text-green-800">
                      {formatCurrency(request.netPayableAmount)}
                    </span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Vendor Details */}
          <Card>
            <CardHeader>
              <CardTitle>Vendor / Payee Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <p className="text-sm text-muted-foreground">Vendor Name</p>
                  <p className="font-medium">{request.vendorName}</p>
                </div>
                {request.vendorCode && (
                  <div>
                    <p className="text-sm text-muted-foreground">Vendor Code</p>
                    <p className="font-medium">{request.vendorCode}</p>
                  </div>
                )}
              </div>

              {request.bankAccountNumber && (
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <p className="text-sm text-muted-foreground">Account Number</p>
                    <p className="font-medium">{request.bankAccountNumber}</p>
                  </div>
                  {request.bankName && (
                    <div>
                      <p className="text-sm text-muted-foreground">Bank Name</p>
                      <p className="font-medium">{request.bankName}</p>
                    </div>
                  )}
                  {request.ifscCode && (
                    <div>
                      <p className="text-sm text-muted-foreground">IFSC Code</p>
                      <p className="font-medium">{request.ifscCode}</p>
                    </div>
                  )}
                </div>
              )}

              {request.upiId && (
                <div>
                  <p className="text-sm text-muted-foreground">UPI ID</p>
                  <p className="font-medium">{request.upiId}</p>
                </div>
              )}

              {request.panNumber && (
                <div>
                  <p className="text-sm text-muted-foreground">PAN Number</p>
                  <p className="font-medium">{request.panNumber}</p>
                </div>
              )}

              {request.invoiceNumber && (
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <p className="text-sm text-muted-foreground">Invoice Number</p>
                    <p className="font-medium">{request.invoiceNumber}</p>
                  </div>
                  {request.invoiceDate && (
                    <div>
                      <p className="text-sm text-muted-foreground">Invoice Date</p>
                      <p className="font-medium">{formatDate(request.invoiceDate)}</p>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Attachments */}
          {request.attachments && request.attachments.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Attachments</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {request.attachments.map((attachment) => (
                    <div
                      key={attachment.id}
                      className="flex items-center justify-between rounded-lg border p-3"
                    >
                      <div className="flex items-center gap-3">
                        <FileText className="h-5 w-5 text-muted-foreground" />
                        <div>
                          <p className="font-medium">{attachment.fileName}</p>
                          <p className="text-xs text-muted-foreground">
                            {(attachment.fileSize / 1024).toFixed(1)} KB
                          </p>
                        </div>
                      </div>
                      <Button variant="ghost" size="sm" asChild>
                        <a href={attachment.fileUrl} download>
                          <Download className="h-4 w-4" />
                        </a>
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Remarks */}
          {request.remarks && (
            <Card>
              <CardHeader>
                <CardTitle>Remarks</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">{request.remarks}</p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar - Approval Timeline */}
        <div>
          <Card className="sticky top-4">
            <CardHeader>
              <CardTitle>Approval Progress</CardTitle>
              <CardDescription>
                Current Stage:{" "}
                <ApprovalLevelBadge level={request.currentApprovalLevel as any} />
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ApprovalTimeline
                steps={request.approvalSteps}
                currentLevel={request.currentApprovalLevel as any}
              />
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Action Dialog */}
      <Dialog open={actionDialogOpen} onOpenChange={setActionDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {currentAction === "APPROVED" && "Approve Request"}
              {currentAction === "REJECTED" && "Reject Request"}
              {currentAction === "SENT_BACK" && "Send Back for Revision"}
            </DialogTitle>
            <DialogDescription>
              {currentAction === "APPROVED" &&
                "This will forward the request to the next approval stage."}
              {currentAction === "REJECTED" &&
                "This will permanently reject the request. Please provide a reason."}
              {currentAction === "SENT_BACK" &&
                "This will return the request to the requester for modifications."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="comments">
                Comments {currentAction !== "APPROVED" && "(Required)"}
              </Label>
              <Textarea
                id="comments"
                placeholder="Enter your comments..."
                value={comments}
                onChange={(e) => setComments(e.target.value)}
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setActionDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleAction}
              loading={isSubmitting}
              variant={
                currentAction === "APPROVED"
                  ? "default"
                  : currentAction === "REJECTED"
                  ? "destructive"
                  : "outline"
              }
              className={
                currentAction === "APPROVED"
                  ? "bg-green-600 hover:bg-green-700"
                  : currentAction === "SENT_BACK"
                  ? "border-amber-500 text-amber-600 hover:bg-amber-50"
                  : ""
              }
            >
              {currentAction === "APPROVED" && "Approve"}
              {currentAction === "REJECTED" && "Reject"}
              {currentAction === "SENT_BACK" && "Send Back"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Disbursement Dialog */}
      <Dialog open={disbursementDialogOpen} onOpenChange={setDisbursementDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Process Disbursement</DialogTitle>
            <DialogDescription>
              Enter the payment details to complete the disbursement.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {/* Amount Summary */}
            <div className="rounded-lg bg-green-50 border border-green-200 p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-green-700">Amount to Disburse</span>
                <span className="text-xl font-bold text-green-800">
                  {formatCurrency(request.netPayableAmount || request.totalAmountINR)}
                </span>
              </div>
              <div className="mt-1 text-xs text-green-600">
                {request.vendorName} &bull; {request.referenceNumber}
              </div>
            </div>

            {/* Payment Mode */}
            <div className="space-y-2">
              <Label htmlFor="disbursementPaymentMode">Payment Mode *</Label>
              <select
                id="disbursementPaymentMode"
                value={disbursementPaymentMode}
                onChange={(e) => setDisbursementPaymentMode(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:ring-1 focus:ring-primary"
              >
                <option value="">Select payment mode</option>
                <option value="NEFT">NEFT</option>
                <option value="RTGS">RTGS</option>
                <option value="UPI">UPI</option>
                <option value="CHEQUE">Cheque</option>
                <option value="BANK_TRANSFER">Bank Transfer</option>
                <option value="DEMAND_DRAFT">Demand Draft</option>
                <option value="CASH">Cash</option>
              </select>
            </div>

            {/* Payment Reference / UTR */}
            <div className="space-y-2">
              <Label htmlFor="paymentReference">Payment Reference / UTR Number *</Label>
              <Input
                id="paymentReference"
                placeholder="Enter UTR / transaction reference number..."
                value={paymentReference}
                onChange={(e) => setPaymentReference(e.target.value)}
              />
            </div>

            {/* Payment Date */}
            <div className="space-y-2">
              <Label htmlFor="paymentDate">Payment Date *</Label>
              <Input
                id="paymentDate"
                type="date"
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
              />
            </div>

            {/* Remarks */}
            <div className="space-y-2">
              <Label htmlFor="disbursementComments">Remarks (Optional)</Label>
              <Textarea
                id="disbursementComments"
                placeholder="Enter any additional notes about the payment..."
                value={comments}
                onChange={(e) => setComments(e.target.value)}
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDisbursementDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleDisburse}
              loading={isSubmitting}
              className="bg-green-600 hover:bg-green-700"
            >
              <DollarSign className="mr-2 h-4 w-4" />
              Confirm Disbursement
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
