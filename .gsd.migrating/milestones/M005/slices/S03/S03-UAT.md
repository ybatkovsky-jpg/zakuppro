# S03: Analytics Dashboard Real Data — UAT

**Milestone:** M005
**Written:** 2026-06-03T05:01:50.181Z

# S03 UAT: Analytics Dashboard Real Data

## UAT Type
**Component Integration UAT** - Verifies frontend components render and fetch data correctly

## Preconditions
1. Next.js frontend running on port 3000
2. FastAPI backend running with analytics endpoints
3. PostgreSQL database with sample invoice/payment data

## Test Cases

### TC1: Financial Metrics Card Display
**Steps:**
1. Navigate to dashboard page
2. Wait for data to load

**Expected Outcome:**
- Financial metrics card appears with three metrics
- Paid invoices count shown in green
- Unpaid invoices count shown in red
- Pending invoices count shown in amber
- Amounts displayed in RUB format (₽)
- Loading skeleton shown during fetch
- Error message shown if API fails

**Not Proven By This UAT:** Runtime data accuracy (requires FastAPI backend)

### TC2: Payment Dynamics Chart Display
**Steps:**
1. Navigate to dashboard page
2. Scroll to Payment Dynamics section
3. Click date range selector (7/30/90 days)
4. Click group_by selector (day/week/month)

**Expected Outcome:**
- Area chart renders with time-series data
- X-axis shows formatted dates (DD.MM for day grouping)
- Y-axis shows amounts in RUB with K/M suffixes
- Tooltip appears on hover with date, amount, count
- Chart updates when date range changes
- Chart updates when group_by changes
- Loading state shown during fetch
- Empty state shown if no data for period

**Not Proven By This UAT:** Actual data values from backend (requires running FastAPI)

### TC3: Dashboard Layout Integration
**Steps:**
1. Navigate to dashboard page
2. Verify component placement
3. Test responsive behavior (resize browser)

**Expected Outcome:**
- FinancialMetricsCard appears after BudgetComparisonBar
- PaymentDynamicsChart appears after KPI Summary Row
- Components animate in with motion effects
- Grid layout responsive on mobile/tablet/desktop
- No layout shift during data loading

## Known Limitations
This UAT verifies component structure and build success. Runtime verification with actual FastAPI backend data is deferred to S05 (Production Readiness Polish) where full Docker Compose integration testing occurs.
