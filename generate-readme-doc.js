const {
  Document, Packer, Paragraph, TextRun, HeadingLevel,
  Table, TableRow, TableCell, WidthType, BorderStyle,
  AlignmentType, ShadingType, convertInchesToTwip,
} = require("docx");
const fs = require("fs");

const BLUE = "1E3A5F";
const LIGHT_BLUE = "EBF5FB";
const GRAY = "F8F9FA";
const WHITE = "FFFFFF";

function heading(text, level = HeadingLevel.HEADING_1) {
  return new Paragraph({ text, heading: level, spacing: { before: 300, after: 150 } });
}

function para(text, opts = {}) {
  return new Paragraph({
    spacing: { after: 120 },
    ...opts,
    children: [new TextRun({ text, size: 22, ...opts })],
  });
}

function bold(text, opts = {}) {
  return new TextRun({ text, bold: true, size: 22, ...opts });
}

function bulletItem(text, level = 0) {
  return new Paragraph({
    bullet: { level },
    spacing: { after: 60 },
    children: [new TextRun({ text, size: 22 })],
  });
}

function makeBorderedCell(content, opts = {}) {
  const border = {
    top: { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" },
    bottom: { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" },
    left: { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" },
    right: { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" },
  };
  return new TableCell({
    borders: border,
    width: opts.width ? { size: opts.width, type: WidthType.PERCENTAGE } : undefined,
    shading: opts.shading ? { type: ShadingType.SOLID, color: opts.shading } : undefined,
    children: [
      new Paragraph({
        spacing: { before: 40, after: 40 },
        children: [new TextRun({ text: content, size: 20, bold: !!opts.bold, color: opts.fontColor || "000000" })],
      }),
    ],
  });
}

function makeTable(headers, rows) {
  const colWidth = Math.floor(100 / headers.length);
  const headerRow = new TableRow({
    children: headers.map(h => makeBorderedCell(h, { bold: true, shading: BLUE, fontColor: WHITE, width: colWidth })),
  });
  const dataRows = rows.map(row =>
    new TableRow({
      children: row.map((cell, i) => makeBorderedCell(cell, { width: colWidth, shading: i % 2 === 0 ? WHITE : WHITE })),
    })
  );
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [headerRow, ...dataRows],
  });
}

const doc = new Document({
  styles: {
    default: {
      document: { run: { font: "Calibri", size: 22 } },
    },
  },
  sections: [
    {
      properties: { page: { margin: { top: convertInchesToTwip(0.8), bottom: convertInchesToTwip(0.8), left: convertInchesToTwip(0.9), right: convertInchesToTwip(0.9) } } },
      children: [
        // ===== TITLE PAGE =====
        new Paragraph({ spacing: { before: 3000 } }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 200 },
          children: [new TextRun({ text: "FINANCE APPROVAL SYSTEM", bold: true, size: 52, color: BLUE })],
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 100 },
          children: [new TextRun({ text: "National Group India", size: 32, color: "555555" })],
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 400 },
          children: [new TextRun({ text: "System Documentation", size: 28, color: "777777", italics: true })],
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 100 },
          children: [new TextRun({ text: "https://finance.nationalgroupindia.com", size: 22, color: "2980B9" })],
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 2000, after: 100 },
          children: [new TextRun({ text: `Document Version: 1.0  |  Date: ${new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" })}`, size: 20, color: "999999" })],
        }),

        // ===== PAGE BREAK =====
        new Paragraph({ pageBreakBefore: true }),

        // ===== 1. OVERVIEW =====
        heading("1. Overview"),
        para("The Finance Approval System is a web-based enterprise application built for National Group India to streamline and automate the purchase/finance request and approval workflow. It replaces manual, paper-based processes with a digital, role-based approval pipeline — ensuring transparency, accountability, SLA compliance, and complete audit trails."),

        // ===== 2. FEATURES =====
        heading("2. Key Features"),
        heading("2.1 Core Features", HeadingLevel.HEADING_2),
        bulletItem("Multi-Level Approval Workflow — 6-step approval pipeline from Finance Vetting to Disbursement"),
        bulletItem("Role-Based Access Control (RBAC) — 7 roles with granular permissions"),
        bulletItem("Real-Time Dashboard — Role-specific statistics, pending approvals, charts"),
        bulletItem("SLA Tracking & Enforcement — Configurable SLA hours with breach detection and alerts"),
        bulletItem("Email Notifications — Automated alerts for all workflow events"),
        bulletItem("Auto-Generated Reference Numbers — Unique tracking IDs for each request"),

        heading("2.2 Request Features", HeadingLevel.HEADING_2),
        bulletItem("10 payment types: Critical, Non-Critical, Petty Cash, Invoice, Advance, Reimbursement, Vendor Payment, Salary, Bonus, Other"),
        bulletItem("7 payment modes: NEFT, RTGS, UPI, Cheque, Bank Transfer, Cash, Demand Draft"),
        bulletItem("Multi-currency support: INR, USD, EUR, GBP"),
        bulletItem("Vendor management with bank details, UPI, and PAN"),
        bulletItem("GST and TDS calculation support"),
        bulletItem("Invoice details with invoice number, date, and due date"),
        bulletItem("File attachments (quotes, invoices, supporting documents — max 5MB each)"),
        bulletItem("Draft saving and submission workflow"),
        bulletItem("Send-back mechanism for requesting corrections"),

        heading("2.3 UI/UX Features", HeadingLevel.HEADING_2),
        bulletItem("Responsive design for desktop and mobile"),
        bulletItem("Collapsible sidebar with icon-rail mode"),
        bulletItem("Loading skeleton screens for instant page rendering"),
        bulletItem("Approval timeline visualization with status indicators"),
        bulletItem("Report generation with popup dialog and CSV export"),
        bulletItem("Online users indicator for administrators"),

        // ===== 3. TECH STACK =====
        heading("3. Technology Stack"),
        makeTable(
          ["Category", "Technology"],
          [
            ["Framework", "Next.js 14.1.0 (App Router)"],
            ["Language", "TypeScript"],
            ["Database", "PostgreSQL (Neon Serverless)"],
            ["ORM", "Prisma 5.x"],
            ["Authentication", "NextAuth.js 4.x (JWT + Credentials Provider)"],
            ["UI Components", "Radix UI Primitives"],
            ["Styling", "Tailwind CSS"],
            ["Icons", "Lucide React"],
            ["Form Handling", "React Hook Form + Zod Validation"],
            ["Email Service", "Nodemailer (Gmail SMTP)"],
            ["Deployment", "Vercel (Auto-deploy from GitHub)"],
            ["Version Control", "GitHub (master branch)"],
          ]
        ),

        // ===== 4. ROLES =====
        new Paragraph({ pageBreakBefore: true }),
        heading("4. User Roles & Permissions"),
        para("The system implements 7 distinct roles with hierarchical permissions:"),
        makeTable(
          ["Role", "Hierarchy Level", "Key Permissions"],
          [
            ["Employee", "10", "Create/view own requests, respond to send-backs"],
            ["Finance Team", "60", "Finance vetting, disbursement processing, view all requests, reports"],
            ["Finance Planner", "65", "Finance planner approval, view all requests, dashboard, reports"],
            ["Finance Controller", "70", "Finance controller approval, view all requests, dashboard, reports"],
            ["Director", "80", "Director-level approval, view all requests, dashboard, reports"],
            ["Managing Director", "90", "Final approval authority, view all requests, dashboard, reports"],
            ["Administrator", "100", "Full system access: user management, settings, override approvals"],
          ]
        ),

        // ===== 5. WORKFLOW =====
        new Paragraph({ spacing: { before: 300 } }),
        heading("5. Approval Workflow"),
        para("The system implements a 6-level sequential approval pipeline:"),
        new Paragraph({ spacing: { after: 100 } }),

        heading("5.1 Approval Levels", HeadingLevel.HEADING_2),
        makeTable(
          ["Step", "Approval Level", "Approver Role", "Purpose"],
          [
            ["1", "Finance Vetting", "Finance Team", "Evaluate & vet quote/estimate"],
            ["2", "Finance Planner", "Finance Planner", "Financial planning review"],
            ["3", "Finance Controller", "Finance Controller", "Business requirement validation"],
            ["4", "Director", "Director", "Director-level final checks"],
            ["5", "Managing Director", "Managing Director", "Final executive approval"],
            ["6", "Disbursement", "Finance Team", "Payment processing & release"],
          ]
        ),

        heading("5.2 Request Status Flow", HeadingLevel.HEADING_2),
        para("DRAFT → SUBMITTED → PENDING_FINANCE_VETTING → PENDING_FINANCE_PLANNER → PENDING_FINANCE_CONTROLLER → PENDING_DIRECTOR → PENDING_MD → APPROVED → DISBURSED"),

        heading("5.3 Additional Statuses", HeadingLevel.HEADING_2),
        bulletItem("REJECTED — Request denied at any approval level with comments"),
        bulletItem("SENT_BACK — Request returned to the requestor for corrections or additional information"),

        heading("5.4 SLA Configuration", HeadingLevel.HEADING_2),
        makeTable(
          ["Approval Level", "SLA (Critical)", "SLA (Non-Critical)"],
          [
            ["Finance Vetting", "24 hours", "72 hours"],
            ["Finance Planner", "24 hours", "24 hours"],
            ["Finance Controller", "24 hours", "24 hours"],
            ["Director", "24 hours", "24 hours"],
            ["Managing Director", "24 hours", "24 hours"],
            ["Disbursement", "24 hours", "24 hours"],
          ]
        ),

        // ===== 6. DATABASE =====
        new Paragraph({ pageBreakBefore: true }),
        heading("6. Database Schema"),
        para("The system uses PostgreSQL (Neon Serverless) with Prisma ORM. Key models:"),
        makeTable(
          ["Model", "Description"],
          [
            ["User", "System users with roles, departments, manager hierarchy, activity tracking"],
            ["FinanceRequest", "Purchase/finance requests with vendor details, amounts, GST/TDS, status"],
            ["ApprovalStep", "Individual approval level steps with SLA tracking per request"],
            ["ApprovalAction_Record", "Audit log of all approval actions (approve/reject/send-back)"],
            ["Attachment", "File attachments linked to finance requests"],
            ["Notification", "In-app notification records"],
            ["SLALog", "SLA tracking, breach detection, and compliance records"],
            ["SystemSettings", "Application-wide configuration (company name, SLA hours, email)"],
          ]
        ),

        heading("6.1 Key Enums", HeadingLevel.HEADING_2),
        bulletItem("Role: EMPLOYEE, FINANCE_TEAM, FINANCE_PLANNER, FINANCE_CONTROLLER, DIRECTOR, MD, ADMIN"),
        bulletItem("RequestStatus: DRAFT, SUBMITTED, PENDING_FINANCE_VETTING, ... APPROVED, REJECTED, SENT_BACK, DISBURSED"),
        bulletItem("PaymentType: CRITICAL, NON_CRITICAL, PETTY_CASH, INVOICE, ADVANCE, REIMBURSEMENT, VENDOR_PAYMENT, SALARY, BONUS, OTHER"),
        bulletItem("PaymentMode: NEFT, RTGS, UPI, CHEQUE, BANK_TRANSFER, CASH, DEMAND_DRAFT"),
        bulletItem("Currency: INR, USD, EUR, GBP"),
        bulletItem("ApprovalLevel: FINANCE_VETTING, FINANCE_PLANNER, FINANCE_CONTROLLER, DIRECTOR, MD, DISBURSEMENT"),

        // ===== 7. API =====
        new Paragraph({ pageBreakBefore: true }),
        heading("7. API Endpoints"),

        heading("7.1 Finance Requests", HeadingLevel.HEADING_2),
        makeTable(
          ["Method", "Endpoint", "Description"],
          [
            ["GET", "/api/finance-requests", "List requests (with filters, pagination)"],
            ["POST", "/api/finance-requests", "Create a new finance request"],
            ["GET", "/api/finance-requests/[id]", "Get request details by ID or reference number"],
            ["PATCH", "/api/finance-requests/[id]", "Update a request (draft/resubmit)"],
            ["DELETE", "/api/finance-requests/[id]", "Soft-delete a request"],
            ["POST", "/api/finance-requests/[id]/approve", "Approve, reject, or send-back"],
            ["POST", "/api/finance-requests/[id]/disburse", "Process disbursement"],
          ]
        ),

        heading("7.2 User Management", HeadingLevel.HEADING_2),
        makeTable(
          ["Method", "Endpoint", "Description"],
          [
            ["GET", "/api/users", "List all users (Admin only)"],
            ["POST", "/api/users", "Create a new user with email notification"],
            ["GET", "/api/users/[id]", "Get user details"],
            ["PATCH", "/api/users/[id]", "Update user profile/role/password"],
            ["DELETE", "/api/users/[id]", "Deactivate user account"],
          ]
        ),

        heading("7.3 System", HeadingLevel.HEADING_2),
        makeTable(
          ["Method", "Endpoint", "Description"],
          [
            ["GET", "/api/dashboard", "Dashboard statistics (role-based)"],
            ["GET", "/api/reports", "Generate reports with filters"],
            ["GET/PATCH", "/api/settings", "System settings CRUD"],
            ["POST", "/api/settings/test-email", "Test email configuration"],
            ["POST", "/api/attachments", "Upload file attachment"],
            ["GET", "/api/notifications", "User notification feed"],
            ["GET", "/api/cron/check-sla", "SLA breach detection (cron job)"],
          ]
        ),

        // ===== 8. EMAILS =====
        new Paragraph({ pageBreakBefore: true }),
        heading("8. Email Notifications"),
        para("The system sends automated email notifications for all workflow events:"),
        makeTable(
          ["Event", "Recipients", "Description"],
          [
            ["Request Submitted", "Requestor + First-level approvers", "New request submitted for approval"],
            ["Request Approved", "Requestor + Next-level approvers", "Approved at a specific approval level"],
            ["Request Rejected", "Requestor", "Request denied with reviewer comments"],
            ["Request Sent Back", "Requestor", "Returned for corrections with instructions"],
            ["Request Resubmitted", "Re-approvers", "Corrected request resubmitted for review"],
            ["Disbursement Complete", "Requestor", "Payment processed and released"],
            ["SLA Breach Alert", "Current approvers + Admins", "Overdue approval past SLA deadline"],
            ["New User Created", "New user + All admins", "Welcome email with login credentials"],
            ["Password Reset", "User + Admin notification", "New password sent to user"],
            ["Profile Updated", "User", "Account changes confirmation"],
            ["Account Deactivated", "User", "Account disabled notification"],
          ]
        ),

        // ===== 9. REPORTS =====
        heading("9. Reports"),
        para("The system supports 6 built-in report types with date range filtering, department/status filters, and CSV export:"),
        bulletItem("Request Summary — Overview of all requests with status and amounts"),
        bulletItem("Approval Turnaround — Time taken at each approval level"),
        bulletItem("Department-wise Analysis — Request volume and amounts by department"),
        bulletItem("Payment Mode Analysis — Breakdown by payment method"),
        bulletItem("SLA Compliance — SLA adherence across approval levels"),
        bulletItem("Monthly Trends — Month-over-month request and approval trends"),

        // ===== 10. SETUP =====
        heading("10. Setup & Configuration"),
        heading("10.1 Prerequisites", HeadingLevel.HEADING_2),
        bulletItem("Node.js 18 or later"),
        bulletItem("npm or yarn package manager"),
        bulletItem("PostgreSQL database (Neon Serverless recommended)"),
        bulletItem("Gmail account with App Password for SMTP"),

        heading("10.2 Installation", HeadingLevel.HEADING_2),
        para("1. Clone the repository: git clone https://github.com/balatechn/finance-approval-system.git"),
        para("2. Install dependencies: npm install"),
        para("3. Create .env file with required environment variables"),
        para("4. Push database schema: npx prisma db push"),
        para("5. Seed database (optional): npm run db:seed"),
        para("6. Start dev server: npm run dev"),

        heading("10.3 Environment Variables", HeadingLevel.HEADING_2),
        makeTable(
          ["Variable", "Description", "Example"],
          [
            ["DATABASE_URL", "PostgreSQL connection string", "postgresql://user:pass@host:5432/db"],
            ["NEXTAUTH_URL", "Application base URL", "https://finance.nationalgroupindia.com"],
            ["NEXTAUTH_SECRET", "JWT signing secret", "(random string)"],
            ["EMAIL_HOST", "SMTP server hostname", "smtp.gmail.com"],
            ["EMAIL_PORT", "SMTP port", "587"],
            ["EMAIL_USER", "SMTP username", "email@gmail.com"],
            ["EMAIL_PASS", "SMTP password (App Password)", "(app password)"],
            ["EMAIL_FROM", "Sender display name", "Finance System <email>"],
            ["NEXT_PUBLIC_APP_URL", "Public app URL", "https://finance.nationalgroupindia.com"],
            ["CRON_SECRET", "Secret for cron API auth", "(random string)"],
          ]
        ),

        // ===== 11. DEPLOYMENT =====
        heading("11. Deployment"),
        para("The application is deployed on Vercel with automatic deployments from the master branch on GitHub."),
        bulletItem("Push code to the master branch to trigger auto-deploy"),
        bulletItem("Run 'npx prisma db push' before deploying if schema changes were made"),
        bulletItem("Cron jobs are configured in vercel.json for SLA monitoring"),
        bulletItem("Static assets are cached with 1-year immutable headers for performance"),

        // ===== FOOTER =====
        new Paragraph({ spacing: { before: 600 } }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [new TextRun({ text: "— End of Document —", italics: true, size: 20, color: "999999" })],
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 100 },
          children: [new TextRun({ text: "Built & Maintained by Bala Tech Solutions for National Group India", size: 18, color: "AAAAAA" })],
        }),
      ],
    },
  ],
});

Packer.toBuffer(doc).then((buffer) => {
  fs.writeFileSync("Finance_Approval_System_Documentation.docx", buffer);
  console.log("✅ Word document created: Finance_Approval_System_Documentation.docx");
});
