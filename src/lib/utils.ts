import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { format, formatDistanceToNow, differenceInHours } from 'date-fns';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number, currency: string = 'INR'): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatDate(date: Date | string, formatStr: string = 'dd MMM yyyy'): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return format(d, formatStr);
}

export function formatDateTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return format(d, 'dd MMM yyyy, HH:mm');
}

export function formatRelativeTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return formatDistanceToNow(d, { addSuffix: true });
}

export function getHoursDifference(date1: Date, date2: Date): number {
  return differenceInHours(date1, date2);
}

export function generateReferenceNumber(prefix: string = 'FIN'): string {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `${prefix}-${timestamp}-${random}`;
}

export async function generateSequentialReference(
  prefix: string,
  getLastNumber: () => Promise<number>
): Promise<string> {
  const lastNumber = await getLastNumber();
  const nextNumber = lastNumber + 1;
  const paddedNumber = nextNumber.toString().padStart(6, '0');
  const year = new Date().getFullYear().toString().slice(-2);
  const month = (new Date().getMonth() + 1).toString().padStart(2, '0');
  return `${prefix}-${year}${month}-${paddedNumber}`;
}

export function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    DRAFT: 'bg-gray-100 text-gray-800',
    SUBMITTED: 'bg-blue-100 text-blue-800',
    PENDING_MANAGER: 'bg-yellow-100 text-yellow-800',
    PENDING_HOD: 'bg-yellow-100 text-yellow-800',
    PENDING_FINANCE_VETTING: 'bg-orange-100 text-orange-800',
    PENDING_FINANCE_APPROVAL: 'bg-orange-100 text-orange-800',
    APPROVED: 'bg-green-100 text-green-800',
    REJECTED: 'bg-red-100 text-red-800',
    SENT_BACK: 'bg-purple-100 text-purple-800',
    DISBURSED: 'bg-emerald-100 text-emerald-800',
  };
  return colors[status] || 'bg-gray-100 text-gray-800';
}

export function getStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    DRAFT: 'Draft',
    SUBMITTED: 'Submitted',
    PENDING_MANAGER: 'Pending Manager',
    PENDING_HOD: 'Pending HOD',
    PENDING_FINANCE_VETTING: 'Finance Vetting',
    PENDING_FINANCE_APPROVAL: 'Finance Approval',
    APPROVED: 'Approved',
    REJECTED: 'Rejected',
    SENT_BACK: 'Sent Back',
    DISBURSED: 'Disbursed',
  };
  return labels[status] || status;
}

export function getSLAStatus(dueDate: Date | null, completed: boolean): {
  status: 'on-track' | 'at-risk' | 'breached' | 'completed';
  label: string;
  color: string;
} {
  if (completed) {
    return { status: 'completed', label: 'Completed', color: 'text-green-600' };
  }
  
  if (!dueDate) {
    return { status: 'on-track', label: 'On Track', color: 'text-gray-600' };
  }
  
  const now = new Date();
  const hoursRemaining = differenceInHours(dueDate, now);
  
  if (hoursRemaining < 0) {
    return { status: 'breached', label: 'SLA Breached', color: 'text-red-600' };
  }
  
  if (hoursRemaining <= 4) {
    return { status: 'at-risk', label: 'At Risk', color: 'text-yellow-600' };
  }
  
  return { status: 'on-track', label: 'On Track', color: 'text-green-600' };
}

export function truncate(str: string, length: number): string {
  if (str.length <= length) return str;
  return str.slice(0, length) + '...';
}

export function slugify(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '');
}

export function parseAmount(value: string | number): number {
  if (typeof value === 'number') return value;
  const parsed = parseFloat(value.replace(/[^0-9.-]+/g, ''));
  return isNaN(parsed) ? 0 : parsed;
}

export function downloadFile(data: BlobPart, filename: string, mimeType: string) {
  const blob = new Blob([data], { type: mimeType });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
}
