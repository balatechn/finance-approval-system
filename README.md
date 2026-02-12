# Finance Approval System — National Group India

**Version:** 1.0.2

## Overview

The **Finance Approval System** is a web-based enterprise application built for **National Group India** to streamline and automate the purchase/finance request and approval workflow. It replaces manual, paper-based processes with a digital, role-based approval pipeline — ensuring transparency, accountability, SLA compliance, and audit trails.

**Live URL:** https://finance.nationalgroupindia.com

---

## Table of Contents

1. [Features](#features)
2. [Tech Stack](#tech-stack)
3. [System Architecture](#system-architecture)
4. [User Roles & Permissions](#user-roles--permissions)
5. [Approval Workflow](#approval-workflow)
6. [Database Schema](#database-schema)
7. [Project Structure](#project-structure)
8. [Environment Variables](#environment-variables)
9. [Getting Started](#getting-started)
10. [Deployment](#deployment)
11. [API Endpoints](#api-endpoints)
12. [Email Notifications](#email-notifications)
13. [SLA Management](#sla-management)
14. [Changelog](#changelog)

---

## Features

### Core Features
- **Finance Request Management** — Create, edit, submit, and track finance/purchase requests with auto-generated reference numbers.
- **Multi-Level Approval Workflow** — 6-step approval pipeline: Finance Vetting → Finance Planner → Finance Controller → Director → Managing Director → Disbursement.
- **Role-Based Access Control (RBAC)** — 7 roles with granular permissions (Employee, Finance Team, Finance Planner, Finance Controller, Director, MD, Admin).
- **Real-Time Dashboard** — Role-specific dashboards with KPIs, charts (bar, donut), entity-wise summary, pending approvals, and recent requests.
- **Dashboard Date Range Filter** — Filter all KPIs, charts, and entity summary by custom date range with quick presets (This Month, Last Month, This Year).
- **Interactive Charts** — Status breakdown bar chart, status distribution donut chart, and entity-wise amounts bar chart (powered by Recharts).
- **Entity-wise Management** — Multi-entity support with user-entity assignment; Finance Team can only disburse requests for their assigned entities.
- **SLA Tracking & Enforcement** — Configurable SLA hours per approval level with breach detection, alerts, and cron-based monitoring.
- **Daily SLA Reminder Emails** — Automated emails sent daily at 8:30 AM IST to approvers for requests pending over 24 hours.
- **Email Notifications** — Automated email alerts for submissions, approvals, rejections, send-backs, disbursement, SLA breaches, and user management events.
- **Real-Time Notifications** — In-app notification bell with unread count, auto-polling, and mark-as-read functionality.
- **Force Password Change** — New users must change their temporary password on first login.
- **Cost-Focused Dashboard** — Dashboard displays expense metrics: Total Expenses, Total Disbursed, and Total Pending Disbursement.
- **Forecast Card** — "Next Month" forecast button on dashboard shows projected expenses based on historical data.

### Request Features
- Multiple payment types: Critical, Non-Critical, Petty Cash, Invoice, Advance, Reimbursement, Vendor Payment, Salary, Bonus, Other.
- Payment modes: NEFT, RTGS, UPI, Cheque, Bank Transfer, Cash, Demand Draft.
- Multi-currency support (INR, USD, EUR, GBP).
- Vendor information management (name, code, bank details, UPI, PAN).
- GST and TDS calculation support.
- Invoice details with invoice number, date, and due date.
- File attachments (quotes, invoices, supporting documents — max 5MB each).
- Draft saving and submission workflow.
- Send-back mechanism for requesting corrections.
- **Resubmission Limit** — Maximum 2 resubmissions allowed; after limit reached, Admin review required.
- **Required Resubmission Comments** — Requesters must explain changes made when resubmitting (300 character limit).
- **Resubmission History** — Approvers see requester's response/changes in a dedicated banner.
- **Discussion Thread** — Request-specific comments/chat for requesters and approvers to communicate.
- **@Mention Support** — Tag users in discussions with @username for notifications.
- **Discussion Notifications** — Email and in-app alerts when mentioned or when comments are added.

### UI/UX Features
- Responsive design (desktop + mobile).
- Collapsible sidebar with icon-rail mode for maximum content space.
- Loading skeleton screens for instant page rendering.
- Approval timeline visualization with status indicators.
- Report generation with popup dialog and CSV export.
- Online users indicator for administrators.
- Toast notifications for user feedback.
- Admin can delete any request with confirmation dialog.
- Entity selector for user assignment (visible for all roles).

---

## Tech Stack

| Category | Technology |
|---|---|
| **Framework** | Next.js 14.1.0 (App Router) |
| **Language** | TypeScript |
| **Database** | PostgreSQL (Neon Serverless) |
| **ORM** | Prisma 5.x |
| **Authentication** | NextAuth.js 4.x (JWT + Credentials) |
| **UI Components** | Radix UI Primitives |
| **Styling** | Tailwind CSS |
| **Icons** | Lucide React |
| **Form Handling** | React Hook Form + Zod validation |
| **Charts** | Recharts |
| **Email** | Nodemailer (Gmail SMTP) |
| **Deployment** | Vercel (auto-deploy from GitHub) |
| **Version Control** | GitHub (`balatechn/finance-approval-system`, `master` branch) |

---

## System Architecture

```
┌─────────────────────────────────────────────────────┐
│                    VERCEL (Hosting)                  │
│  ┌───────────────────────────────────────────────┐  │
│  │           Next.js 14 App Router               │  │
│  │  ┌─────────┐  ┌──────────┐  ┌─────────────┐  │  │
│  │  │  Pages  │  │   API    │  │  Middleware  │  │  │
│  │  │ (React) │  │ Routes   │  │  (Auth/RBAC) │  │  │
│  │  └────┬────┘  └────┬─────┘  └──────┬──────┘  │  │
│  │       │            │               │          │  │
│  │  ┌────┴────────────┴───────────────┴──────┐   │  │
│  │  │         NextAuth.js (JWT Auth)         │   │  │
│  │  └────────────────┬───────────────────────┘   │  │
│  │                   │                           │  │
│  │  ┌────────────────┴───────────────────────┐   │  │
│  │  │          Prisma ORM Client             │   │  │
│  │  └────────────────┬───────────────────────┘   │  │
│  └───────────────────┼───────────────────────────┘  │
└──────────────────────┼──────────────────────────────┘
                       │
          ┌────────────┴────────────┐
          │   Neon PostgreSQL DB    │
          │   (ap-southeast-1)      │
          └─────────────────────────┘
```

---

## User Roles & Permissions

| Role | Hierarchy | Key Permissions |
|---|---|---|
| **Employee** | 10 | Create/view own requests, respond to send-backs |
| **Finance Team** | 60 | Finance vetting, disbursement processing, view all requests, reports |
| **Finance Planner** | 65 | Finance planner approval, view all requests, dashboard, reports |
| **Finance Controller** | 70 | Finance controller approval, view all requests, dashboard, reports |
| **Director** | 80 | Director-level approval, view all requests, dashboard, reports |
| **Managing Director** | 90 | Final approval authority, view all requests, dashboard, reports |
| **Administrator** | 100 | Full system access, user management, settings, override approvals |

---

## Approval Workflow

The system implements a **6-level sequential approval pipeline**:

```
┌──────────────────┐     ┌──────────────────┐     ┌──────────────────────┐
│  1. FINANCE      │     │  2. FINANCE      │     │  3. FINANCE          │
│     VETTING      │────▶│     PLANNER      │────▶│     CONTROLLER       │
│  (Finance Team)  │     │ (Finance Planner)│     │ (Finance Controller) │
└──────────────────┘     └──────────────────┘     └──────────────────────┘
                                                            │
                                                            ▼
┌──────────────────┐     ┌──────────────────┐     ┌──────────────────────┐
│  6. DISBURSEMENT │     │  5. MANAGING     │     │  4. DIRECTOR         │
│  (Finance Team)  │◀────│     DIRECTOR     │◀────│     (Director)       │
└──────────────────┘     └──────────────────┘     └──────────────────────┘
```

### Status Flow
```
DRAFT → SUBMITTED → PENDING_FINANCE_VETTING → PENDING_FINANCE_PLANNER →
PENDING_FINANCE_CONTROLLER → PENDING_DIRECTOR → PENDING_MD → APPROVED → DISBURSED
```

### Additional Statuses
- **REJECTED** — Request denied at any approval level.
- **SENT_BACK** — Request returned to the requestor for corrections/additional information.

### SLA Configuration
| Approval Level | SLA (Critical) | SLA (Non-Critical) |
|---|---|---|
| Finance Vetting | 24 hours | 72 hours |
| Finance Planner | 24 hours | 24 hours |
| Finance Controller | 24 hours | 24 hours |
| Director | 24 hours | 24 hours |
| Managing Director | 24 hours | 24 hours |
| Disbursement | 24 hours | 24 hours |

---

## Database Schema

### Core Models

| Model | Description |
|---|---|
| **User** | System users with roles, departments, manager hierarchy, entity assignments |
| **FinanceRequest** | Purchase/finance requests with vendor details, amounts, GST/TDS |
| **ApprovalStep** | Individual approval level steps with SLA tracking |
| **ApprovalAction_Record** | Audit log of approval actions (approve/reject/send-back) |
| **Attachment** | File attachments linked to finance requests |
| **Notification** | In-app notification records |
| **SLALog** | SLA tracking and breach records |
| **SystemSettings** | Application-wide configuration (company name, SLA hours, email settings) |
| **Entity** | Company entities (name, code, active status) |
| **Department** | Departments (name, code, active status) |
| **CostCenter** | Cost centers (name, code, active status) |
| **ItemMaster** | Item master data (name, code, description, active status) |

### Key Relationships
- User → FinanceRequests (one-to-many via requestorId)
- User → Manager (self-referencing for org hierarchy)
- User ↔ Entities (many-to-many via assignedEntities/assignedUsers)
- FinanceRequest → ApprovalSteps (one-to-many)
- FinanceRequest → Attachments (one-to-many)
- FinanceRequest → ApprovalAction_Records (one-to-many)
- ApprovalStep → ApprovalAction_Records (one-to-many)

---

## Project Structure

```
finance-approval-system/
├── prisma/
│   ├── schema.prisma          # Database schema & enums
│   └── seed.ts                # Database seed script
├── public/
│   └── national-logo.webp     # Company logo
├── src/
│   ├── middleware.ts           # Route protection & RBAC middleware
│   ├── app/
│   │   ├── globals.css         # Tailwind CSS globals
│   │   ├── layout.tsx          # Root layout (fonts, metadata)
│   │   ├── page.tsx            # Landing page (redirects to dashboard)
│   │   ├── login/
│   │   │   └── page.tsx        # Login page
│   │   ├── (dashboard)/
│   │   │   ├── layout.tsx      # Dashboard layout (sidebar, header)
│   │   │   └── dashboard/
│   │   │       ├── page.tsx              # Main dashboard (charts, KPIs, date filter)
│   │   │       ├── change-password/page.tsx  # Force password change page
│   │   │       ├── requests/
│   │   │       │   ├── page.tsx          # Request listing
│   │   │       │   ├── new/page.tsx      # Create new request
│   │   │       │   └── [ref]/
│   │   │       │       ├── page.tsx      # Request detail view
│   │   │       │       └── edit/page.tsx # Edit request
│   │   │       ├── approvals/
│   │   │       │   ├── page.tsx          # Approvals listing
│   │   │       │   └── [ref]/page.tsx    # Approval detail/action
│   │   │       ├── reports/page.tsx      # Reports & analytics
│   │   │       ├── users/page.tsx        # User management (Admin)
│   │   │       └── settings/page.tsx     # System settings (Admin)
│   │   └── api/
│   │       ├── auth/[...nextauth]/route.ts  # NextAuth API
│   │       ├── auth/change-password/route.ts # Password change API
│   │       ├── finance-requests/
│   │       │   ├── route.ts                 # List/Create requests
│   │       │   └── [id]/
│   │       │       ├── route.ts             # Get/Update/Delete request
│   │       │       ├── approve/route.ts     # Approve/Reject/Send-back
│   │       │       └── disburse/route.ts    # Process disbursement
│   │       ├── dashboard/route.ts           # Dashboard statistics
│   │       ├── reports/route.ts             # Report generation
│   │       ├── users/
│   │       │   ├── route.ts                 # List/Create users
│   │       │   └── [id]/route.ts            # Get/Update/Deactivate user
│   │       ├── notifications/route.ts       # Notification management
│   │       ├── settings/route.ts            # System settings CRUD
│   │       ├── attachments/route.ts         # File upload handling
│   │       └── cron/check-sla/route.ts      # SLA breach detection cron
│   ├── components/
│   │   ├── approval-timeline.tsx    # Visual approval step timeline
│   │   ├── status-badge.tsx         # Status/level badge component
│   │   └── ui/                      # Reusable UI components (Radix-based)
│   │       ├── avatar.tsx
│   │       ├── badge.tsx
│   │       ├── button.tsx
│   │       ├── card.tsx
│   │       ├── dialog.tsx
│   │       ├── input.tsx
│   │       ├── select.tsx
│   │       ├── table.tsx
│   │       ├── textarea.tsx
│   │       ├── toast.tsx
│   │       ├── tooltip.tsx
│   │       └── ... (more UI components)
│   ├── hooks/
│   │   └── use-toast.ts             # Toast notification hook
│   └── lib/
│       ├── prisma.ts                # Prisma client singleton
│       ├── utils.ts                 # Utility functions (formatDate, SLA, etc.)
│       ├── auth/
│       │   ├── auth-options.ts      # NextAuth configuration
│       │   ├── index.ts             # Auth exports
│       │   ├── permissions.ts       # Role hierarchy & permissions
│       │   └── session.ts           # Server-side session helpers
│       ├── email/
│       │   └── email-service.ts     # Email notification functions
│       └── validations/
│           └── finance-request.ts   # Zod validation schemas
├── next.config.js                   # Next.js config (optimization, caching)
├── tailwind.config.ts               # Tailwind CSS config
├── tsconfig.json                    # TypeScript config
├── vercel.json                      # Vercel deployment config
└── package.json                     # Dependencies & scripts
```

---

## Environment Variables

Create a `.env` file in the project root with the following variables:

```env
# Database
DATABASE_URL="postgresql://user:password@host:5432/dbname"

# NextAuth
NEXTAUTH_URL="https://finance.nationalgroupindia.com"
NEXTAUTH_SECRET="your-secret-key"

# Email (Gmail SMTP)
EMAIL_HOST="smtp.gmail.com"
EMAIL_PORT=587
EMAIL_USER="your-email@gmail.com"
EMAIL_PASS="your-app-password"
EMAIL_FROM="Finance System <your-email@gmail.com>"

# Application
NEXT_PUBLIC_APP_URL="https://finance.nationalgroupindia.com"

# Cron Secret (for SLA check endpoint)
CRON_SECRET="your-cron-secret"
```

---

## Getting Started

### Prerequisites
- Node.js 18+ 
- npm or yarn
- PostgreSQL database (Neon recommended)

### Installation

```bash
# Clone the repository
git clone https://github.com/balatechn/finance-approval-system.git
cd finance-approval-system

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your actual values

# Push database schema
npx prisma db push

# Seed the database (optional - creates default admin user)
npm run db:seed

# Start development server
npm run dev
```

The application will be available at `http://localhost:3000`.

### Default Admin User (from seed)
- **Email:** admin@nationalgroupindia.com
- **Password:** Admin@123

---

## Deployment

The application is deployed on **Vercel** with automatic deployments from the `master` branch.

### Deployment Workflow
```
git add -A
git commit -m "your message"
git push origin master
```
→ Vercel automatically detects the push and deploys.

### Build Process (`vercel.json`)
The build command runs:
1. `prisma generate` — Generate Prisma client
2. `prisma db push` — Apply schema changes to database  
3. `next build` — Build Next.js application

### Vercel Configuration
- **Auto-deploy:** On push to `master` branch
- **Cron job:** Daily SLA check at 8:30 AM IST (`0 3 * * *` UTC)
- **Edge middleware:** Route protection with NextAuth

### Manual Deployment (if needed)
```bash
npx vercel --prod
```

### Clear Cache (if deployment issues)
```bash
npx vercel cache purge --yes
npx vercel --prod --force
```

---

## API Endpoints

### Authentication
| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/auth/[...nextauth]` | NextAuth sign-in/sign-out |
| POST | `/api/auth/change-password` | Change user password (forced on first login) |

### Finance Requests
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/finance-requests` | List requests (with filters) |
| POST | `/api/finance-requests` | Create a new request |
| GET | `/api/finance-requests/[id]` | Get request details |
| PATCH | `/api/finance-requests/[id]` | Update a request |
| DELETE | `/api/finance-requests/[id]` | Soft-delete a request |
| POST | `/api/finance-requests/[id]/approve` | Approve/Reject/Send-back |
| POST | `/api/finance-requests/[id]/disburse` | Process disbursement |

### Dashboard & Reports
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/dashboard` | Dashboard statistics (supports `from`/`to` date params) |
| GET | `/api/reports` | Generate reports (including entity-wise report) |

### User Management
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/users` | List users |
| POST | `/api/users` | Create a new user |
| GET | `/api/users/[id]` | Get user details |
| PATCH | `/api/users/[id]` | Update user |
| DELETE | `/api/users/[id]` | Deactivate user |\n| GET | `/api/users/online` | Online users list |

### System
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/settings` | Read settings data (all authenticated users) |
| POST/PATCH/DELETE | `/api/settings` | Manage settings (Admin only) |
| POST | `/api/settings/test-email` | Test email configuration |
| POST | `/api/attachments` | Upload file attachment |
| GET | `/api/notifications` | User notifications |
| GET | `/api/cron/check-sla` | SLA breach detection (cron) |

---

## Email Notifications

The system sends automated email notifications for the following events:

| Event | Recipients | Description |
|---|---|---|
| Request Submitted | Requestor + First-level approvers | New request submitted for approval |
| Request Approved | Requestor + Next-level approvers | Approved at a specific level |
| Request Rejected | Requestor | Request denied with comments |
| Request Sent Back | Requestor | Returned for corrections |
| Request Resubmitted | Re-approvers | Corrected request resubmitted |
| Disbursement Complete | Requestor | Payment processed |
| SLA Breach Alert | Current-level approvers + Admin | Overdue approval SLA |
| New User Created | New user + All admins | Welcome email with credentials |
| Password Reset | User + Admin | New password notification |
| Profile Updated | User | Account changes notification |
| Account Deactivated | User | Account disabled notification |

---

## SLA Management

- Each approval level has configurable SLA hours.
- A cron job (`/api/cron/check-sla`) runs periodically to detect breaches.
- Breached steps are flagged visually in the approval timeline (red indicators).
- SLA breach emails are sent to responsible approvers and administrators.
- SLA logs track compliance metrics for reporting.

---

## Reports

The system supports 7 report types:

1. **Request Summary** — Overview of all requests with status and amounts.
2. **Approval Turnaround** — Time taken at each approval level.
3. **Department-wise Analysis** — Request volume and amounts by department.
4. **Payment Mode Analysis** — Breakdown by payment method.
5. **SLA Compliance** — SLA adherence across approval levels.
6. **Monthly Trends** — Month-over-month request and approval trends.
7. **Entity-wise Report** — Request volume, amounts, and status breakdown by entity.

All reports support:
- Date range filtering
- Department/status/payment type filters
- CSV export
- Popup dialog display

---

## Changelog

### v1.0.2 (February 2026)
- **Discussion Thread** — Request-specific comments/chat for requesters and approvers.
- **@Mention Support** — Tag users with @username for notifications.
- **Discussion Email Alerts** — Email notifications for mentions and new comments.
- **Discussion Bell Notifications** — In-app notifications for discussions.

### v1.0.1 (February 2026)
- **Resubmission Limit** — Maximum 2 resubmissions; Admin review required after limit.
- **Required Resubmission Comments** — Requesters must provide explanation when resubmitting (300 char limit).
- **Resubmission Comments Banner** — Approvers see requester's response in blue info card.
- **Daily SLA Reminder Emails** — Auto-sent at 8:30 AM IST for requests pending 24+ hours.
- **Cost-Focused Dashboard** — Expense-centric KPIs (Total Expenses, Disbursed, Pending).
- **Forecast Card** — "Next Month" button for expense projections.
- **Fix:** Admin now receives SLA reminder emails.
- **Fix:** Email duplicates resolved.
- **Deployment:** Auto-deploy via `git push` with `prisma db push` in build.

### v1.0.0 (January 2026)
- Initial release with full approval workflow.
- 6-level approval pipeline.
- Role-based access control (7 roles).
- Email notifications via Gmail SMTP.
- File attachments support.
- SLA tracking with breach detection.
- Dashboard with charts and date filtering.
- Entity-wise management.
- Reports generation with CSV export.

---

## License

This software is proprietary and built exclusively for **National Group India**. Unauthorized copying, distribution, or use is prohibited.

---

*Built & Maintained by Bala Tech Solutions*
