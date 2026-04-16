"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import Link from "next/link"
import {
  ArrowLeft,
  FileText,
  Download,
  Printer,
  Edit,
  Trash2,
  Clock,
  Building2,
  CreditCard,
  User,
  Calendar,
  AlertTriangle,
  MessageSquare,
  RotateCcw,
  Eye,
  X,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { StatusBadge } from "@/components/status-badge"
import { ApprovalTimeline } from "@/components/approval-timeline"
import { DiscussionThread } from "@/components/discussion-thread"
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
  requestType: string
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
  gstNumber: string | null
  gstAmount: number | null
  isTDSApplicable: boolean
  tdsPercentage: number | null
  tdsSection: string | null
  tdsAmount: number | null
  netPayableAmount: number | null
  remarks: string | null
  createdAt: string
  updatedAt: string
  disbursedAt: string | null
  disbursementReference: string | null
  disbursementPaymentMode: string | null
  disbursementRemarks: string | null
  actualPaymentDate: string | null
  paymentReferenceNumber: string | null
  requester: {
    id: string
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
    fileType: string
    fileSize: number
  }>
}

export default function RequestDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { toast } = useToast()
  const { data: session } = useSession()
  const [request, setRequest] = useState<FinanceRequest | null>(null)
  const [loading, setLoading] = useState(true)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [previewFile, setPreviewFile] = useState<{ url: string; type: string; name: string } | null>(null)
  const [error, setError] = useState<string | null>(null)

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
          router.push("/dashboard/requests")
        } else {
          const errorData = await response.json().catch(() => ({}))
          setError(errorData.error || "Failed to load request")
          toast({
            title: "Error",
            description: errorData.error || "Failed to load request",
            variant: "destructive",
          })
        }
      } catch (error) {
        console.error("Failed to fetch request:", error)
        setError("Network error - please try again")
        toast({
          title: "Network Error",
          description: "Failed to connect. Please check your connection.",
          variant: "destructive",
        })
      } finally {
        setLoading(false)
      }
    }

    fetchRequest()
  }, [referenceNumber, router, toast])

  const handleDelete = async () => {
    try {
      setIsDeleting(true)
      const response = await fetch(`/api/finance-requests/${referenceNumber}`, {
        method: "DELETE",
      })

      if (response.ok) {
        toast({
          title: "Request Deleted",
          description: "The request has been deleted successfully",
          variant: "success",
        })
        router.push("/dashboard/requests")
      } else {
        throw new Error("Failed to delete request")
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete request",
        variant: "destructive",
      })
    } finally {
      setIsDeleting(false)
      setDeleteDialogOpen(false)
    }
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    )
  }

  if (!request) {
    return (
      <div className="flex flex-col items-center justify-center h-64 space-y-4">
        <AlertTriangle className="h-12 w-12 text-amber-500" />
        <p className="text-lg font-medium text-gray-700">
          {error || "Unable to load request"}
        </p>
        <Link href="/dashboard/requests">
          <Button variant="outline">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Requests
          </Button>
        </Link>
      </div>
    )
  }

  const userRole = session?.user?.role
  const isOwner = session?.user?.id === request.requester?.id
  const isAdmin = userRole === "ADMIN"
  // Only owner or admin can edit, and only for specific statuses
  const editableStatuses = ["DRAFT", "SENT_BACK", "SUBMITTED", "PENDING_FINANCE_VETTING"]
  const canEdit = (isOwner || isAdmin) && editableStatuses.includes(request.status)
  const canDelete = (isOwner || isAdmin) && (request.status === "DRAFT" || isAdmin)
  const isSentBack = request.status === "SENT_BACK"

  // Extract sent-back comments from approval steps
  const sentBackComments = request.approvalSteps
    .filter((step) => step.status === "COMPLETED" && step.comments)
    .map((step) => ({
      approverName: step.approverName || "Approver",
      level: step.level,
      comments: step.comments!,
      completedAt: step.completedAt,
    }))

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <Link href="/dashboard/requests">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-bold text-gray-900">
                {request.referenceNumber}
              </h1>
              <StatusBadge status={request.status as any} />
              <Badge variant={request.requestType === "EXPENSE_APPROVAL" ? "warning" : "info"}>
                {request.requestType === "EXPENSE_APPROVAL" ? "Expense Approval" : "Payment Approval"}
              </Badge>
            </div>
            <p className="text-muted-foreground">
              Created on {formatDate(request.createdAt)}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => window.print()}>
            <Printer className="mr-2 h-4 w-4" />
            Print
          </Button>
          {request.requestType === "EXPENSE_APPROVAL" && request.status === "EXPENSE_APPROVED" && (
            <>
              <Button
                size="sm"
                className="bg-amber-700 hover:bg-amber-800 text-gray-900"
                onClick={async () => {
                  try {
                    const res = await fetch(`/api/finance-requests/${request.id}/generate-po`)
                    if (res.ok) {
                      const blob = await res.blob()
                      const url = URL.createObjectURL(blob)
                      window.open(url, '_blank')
                    } else {
                      const err = await res.json()
                      toast({ title: "Error", description: err.error, variant: "destructive" })
                    }
                  } catch { toast({ title: "Error", description: "Failed to generate PO", variant: "destructive" }) }
                }}
              >
                <FileText className="mr-2 h-4 w-4" />
                View PO
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={async () => {
                  try {
                    const res = await fetch(`/api/finance-requests/${request.id}/generate-po`)
                    if (res.ok) {
                      const blob = await res.blob()
                      const url = URL.createObjectURL(blob)
                      const a = document.createElement('a')
                      a.href = url
                      a.download = `PO-${request.referenceNumber}.pdf`
                      a.click()
                      URL.revokeObjectURL(url)
                    }
                  } catch { toast({ title: "Error", description: "Failed to download PO", variant: "destructive" }) }
                }}
              >
                <Download className="mr-2 h-4 w-4" />
                Download PO
              </Button>
            </>
          )}
          {isSentBack && (
            <Link href={`/dashboard/requests/${referenceNumber}/edit`}>
              <Button size="sm" className="bg-amber-600 hover:bg-amber-700">
                <RotateCcw className="mr-2 h-4 w-4" />
                Edit & Resubmit
              </Button>
            </Link>
          )}
          {canEdit && !isSentBack && (
            <Link href={`/dashboard/requests/${referenceNumber}/edit`}>
              <Button variant="outline" size="sm">
                <Edit className="mr-2 h-4 w-4" />
                Edit
              </Button>
            </Link>
          )}
          {canDelete && (
            <Button
              variant="outline"
              size="sm"
              className="text-red-600 hover:text-red-700"
              onClick={() => setDeleteDialogOpen(true)}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </Button>
          )}
        </div>
      </div>

      {/* Sent Back Banner */}
      {isSentBack && (
        <Card className="border-amber-300 bg-amber-50">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-amber-700">
              <AlertTriangle className="h-5 w-5" />
              Request Sent Back for More Information
            </CardTitle>
            <CardDescription className="text-amber-700">
              An approver has sent this request back requesting additional details or corrections.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {sentBackComments.length > 0 ? (
              <div className="space-y-3">
                {sentBackComments.map((comment, index) => (
                  <div key={index} className="rounded-lg border border-amber-500/30 bg-white/70 backdrop-blur-sm p-3">
                    <div className="flex items-start gap-2">
                      <MessageSquare className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="text-sm font-medium text-amber-200">
                          {comment.approverName} ({comment.level.replace(/_/g, " ")})
                        </p>
                        <p className="mt-1 text-sm text-amber-700">{comment.comments}</p>
                        {comment.completedAt && (
                          <p className="mt-1 text-xs text-amber-600">
                            {new Date(comment.completedAt).toLocaleString()}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-amber-700">
                Please review your request and click "Edit & Resubmit" to make changes.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Main Content */}
        <div className="space-y-4 lg:col-span-2">
          {/* Request Summary */}
          <Card>
            <CardHeader className="py-3 px-4">
              <CardTitle className="text-base">Request Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 px-4 pb-4">
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

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="flex items-center gap-2">
                  <div className="rounded-lg bg-muted p-1.5">
                    <CreditCard className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Payment Type</p>
                    <p className="text-sm font-medium">{request.paymentType.replace("_", " ")}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="rounded-lg bg-muted p-1.5">
                    <Building2 className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Department</p>
                    <p className="text-sm font-medium">{request.department}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="rounded-lg bg-muted p-1.5">
                    <User className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Requested By</p>
                    <p className="text-sm font-medium">{request.requester.name}</p>
                    <p className="text-xs text-muted-foreground">{request.requester.employeeId}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="rounded-lg bg-muted p-1.5">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Last Updated</p>
                    <p className="text-sm font-medium">{formatDateTime(request.updatedAt)}</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Discussion Thread */}
          <DiscussionThread 
            requestId={request.id}
            referenceNumber={request.referenceNumber}
          />

          {/* Amount Details */}
          <Card>
            <CardHeader className="py-3 px-4">
              <CardTitle className="text-base">Amount Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 px-4 pb-4">
              <div className="rounded-lg bg-primary/5 p-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Total Amount</span>
                  <span className="text-xl font-bold">
                    {formatCurrency(request.totalAmountINR)}
                  </span>
                </div>
                {request.currency !== "INR" && (
                  <p className="mt-1 text-sm text-muted-foreground">
                    {request.currency} {request.totalAmount.toLocaleString()} @ {request.exchangeRate}
                  </p>
                )}
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <div>
                  <p className="text-xs text-muted-foreground">Payment Mode</p>
                  <p className="text-sm font-medium">{request.paymentMode.replace("_", " ")}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Cost Center</p>
                  <p className="text-sm font-medium">{request.costCenter}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Entity</p>
                  <p className="text-sm font-medium">{request.entity}</p>
                </div>
              </div>

              {(request.isGSTApplicable || request.isTDSApplicable) && (
                <>
                  <Separator />
                  <div className="space-y-3">
                    <h4 className="font-medium">Tax Details</h4>
                    <div className="grid gap-4 sm:grid-cols-2">
                      {request.isGSTApplicable && (
                        <div className="rounded-lg border p-3">
                          <div className="flex items-center justify-between">
                            <span className="text-sm">GST ({request.gstPercentage}%)</span>
                            <Badge variant="info">Applicable</Badge>
                          </div>
                          {request.gstNumber && (
                            <p className="mt-1 text-xs text-muted-foreground">
                              GSTIN: {request.gstNumber}
                            </p>
                          )}
                        </div>
                      )}
                      {request.isTDSApplicable && (
                        <div className="rounded-lg border p-3">
                          <div className="flex items-center justify-between">
                            <span className="text-sm">TDS ({request.tdsPercentage}%)</span>
                            <Badge variant="warning">Applicable</Badge>
                          </div>
                          {request.tdsSection && (
                            <p className="mt-1 text-xs text-muted-foreground">
                              Section: {request.tdsSection}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}

              {request.netPayableAmount && (
                <div className="rounded-lg bg-emerald-50 p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-emerald-700">Net Payable</span>
                    <span className="text-lg font-bold text-emerald-700">
                      {formatCurrency(request.netPayableAmount)}
                    </span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Vendor Details */}
          <Card>
            <CardHeader className="py-3 px-4">
              <CardTitle className="text-base">Vendor / Payee Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 px-4 pb-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <p className="text-xs text-muted-foreground">Vendor Name</p>
                  <p className="text-sm font-medium">{request.vendorName}</p>
                </div>
                {request.vendorCode && (
                  <div>
                    <p className="text-xs text-muted-foreground">Vendor Code</p>
                    <p className="text-sm font-medium">{request.vendorCode}</p>
                  </div>
                )}
              </div>

              {(request.bankAccountNumber || request.upiId) && (
                <>
                  <Separator />
                  <h4 className="text-sm font-medium">Payment Information</h4>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {request.bankAccountNumber && (
                      <>
                        <div>
                          <p className="text-xs text-muted-foreground">Account Number</p>
                          <p className="text-sm font-medium">{request.bankAccountNumber}</p>
                        </div>
                        {request.bankName && (
                          <div>
                            <p className="text-xs text-muted-foreground">Bank Name</p>
                            <p className="text-sm font-medium">{request.bankName}</p>
                          </div>
                        )}
                        {request.ifscCode && (
                          <div>
                            <p className="text-xs text-muted-foreground">IFSC Code</p>
                            <p className="text-sm font-medium">{request.ifscCode}</p>
                          </div>
                        )}
                      </>
                    )}
                    {request.upiId && (
                      <div>
                        <p className="text-xs text-muted-foreground">UPI ID</p>
                        <p className="text-sm font-medium">{request.upiId}</p>
                      </div>
                    )}
                    {request.panNumber && (
                      <div>
                        <p className="text-xs text-muted-foreground">PAN Number</p>
                        <p className="text-sm font-medium">{request.panNumber}</p>
                      </div>
                    )}  
                  </div>
                </>
              )}

              {(request.invoiceNumber || request.invoiceDate) && (
                <>
                  <Separator />
                  <h4 className="text-sm font-medium">Invoice Details</h4>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {request.invoiceNumber && (
                      <div>
                        <p className="text-xs text-muted-foreground">Invoice Number</p>
                        <p className="text-sm font-medium">{request.invoiceNumber}</p>
                      </div>
                    )}
                    {request.invoiceDate && (
                      <div>
                        <p className="text-xs text-muted-foreground">Invoice Date</p>
                        <p className="text-sm font-medium">{formatDate(request.invoiceDate)}</p>
                      </div>
                    )}
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Attachments */}
          {request.attachments && request.attachments.length > 0 && (
            <Card>
              <CardHeader className="py-3 px-4">
                <CardTitle className="text-base">Attachments ({request.attachments.length})</CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                <div className="grid gap-2 sm:grid-cols-2">
                  {request.attachments.map((attachment) => {
                    const isImage = attachment.fileUrl?.startsWith('data:image/') || 
                      /\.(jpg|jpeg|png|gif|webp|bmp|svg)$/i.test(attachment.fileName)
                    const isPdf = attachment.fileUrl?.startsWith('data:application/pdf') ||
                      /\.pdf$/i.test(attachment.fileName)
                    
                    return (
                      <div
                        key={attachment.id}
                        className="group relative flex items-start gap-3 rounded-lg border bg-white/70 backdrop-blur-sm p-3 hover:shadow-sm transition-shadow"
                      >
                        {/* Thumbnail */}
                        <div className="flex-shrink-0 h-16 w-16 rounded-md overflow-hidden bg-white/70 backdrop-blur-sm flex items-center justify-center">
                          {isImage ? (
                            <img
                              src={attachment.fileUrl}
                              alt={attachment.fileName}
                              className="h-full w-full object-cover cursor-pointer"
                              onClick={() => setPreviewFile({ url: attachment.fileUrl, type: 'image', name: attachment.fileName })}
                            />
                          ) : isPdf ? (
                            <FileText className="h-8 w-8 text-red-600" />
                          ) : (
                            <FileText className="h-8 w-8 text-blue-500" />
                          )}
                        </div>

                        {/* File info */}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{attachment.fileName}</p>
                          <p className="text-xs text-muted-foreground">
                            {(attachment.fileSize / 1024).toFixed(1)} KB
                          </p>
                          <div className="flex gap-2 mt-1.5">
                            {(isImage || isPdf) && (
                              <button
                                className="text-xs text-primary hover:underline flex items-center gap-1"
                                onClick={() => setPreviewFile({ 
                                  url: attachment.fileUrl, 
                                  type: isPdf ? 'pdf' : 'image', 
                                  name: attachment.fileName 
                                })}
                              >
                                <Eye className="h-3 w-3" /> View
                              </button>
                            )}
                            <a
                              href={attachment.fileUrl}
                              download={attachment.fileName}
                              className="text-xs text-gray-500 hover:underline flex items-center gap-1"
                            >
                              <Download className="h-3 w-3" /> Download
                            </a>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Attachment Preview Modal */}
          {previewFile && (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
              onClick={() => setPreviewFile(null)}
            >
              <div
                className="relative max-h-[90vh] max-w-[90vw] bg-white/70 backdrop-blur-sm rounded-xl overflow-hidden shadow-lg"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between border-b px-4 py-3">
                  <p className="text-sm font-medium truncate max-w-md">{previewFile.name}</p>
                  <button
                    className="rounded-full p-1 hover:bg-white/60"
                    onClick={() => setPreviewFile(null)}
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
                <div className="p-4 flex items-center justify-center max-h-[80vh] overflow-auto">
                  {previewFile.type === 'image' ? (
                    <img
                      src={previewFile.url}
                      alt={previewFile.name}
                      className="max-h-[75vh] max-w-full object-contain"
                    />
                  ) : previewFile.type === 'pdf' ? (
                    <iframe
                      src={previewFile.url}
                      className="h-[75vh] w-[70vw]"
                      title={previewFile.name}
                    />
                  ) : (
                    <div className="text-center py-12">
                      <FileText className="h-16 w-16 mx-auto text-gray-400 mb-4" />
                      <p className="text-muted-foreground">Preview not available for this file type</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Remarks */}
          {request.remarks && (
            <Card>
              <CardHeader className="py-3 px-4">
                <CardTitle className="text-base">Remarks</CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                <p className="text-sm text-muted-foreground">{request.remarks}</p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar - Approval Timeline */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="py-3 px-4">
              <CardTitle className="text-base flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Approval Timeline
              </CardTitle>
              <CardDescription className="text-xs">Track the approval progress</CardDescription>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <ApprovalTimeline
                steps={request.approvalSteps}
                currentLevel={request.currentApprovalLevel as any}
                requestType={request.requestType}
              />
            </CardContent>
          </Card>

          {/* Disbursement Info */}
          {request.status === "DISBURSED" && (
            <Card className="border-emerald-500/30 bg-emerald-50">
              <CardHeader className="py-3 px-4">
                <CardTitle className="text-base text-emerald-700">Payment Disbursed</CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  {(request.actualPaymentDate || request.disbursedAt) && (
                    <div>
                      <p className="text-xs text-emerald-700">Payment Date</p>
                      <p className="text-sm font-medium text-emerald-700">
                        {formatDateTime(request.actualPaymentDate || request.disbursedAt || "")}
                      </p>
                    </div>
                  )}
                  {request.disbursementPaymentMode && (
                    <div>
                      <p className="text-xs text-emerald-700">Payment Mode</p>
                      <p className="text-sm font-medium text-emerald-700">
                        {request.disbursementPaymentMode.replace(/_/g, " ")}
                      </p>
                    </div>
                  )}
                  {(request.paymentReferenceNumber || request.disbursementReference) && (
                    <div>
                      <p className="text-xs text-emerald-700">UTR / Reference Number</p>
                      <p className="text-sm font-medium text-emerald-700">
                        {request.paymentReferenceNumber || request.disbursementReference}
                      </p>
                    </div>
                  )}
                  {request.disbursementRemarks && (
                    <div>
                      <p className="text-xs text-emerald-700">Remarks</p>
                      <p className="text-sm font-medium text-emerald-700">
                        {request.disbursementRemarks}
                      </p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Request</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this request? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              loading={isDeleting}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
