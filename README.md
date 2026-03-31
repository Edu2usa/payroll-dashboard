# Payroll Dashboard - Preferred Maintenance, LLC

A complete Next.js 14 payroll dashboard application that ingests Paychex payroll journal PDFs, extracts employee payroll data into a Supabase database, and provides comprehensive payroll analysis with discrepancy detection.

## Features

- **PDF Upload & Processing**: Drag-and-drop PDF upload with automatic Paychex format parsing
- **Employee Management**: View all employees, search by name or ID, and see individual pay history
- **Payroll Analysis**: Dashboard with gross/net totals, employee counts, and trend charts
- **Period Comparison**: Compare last 2-3 payroll periods side by side with variance analysis
- **Discrepancy Detection**: Automatic detection of 9 types of payroll anomalies:
  - Hours change (>20% variance)
  - Hourly rate changes
  - New employees
  - Missing employees from previous period
  - Overtime spikes (>20 hours)
  - Earnings/hours calculation anomalies
  - Deduction changes
  - Department changes
  - Tax withholding anomalies

- **API Access**: RESTful API with x-api-key header authentication for OpenClaw agents
- **Session Management**: Secure httpOnly cookie-based web authentication

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Database**: Supabase PostgreSQL
- **Styling**: Tailwind CSS
- **Charts**: Recharts
- **PDF Parsing**: pdf-parse (server-side)
- **Supabase Client**: @supabase/supabase-js

## Database Schema

### payroll_periods
- `id` (uuid, PK)
- `period_start` (date)
- `period_end` (date)
- `check_date` (date)
- `run_date` (timestamp)
- `total_gross` (numeric)
- `total_net` (numeric)
- `total_withholdings` (numeric)
- `total_deductions` (numeric)
- `employee_count` (int)
- `status` (text)
- `pdf_filename` (text)
- `created_at` (timestamp)

### employees
- `id` (uuid, PK)
- `employee_id` (text, UNIQUE)
- `name` (text)
- `department` (int)
- `hourly_rate` (numeric)
- `is_active` (boolean)
- `first_seen` (date)
- `last_seen` (date)
- `created_at` (timestamp)

### payroll_entries
- `id` (uuid, PK)
- `payroll_period_id` (uuid, FK)
- `employee_id` (uuid, FK)
- `department` (int)
- Regular/Overtime/Double Time/Vacation hours and earnings
- All withholdings (Social Security, Medicare, Fed/CT Income Tax, CT PFL)
- All deductions (Health, Simple IRA, Other)
- `total_hours`, `total_earnings`, `total_withholdings`, `total_deductions`
- `net_pay` (numeric)
- `check_number`, `direct_deposit_number` (text)
- `created_at` (timestamp)

### discrepancies
- `id` (uuid, PK)
- `payroll_period_id` (uuid, FK)
- `employee_id` (uuid, FK)
- `type` (text)
- `severity` (text: info/medium/high)
- `description` (text)
- `previous_value`, `current_value`, `difference` (numeric)
- `is_reviewed` (boolean)
- `reviewed_at` (timestamp)
- `created_at` (timestamp)

## Setup

### Prerequisites

- Node.js 18+
- Supabase account with database configured
- Environment variables configured

### Installation

1. Install dependencies:
```bash
npm install
```

2. Configure environment variables in `.env.local`:
```
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
APP_PASSWORD=PreferredMaint2026!
API_KEY=your-api-key
```

3. Run development server:
```bash
npm run dev
```

4. Build for production:
```bash
npm run build
npm start
```

## Paychex PDF Format Support

The parser handles the exact Paychex payroll journal format including:

- Department headers: `**** 1DEPARTMENT1`, `**** 2DEPARTMENT2`, etc.
- Employee names and IDs
- All earning types: Regular, Overtime, Double Time, Vacation
- All withholdings: Social Security, Medicare, Federal/CT Income Tax, CT PFL
- All deductions: Health Insurance, Simple IRA, Other
- Multi-check employees (CHECK1TOTAL, CHECK2TOTAL, then EMPLOYEE TOTAL)
- Department and company totals
- Run dates and period dates from footer

## API Endpoints

All endpoints require authentication:
- **Web**: `payroll_session` httpOnly cookie (set via POST /api/auth/login)
- **API**: `x-api-key` header

### Authentication
- `POST /api/auth/login` - Login with password
- `GET /api/auth/session` - Check session status

### Payroll Periods
- `GET /api/payroll-periods` - List all periods
- `GET /api/payroll-periods/[id]` - Get period details with entries

### Employees
- `GET /api/employees` - List all employees (supports ?search=query)
- `GET /api/employees/[id]` - Get employee details with pay history

### Payroll Entries
- Embedded in payroll-periods and employees endpoints

### Discrepancies
- `GET /api/discrepancies` - List discrepancies (supports ?reviewed=true/false, ?severity=high/medium/info)
- `PATCH /api/discrepancies/[id]` - Mark as reviewed

### Comparison
- `GET /api/comparison?periodId=[id]` - Compare period with previous

### Upload
- `POST /api/upload` - Upload and process PDF (FormData with 'file' field)

## Pages

- `/` - Login page
- `/dashboard` - Main dashboard with totals, charts, and recent periods
- `/upload` - Drag-and-drop PDF upload
- `/employees` - Employee list with search
- `/employees/[id]` - Individual employee pay history
- `/history` - All payroll periods
- `/comparison?periodId=[id]` - Period comparison with variance analysis
- `/settings` - Application settings

## Project Structure

```
payroll-dashboard/
├── app/
│   ├── api/
│   │   ├── auth/
│   │   │   ├── login/route.ts
│   │   │   └── session/route.ts
│   │   ├── upload/route.ts
│   │   ├── payroll-periods/
│   │   ├── employees/
│   │   ├── discrepancies/
│   │   └── comparison/route.ts
│   ├── dashboard/page.tsx
│   ├── upload/page.tsx
│   ├── employees/
│   ├── comparison/page.tsx
│   ├── history/page.tsx
│   ├── settings/page.tsx
│   ├── layout.tsx
│   ├── page.tsx (login)
│   └── globals.css
├── lib/
│   ├── supabase.ts
│   ├── auth.ts
│   ├── pdf-parser.ts
│   └── discrepancy-detector.ts
├── package.json
├── tsconfig.json
├── next.config.js
├── tailwind.config.js
└── postcss.config.js
```

## Build Status

✓ Build successful with `npm run build`
✓ All TypeScript types validated
✓ All API routes configured
✓ All pages rendered

## Notes

- The app uses server-side PDF parsing with pdf-parse for security
- Discrepancies are automatically detected during PDF upload
- All dates are stored in ISO format (YYYY-MM-DD)
- Monetary values are stored as numeric (decimal)
- Sessions expire after 7 days of inactivity
- The app supports up to 77 employees across 3 departments as per Paychex format
- Biweekly pay period processing supported

## Security

- Web authentication: Simple password stored in APP_PASSWORD env var
- API authentication: x-api-key header validation
- Session cookies: httpOnly, secure in production, sameSite=lax
- PDF parsing: Server-side only, no client exposure
- Database: Supabase with service role key separation

## Future Enhancements

- Batch PDF upload
- Report generation (PDF/Excel)
- Email notifications for discrepancies
- Role-based access control (admin, manager, employee)
- Audit logging
- Advanced filtering and exports
- Mobile app
