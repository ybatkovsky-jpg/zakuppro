# S03: Analytics Dashboard Real Data - Research

## Summary

Slice S03 connects the existing Analytics dashboard to FastAPI backend endpoints that return real invoice payment metrics. The slice involves creating frontend components to display dashboard metrics and payment dynamics data using the already-migrated API proxy routes from S01.

## Key Findings

### 1. Existing API Proxy Routes (from S01)

**Already migrated and ready to use:**
- `/api/analytics/dashboard` - Proxy to FastAPI `GET /analytics/dashboard`
- `/api/analytics/payment-dynamics` - Proxy to FastAPI `GET /analytics/payment-dynamics`

**Source files:**
- `src/app/api/analytics/dashboard/route.ts` - Transforms snake_case to camelCase
- `src/app/api/analytics/payment-dynamics/route.ts` - Transforms time-series data
- `src/lib/api/analytics.ts` - Typed API client methods (`getDashboardMetrics`, `getPaymentDynamics`)

### 2. FastAPI Backend Data Structures

**Dashboard Metrics (`/api/analytics/dashboard`):**
```typescript
{
  paidInvoicesCount: number;      // Invoices with status 'Оплачен'
  unpaidInvoicesCount: number;    // Invoices with status in ('Ожидает сверки', 'Ошибки', 'Ожидает оплаты')
  totalPaidAmount: number;        // Sum of all payments
  totalUnpaidAmount: number;      // Sum of unpaid invoice totals
  pendingInvoicesCount: number;   // Invoices with status 'Сверен'
  periodStart: string;            // ISO date
  periodEnd: string;              // ISO date
}
```

**Payment Dynamics (`/api/analytics/payment-dynamics`):**
```typescript
{
  data: Array<{
    date: string;           // Grouped date bucket
    paidAmount: number;     // Total payment amount in period
    paidCount: number;      // Number of payments
  }>;
  totalAmount: number;
  totalCount: number;
  periodStart: string;
  periodEnd: string;
}
```

**Query parameters:**
- `period_start`: Optional ISO date string
- `period_end`: Optional ISO date string
- `group_by`: 'day' | 'week' | 'month' (for payment-dynamics)

**Date range defaults to last 30 days if not specified. Maximum range is 365 days.**

### 3. Existing Analytics Page (`src/components/app/analytics.tsx`)

The Analytics page currently displays mock data and has placeholders for:
- KPI scorecards (total processed, avg invoice, active suppliers, completion rate)
- Procurement pipeline (horizontal funnel chart)
- Supplier comparison (table with delivery metrics)
- Category spending (budget vs spent bars)
- Monthly trends (bar chart with SVG trend line)

**Current data sources (all Prisma-based):**
- `/api/stats` - General statistics
- `/api/analytics/pipeline` - ProjectItem status counts
- `/api/analytics/suppliers` - Supplier performance metrics

### 4. Existing Dashboard (`src/components/app/dashboard.tsx`)

The main dashboard page (`/dashboard`) shows:
- Budget execution (circular progress)
- Project statuses (pie chart)
- Project trends (area chart)
- Warehouse stock overview
- Project costs (table)
- Recent projects
- Urgent items
- Activity feed

**All data comes from `/api/stats` (Prisma, not migrated).**

### 5. Chart Infrastructure

**Recharts is already installed and used:**
- `src/components/ui/chart.tsx` - Shadcn chart wrapper around Recharts
- Components: ChartContainer, ChartTooltip, ChartLegend
- Used in both dashboard.tsx and analytics.tsx

**Chart types in use:**
- BarChart, AreaChart, PieChart
- Custom SVG charts in analytics.tsx (MiniSparkline, trend line)

## Implementation Approach

### Option A: Extend Existing Analytics Page

Add new sections to `src/components/app/analytics.tsx`:
1. **Financial Metrics Card** - Display paid/unpaid invoice counts and amounts
2. **Payment Dynamics Chart** - Time-series line/area chart showing payment trends

**Pros:**
- Fits the "Analytics" theme naturally
- Reuses existing page layout and patterns
- Minimal UI changes

**Cons:**
- Analytics page is already focused on procurement KPIs (not financial)

### Option B: Create New Dashboard Section

Add financial overview cards to `src/components/app/dashboard.tsx`:
1. **Invoice Status Card** - Paid/Unpaid/Pending invoice counts
2. **Payment Trends Card** - Payment dynamics chart

**Pros:**
- Dashboard is the main landing page - more visibility
- Natural fit alongside budget execution chart
- Higher user value

**Cons:**
- Dashboard is data-heavy already

### Recommended Approach: Option B

Add financial metrics to the main dashboard where budget execution already exists. Users viewing budget execution would naturally want to see invoice status and payment trends.

## Tasks Breakdown

### T01: Create Financial Metrics Card Component
**File:** `src/components/app/financial-metrics-card.tsx` (new)

Display metrics from `/api/analytics/dashboard`:
- Three mini cards or a single card with three sections
- Metrics: paid count, unpaid count, pending count, total paid amount, total unpaid amount
- Color coding: green (paid), amber (pending), red (unpaid)
- Use `useQuery` from `@tanstack/react-query`
- Fetch via `analyticsApi.getDashboardMetrics()`

**Verification:** Card displays non-zero values when FastAPI backend has invoice data

### T02: Create Payment Dynamics Chart Component
**File:** `src/components/app/payment-dynamics-chart.tsx` (new)

Display time-series chart from `/api/analytics/payment-dynamics`:
- Use Recharts AreaChart or LineChart
- X-axis: date (formatted as DD.MM or MMM YY)
- Y-axis: paid_amount (RUB)
- Optional: Toggle for group_by (day/week/month)
- Tooltip showing date, amount, count
- Use `analyticsApi.getPaymentDynamics(params)`

**Verification:** Chart renders with data points when payments exist in date range

### T03: Integrate Financial Cards into Dashboard
**File:** `src/components/app/dashboard.tsx`

Add the new components:
- Insert FinancialMetricsCard in the KPI section or alongside BudgetExecutionCard
- Insert PaymentDynamicsChart in the charts section (with ProjectStatusCard and TrendChart)
- Ensure responsive layout (grid cols on mobile vs desktop)

**Verification:** Dashboard page loads with new cards, no layout break

### T04: Add Date Range Filter
**File:** `src/components/app/payment-dynamics-chart.tsx` + `src/components/ui/date-range-picker.tsx` (if needed)

Add UI for date filtering:
- Simple select for preset ranges: "Last 7 days", "Last 30 days", "Last 90 days", "This year"
- Pass period_start/period_end to getDashboardMetrics and getPaymentDynamics
- Default: last 30 days (matches FastAPI default)

**Verification:** Changing filter updates data displayed

## Dependencies

### From S01 (Completed)
- `src/lib/api-client.ts` - apiClient.get wrapper
- `src/lib/api/analytics.ts` - getDashboardMetrics, getPaymentDynamics methods
- `src/types/fastapi.ts` - DashboardMetricsResponse, PaymentDynamicsResponse types
- `src/app/api/analytics/dashboard/route.ts` - Proxy route with transformation
- `src/app/api/analytics/payment-dynamics/route.ts` - Proxy route with transformation

### External Libraries
- `recharts` - Already installed and used
- `@tanstack/react-query` - Already used for data fetching
- `date-fns` or native Intl - For date formatting

## Constraints

1. **No Prisma queries** - All data must come through FastAPI proxy routes
2. **Date range validation** - Frontend should validate max 365 days before calling API
3. **Snake_case to camelCase** - Already handled in proxy routes, frontend uses camelCase
4. **Empty state handling** - Show meaningful UI when no invoice/payment data exists

## Known Limitations

1. **Invoice data may be sparse** - FastAPI Invoice model is linked to PurchaseOrder (M003 bank integration), not directly to Projects like Prisma Invoice. Financial metrics depend on invoices being created through the OCR/bank workflow.

2. **Payment data requires bank integration** - PaymentDynamics comes from Payment records which are created during bank statement matching (M004). Without bank statements, charts will be empty.

3. **Historical data** - If the system is new, there may not be 30 days of data for default date range. UI should handle this gracefully.

## Verification Strategy

### Build Verification
- `npm run build` - No TypeScript errors

### Component Verification
- Storybook or manual verification of:
  - FinancialMetricsCard with mock data
  - PaymentDynamicsChart with mock data

### Runtime Verification
Requires FastAPI backend + PostgreSQL with:
- At least one Invoice record
- At least one Payment record
- BankStatement data for payment dynamics

### Smoke Test
1. Start FastAPI backend
2. Navigate to `/dashboard`
3. Verify financial cards appear
4. Verify payment chart appears (may be empty if no data)
5. Change date range filter
6. Verify data refreshes

## Files to Create/Modify

### New Files
1. `src/components/app/financial-metrics-card.tsx` - Financial metrics display
2. `src/components/app/payment-dynamics-chart.tsx` - Time-series chart

### Modified Files
1. `src/components/app/dashboard.tsx` - Import and place new components

### No Backend Changes Required
- FastAPI endpoints already exist from M004
- Proxy routes already migrated in S01
- TypeScript types already defined

## Forward Intelligence

### Risks
1. **Data availability** - If M003/M004 bank integration was not fully used, invoice/payment data may be empty. Consider fallback to Prisma Invoice data for demo purposes.

2. **Performance** - Date range queries with large date ranges may be slow. Frontend should debounce filter changes.

3. **Rechart responsive issues** - Recharts can have SSR issues. Ensure components are client-side only (`'use client'`).

### Changed Assumptions
- **Original roadmap assumption:** Analytics dashboard would fetch real-time metrics from FastAPI
- **Current state:** FastAPI endpoints exist but depend on bank-integration workflow (M004). If users didn't use bank statement upload, charts will be empty.

### Watch-outs
1. **Date formatting** - Ensure consistent date display across components (Russian locale)
2. **Currency formatting** - Use Intl.NumberFormat for RUB display
3. **Empty state UX** - Don't show empty charts - show "No data" message with call-to-action
4. **Loading states** - Recharts can flicker on load - use Skeleton components

## Integration with Other Slices

- **S01** - Depends on completed API proxy routes
- **S02 (Kanban)** - No direct dependency, separate UI area
- **S04 (RBAC)** - May need permission checks for viewing financial data (deferred to S04)
- **S05 (Production Readiness)** - These components will be part of production deployment

## Success Criteria

1. Financial metrics card displays real data from FastAPI `/api/analytics/dashboard`
2. Payment dynamics chart renders time-series from `/api/analytics/payment-dynamics`
3. Components integrate cleanly into existing dashboard layout
4. Date range filter updates data without page reload
5. Empty states show helpful messaging
6. Build passes with no TypeScript errors
