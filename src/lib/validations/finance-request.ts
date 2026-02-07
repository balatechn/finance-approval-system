import { z } from 'zod';

// ============================================================================
// ENUMS
// ============================================================================

export const PaymentTypeEnum = z.enum(['CRITICAL', 'NON_CRITICAL', 'PETTY_CASH', 'INVOICE', 'ADVANCE', 'REIMBURSEMENT', 'VENDOR_PAYMENT', 'SALARY', 'BONUS', 'OTHER']);
export const PaymentModeEnum = z.enum(['NEFT', 'RTGS', 'UPI', 'CHEQUE', 'BANK_TRANSFER', 'CASH', 'DEMAND_DRAFT']);
export const CurrencyEnum = z.enum(['INR', 'USD', 'EUR', 'GBP']);
export const VendorTypeEnum = z.enum(['VENDOR', 'EMPLOYEE', 'CONSULTANT', 'OTHER']);
export const ApprovalActionEnum = z.enum(['APPROVED', 'REJECTED', 'SENT_BACK']);

export const RequestStatusEnum = z.enum([
  'DRAFT',
  'SUBMITTED',
  'PENDING_MANAGER',
  'PENDING_HOD',
  'PENDING_FINANCE_VETTING',
  'PENDING_FINANCE_APPROVAL',
  'APPROVED',
  'REJECTED',
  'SENT_BACK',
  'DISBURSED',
]);

// ============================================================================
// FINANCE REQUEST SCHEMAS
// ============================================================================

// Base schema for vendor bank details
export const vendorBankSchema = z.object({
  vendorBankName: z.string().min(1, 'Bank name is required'),
  vendorBankAccount: z.string()
    .min(9, 'Account number must be 9-18 digits')
    .max(18, 'Account number must be 9-18 digits')
    .regex(/^\d+$/, 'Account number must contain only digits'),
  vendorBankIfsc: z.string()
    .regex(/^[A-Z]{4}0[A-Z0-9]{6}$/, 'Invalid IFSC code format (e.g., HDFC0001234)'),
  vendorBankBranch: z.string().optional(),
  vendorUpiId: z.string().optional(),
});

// Create Finance Request Schema
export const createFinanceRequestSchema = z.object({
  // Business Details
  department: z.string().min(1, 'Department is required'),
  costCenter: z.string().min(1, 'Cost center is required'),
  entity: z.string().optional(),
  
  // Payment Details
  paymentType: PaymentTypeEnum,
  paymentMode: PaymentModeEnum.optional().default('NEFT'),
  totalAmount: z.coerce.number({ invalid_type_error: 'Amount is required' })
    .min(1, 'Amount must be greater than 0')
    .max(100000000, 'Amount exceeds maximum limit'),
  currency: CurrencyEnum.default('INR'),
  exchangeRate: z.coerce.number().min(0).default(1),
  totalAmountINR: z.coerce.number().optional(),
  purpose: z.string()
    .min(10, 'Purpose must be at least 10 characters')
    .max(2000, 'Purpose must not exceed 2000 characters'),
  
  // Vendor Information
  vendorName: z.string().min(1, 'Vendor name is required'),
  vendorCode: z.string().optional(),
  
  // Bank Details
  bankAccountNumber: z.string().optional(),
  bankName: z.string().optional(),
  ifscCode: z.string().optional(),
  upiId: z.string().optional(),
  panNumber: z.string().optional(),
  
  // Invoice Details
  invoiceNumber: z.string().optional(),
  invoiceDate: z.string().optional(),
  
  // GST Details
  isGSTApplicable: z.boolean().default(false),
  gstPercentage: z.coerce.number().min(0).max(28).optional().nullable(),
  gstNumber: z.string().optional(),
  
  // TDS Details
  isTDSApplicable: z.boolean().default(false),
  tdsPercentage: z.coerce.number().min(0).max(100).optional().nullable(),
  tdsSection: z.string().optional(),
  
  // Other
  remarks: z.string().optional(),
  saveAsDraft: z.boolean().default(false),
  
  // Status
  status: z.enum(['DRAFT', 'SUBMITTED']).default('DRAFT'),
});

// Update Finance Request Schema (partial)
export const updateFinanceRequestSchema = createFinanceRequestSchema.partial().extend({
  id: z.string().cuid(),
});

// ============================================================================
// APPROVAL SCHEMAS
// ============================================================================

export const approvalActionSchema = z.object({
  financeRequestId: z.string().cuid(),
  action: ApprovalActionEnum,
  comments: z.string().optional(),
}).refine((data) => {
  // Comments required for rejection or send back
  if ((data.action === 'REJECTED' || data.action === 'SENT_BACK') && !data.comments) {
    return false;
  }
  return true;
}, {
  message: 'Comments are required when rejecting or sending back',
  path: ['comments'],
});

// ============================================================================
// DISBURSEMENT SCHEMA
// ============================================================================

export const disbursementSchema = z.object({
  financeRequestId: z.string().cuid(),
  paymentReferenceNumber: z.string().min(1, 'Payment reference is required'),
  actualPaymentDate: z.coerce.date({
    required_error: 'Payment date is required',
  }),
  disbursementRemarks: z.string().optional(),
});

// ============================================================================
// USER SCHEMAS
// ============================================================================

export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

export const registerSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number')
    .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character'),
  name: z.string().min(2, 'Name must be at least 2 characters'),
  department: z.string().min(1, 'Department is required'),
  employeeId: z.string().min(1, 'Employee ID is required'),
});

// ============================================================================
// FILTER & SEARCH SCHEMAS
// ============================================================================

export const requestFilterSchema = z.object({
  status: RequestStatusEnum.optional(),
  department: z.string().optional(),
  paymentType: PaymentTypeEnum.optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  minAmount: z.number().optional(),
  maxAmount: z.number().optional(),
  search: z.string().optional(),
  page: z.number().int().positive().default(1),
  limit: z.number().int().positive().max(100).default(10),
});

// ============================================================================
// ATTACHMENT SCHEMA
// ============================================================================

export const attachmentSchema = z.object({
  fileName: z.string().min(1),
  fileType: z.string().min(1),
  fileSize: z.number().max(10 * 1024 * 1024, 'File size must be less than 10MB'),
  fileUrl: z.string().url(),
  category: z.enum(['INVOICE', 'QUOTATION', 'APPROVAL_EMAIL', 'SUPPORTING_DOC', 'OTHER']),
});

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type CreateFinanceRequestInput = z.infer<typeof createFinanceRequestSchema>;
export type UpdateFinanceRequestInput = z.infer<typeof updateFinanceRequestSchema>;
export type ApprovalActionInput = z.infer<typeof approvalActionSchema>;
export type DisbursementInput = z.infer<typeof disbursementSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type RequestFilterInput = z.infer<typeof requestFilterSchema>;
export type AttachmentInput = z.infer<typeof attachmentSchema>;
