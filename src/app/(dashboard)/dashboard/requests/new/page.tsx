"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { useForm, Controller } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { ArrowLeft, Upload, X, Info } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Separator } from "@/components/ui/separator"
import { useToast } from "@/hooks/use-toast"
import { createFinanceRequestSchema, type CreateFinanceRequestInput } from "@/lib/validations/finance-request"

const paymentTypes = [
  { value: "PETTY_CASH", label: "Petty Cash" },
  { value: "INVOICE", label: "Invoice" },
  { value: "ADVANCE", label: "Advance" },
  { value: "REIMBURSEMENT", label: "Reimbursement" },
  { value: "VENDOR_PAYMENT", label: "Vendor Payment" },
  { value: "SALARY", label: "Salary" },
  { value: "BONUS", label: "Bonus" },
  { value: "OTHER", label: "Other" },
]

const paymentModes = [
  { value: "BANK_TRANSFER", label: "Bank Transfer" },
  { value: "CHEQUE", label: "Cheque" },
  { value: "UPI", label: "UPI" },
  { value: "CASH", label: "Cash" },
  { value: "DEMAND_DRAFT", label: "Demand Draft" },
]

const currencies = [
  { value: "INR", label: "INR - Indian Rupee" },
  { value: "USD", label: "USD - US Dollar" },
  { value: "EUR", label: "EUR - Euro" },
  { value: "GBP", label: "GBP - British Pound" },
]

export default function NewRequestPage() {
  const router = useRouter()
  const { toast } = useToast()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const isDraftRef = useRef(false)
  const [departments, setDepartments] = useState<{ id: string; name: string }[]>([])
  const [costCenters, setCostCenters] = useState<{ id: string; code: string; name: string }[]>([])
  const [entities, setEntities] = useState<{ id: string; code: string; name: string }[]>([])

  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    formState: { errors },
  } = useForm<CreateFinanceRequestInput>({
    resolver: zodResolver(createFinanceRequestSchema),
    defaultValues: {
      currency: "INR",
      exchangeRate: 1,
      isGSTApplicable: false,
      isTDSApplicable: false,
      saveAsDraft: false,
      status: "DRAFT",
    },
  })

  const paymentMode = watch("paymentMode")
  const isGSTApplicable = watch("isGSTApplicable")
  const isTDSApplicable = watch("isTDSApplicable")
  const currency = watch("currency")
  const totalAmount = watch("totalAmount")
  const exchangeRate = watch("exchangeRate") || 1

  // Calculate INR amount
  useEffect(() => {
    if (totalAmount && exchangeRate) {
      const inrAmount = totalAmount * exchangeRate
      setValue("totalAmountINR", inrAmount)
    }
  }, [totalAmount, exchangeRate, setValue])

  // Fetch reference data
  useEffect(() => {
    // In a real app, fetch from API
    setDepartments([
      { id: "1", name: "Engineering" },
      { id: "2", name: "Sales" },
      { id: "3", name: "Marketing" },
      { id: "4", name: "Finance" },
      { id: "5", name: "HR" },
      { id: "6", name: "Operations" },
    ])
    setCostCenters([
      { id: "1", code: "CC001", name: "IT Infrastructure" },
      { id: "2", code: "CC002", name: "Marketing Campaigns" },
      { id: "3", code: "CC003", name: "Operations" },
      { id: "4", code: "CC004", name: "R&D" },
    ])
    setEntities([
      { id: "1", code: "CORP", name: "Corporate" },
      { id: "2", code: "SUB1", name: "Subsidiary 1" },
      { id: "3", code: "SUB2", name: "Subsidiary 2" },
    ])
  }, [])

  const onSubmit = async (data: CreateFinanceRequestInput) => {
    try {
      setIsSubmitting(true)

      // Override status based on which button was clicked
      const submitData = {
        ...data,
        saveAsDraft: isDraftRef.current,
        status: isDraftRef.current ? "DRAFT" as const : "SUBMITTED" as const,
      }

      const response = await fetch("/api/finance-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(submitData),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to create request")
      }

      const result = await response.json()

      toast({
        title: isDraftRef.current ? "Draft Saved" : "Request Submitted",
        description: `Reference number: ${result.referenceNumber}`,
        variant: "success",
      })

      router.push(`/dashboard/requests/${result.referenceNumber}`)
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to create request",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/dashboard/requests">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">New Finance Request</h1>
          <p className="text-muted-foreground">
            Fill in the details to create a new finance request
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit, (validationErrors) => {
        console.error("Form validation errors:", validationErrors)
        const firstError = Object.values(validationErrors)[0]
        toast({
          title: "Validation Error",
          description: (firstError?.message as string) || "Please fill in all required fields",
          variant: "destructive",
        })
      })} className="space-y-6">
        {/* Basic Information */}
        <Card>
          <CardHeader>
            <CardTitle>Basic Information</CardTitle>
            <CardDescription>
              Provide the essential details for your finance request
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="paymentType" required>Payment Type</Label>
                <Controller
                  name="paymentType"
                  control={control}
                  render={({ field }) => (
                    <Select onValueChange={field.onChange} value={field.value}>
                      <SelectTrigger error={errors.paymentType?.message}>
                        <SelectValue placeholder="Select payment type" />
                      </SelectTrigger>
                      <SelectContent>
                        {paymentTypes.map((type) => (
                          <SelectItem key={type.value} value={type.value}>
                            {type.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="paymentMode" required>Payment Mode</Label>
                <Controller
                  name="paymentMode"
                  control={control}
                  render={({ field }) => (
                    <Select onValueChange={field.onChange} value={field.value}>
                      <SelectTrigger error={errors.paymentMode?.message}>
                        <SelectValue placeholder="Select payment mode" />
                      </SelectTrigger>
                      <SelectContent>
                        {paymentModes.map((mode) => (
                          <SelectItem key={mode.value} value={mode.value}>
                            {mode.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="purpose" required>Purpose / Description</Label>
              <Textarea
                id="purpose"
                placeholder="Describe the purpose of this request..."
                {...register("purpose")}
                error={errors.purpose?.message}
                rows={3}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="department" required>Department</Label>
                <Controller
                  name="department"
                  control={control}
                  render={({ field }) => (
                    <Select onValueChange={field.onChange} value={field.value}>
                      <SelectTrigger error={errors.department?.message}>
                        <SelectValue placeholder="Select department" />
                      </SelectTrigger>
                      <SelectContent>
                        {departments.map((dept) => (
                          <SelectItem key={dept.id} value={dept.name}>
                            {dept.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="costCenter" required>Cost Center</Label>
                <Controller
                  name="costCenter"
                  control={control}
                  render={({ field }) => (
                    <Select onValueChange={field.onChange} value={field.value}>
                      <SelectTrigger error={errors.costCenter?.message}>
                        <SelectValue placeholder="Select cost center" />
                      </SelectTrigger>
                      <SelectContent>
                        {costCenters.map((cc) => (
                          <SelectItem key={cc.id} value={cc.code}>
                            {cc.code} - {cc.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="entity" required>Entity</Label>
                <Controller
                  name="entity"
                  control={control}
                  render={({ field }) => (
                    <Select onValueChange={field.onChange} value={field.value}>
                      <SelectTrigger error={errors.entity?.message}>
                        <SelectValue placeholder="Select entity" />
                      </SelectTrigger>
                      <SelectContent>
                        {entities.map((entity) => (
                          <SelectItem key={entity.id} value={entity.code}>
                            {entity.code} - {entity.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Amount Details */}
        <Card>
          <CardHeader>
            <CardTitle>Amount Details</CardTitle>
            <CardDescription>
              Enter the payment amount and currency information
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="currency" required>Currency</Label>
                <Controller
                  name="currency"
                  control={control}
                  render={({ field }) => (
                    <Select onValueChange={field.onChange} value={field.value}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select currency" />
                      </SelectTrigger>
                      <SelectContent>
                        {currencies.map((curr) => (
                          <SelectItem key={curr.value} value={curr.value}>
                            {curr.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="totalAmount" required>Amount</Label>
                <Input
                  id="totalAmount"
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  {...register("totalAmount", { valueAsNumber: true })}
                  error={errors.totalAmount?.message}
                />
              </div>

              {currency !== "INR" && (
                <div className="space-y-2">
                  <Label htmlFor="exchangeRate" required>Exchange Rate</Label>
                  <Input
                    id="exchangeRate"
                    type="number"
                    step="0.0001"
                    placeholder="1.0000"
                    {...register("exchangeRate", { valueAsNumber: true })}
                    error={errors.exchangeRate?.message}
                  />
                </div>
              )}
            </div>

            {currency !== "INR" && totalAmount && (
              <div className="rounded-lg bg-muted p-4">
                <p className="text-sm text-muted-foreground">Total in INR</p>
                <p className="text-2xl font-bold">
                  ₹{((totalAmount || 0) * (exchangeRate || 1)).toLocaleString("en-IN", { maximumFractionDigits: 2 })}
                </p>
              </div>
            )}

            <Separator />

            {/* Tax Information */}
            <div className="space-y-4">
              <h4 className="font-medium">Tax Information</h4>
              
              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-2">
                  <Controller
                    name="isGSTApplicable"
                    control={control}
                    render={({ field }) => (
                      <Checkbox
                        id="isGSTApplicable"
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    )}
                  />
                  <Label htmlFor="isGSTApplicable" className="font-normal">
                    GST Applicable
                  </Label>
                </div>

                <div className="flex items-center space-x-2">
                  <Controller
                    name="isTDSApplicable"
                    control={control}
                    render={({ field }) => (
                      <Checkbox
                        id="isTDSApplicable"
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    )}
                  />
                  <Label htmlFor="isTDSApplicable" className="font-normal">
                    TDS Applicable
                  </Label>
                </div>
              </div>

              {isGSTApplicable && (
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="gstPercentage">GST Percentage</Label>
                    <Input
                      id="gstPercentage"
                      type="number"
                      step="0.01"
                      placeholder="18"
                      {...register("gstPercentage", { valueAsNumber: true })}
                      error={errors.gstPercentage?.message}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="gstNumber">GST Number</Label>
                    <Input
                      id="gstNumber"
                      placeholder="GST Number"
                      {...register("gstNumber")}
                    />
                  </div>
                </div>
              )}

              {isTDSApplicable && (
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="tdsPercentage">TDS Percentage</Label>
                    <Input
                      id="tdsPercentage"
                      type="number"
                      step="0.01"
                      placeholder="10"
                      {...register("tdsPercentage", { valueAsNumber: true })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="tdsSection">TDS Section</Label>
                    <Input
                      id="tdsSection"
                      placeholder="e.g., 194C"
                      {...register("tdsSection")}
                    />
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Vendor / Payee Details */}
        <Card>
          <CardHeader>
            <CardTitle>Vendor / Payee Details</CardTitle>
            <CardDescription>
              Enter the recipient&apos;s information for payment
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="vendorName" required>Vendor / Payee Name</Label>
                <Input
                  id="vendorName"
                  placeholder="Enter vendor name"
                  {...register("vendorName")}
                  error={errors.vendorName?.message}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="vendorCode">Vendor Code (if applicable)</Label>
                <Input
                  id="vendorCode"
                  placeholder="Enter vendor code"
                  {...register("vendorCode")}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="bankAccountNumber">Bank Account Number</Label>
              <Input
                id="bankAccountNumber"
                placeholder="Enter bank account number"
                {...register("bankAccountNumber")}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="bankName">Bank Name</Label>
                <Input
                  id="bankName"
                  placeholder="Enter bank name"
                  {...register("bankName")}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ifscCode">IFSC Code</Label>
                <Input
                  id="ifscCode"
                  placeholder="Enter IFSC code"
                  {...register("ifscCode")}
                />
              </div>
            </div>

            {paymentMode === "UPI" && (
              <div className="space-y-2">
                <Label htmlFor="upiId" required>UPI ID</Label>
                <Input
                  id="upiId"
                  placeholder="vendor@upi"
                  {...register("upiId")}
                  error={errors.upiId?.message}
                />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="panNumber">PAN Number</Label>
              <Input
                id="panNumber"
                placeholder="Enter PAN number"
                {...register("panNumber")}
              />
            </div>
          </CardContent>
        </Card>

        {/* Invoice Details */}
        <Card>
          <CardHeader>
            <CardTitle>Invoice Details</CardTitle>
            <CardDescription>
              Add invoice information if applicable
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="invoiceNumber">Invoice Number</Label>
                <Input
                  id="invoiceNumber"
                  placeholder="Enter invoice number"
                  {...register("invoiceNumber")}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="invoiceDate">Invoice Date</Label>
                <Input
                  id="invoiceDate"
                  type="date"
                  {...register("invoiceDate")}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="remarks">Additional Remarks</Label>
              <Textarea
                id="remarks"
                placeholder="Any additional notes or remarks..."
                {...register("remarks")}
                rows={2}
              />
            </div>
          </CardContent>
        </Card>

        {/* Info Box */}
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
          <div className="flex gap-3">
            <Info className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-blue-800">
              <p className="font-medium">Approval Workflow</p>
              <p className="mt-1">
                Once submitted, your request will go through the following approval stages:
                Finance Vetting → Finance Controller → Director → MD → Disbursement
              </p>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Link href="/dashboard/requests">
            <Button type="button" variant="outline" className="w-full sm:w-auto">
              Cancel
            </Button>
          </Link>
          <Button
            type="submit"
            variant="secondary"
            loading={isSubmitting}
            onClick={() => { isDraftRef.current = true; }}
            className="w-full sm:w-auto"
          >
            Save as Draft
          </Button>
          <Button
            type="submit"
            loading={isSubmitting}
            onClick={() => { isDraftRef.current = false; }}
            className="w-full sm:w-auto"
          >
            Submit Request
          </Button>
        </div>
      </form>
    </div>
  )
}
