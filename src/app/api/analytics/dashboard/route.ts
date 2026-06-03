/**
 * Analytics Dashboard API Route
 * Proxies to FastAPI backend /api/analytics/dashboard
 */

import { NextRequest, NextResponse } from 'next/server';
import { apiClient } from '@/lib/api-client';

/**
 * GET /api/analytics/dashboard
 * Get dashboard metrics from FastAPI backend
 *
 * Query params:
 * - period_start: Optional start date (ISO string)
 * - period_end: Optional end date (ISO string)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const periodStart = searchParams.get('period_start');
    const periodEnd = searchParams.get('period_end');

    // Build query params for FastAPI
    const params: Record<string, string | undefined> = {};
    if (periodStart) params.period_start = periodStart;
    if (periodEnd) params.period_end = periodEnd;

    // Proxy to FastAPI
    const result = await apiClient.get<{
      paid_invoices_count: number;
      unpaid_invoices_count: number;
      total_paid_amount: number;
      total_unpaid_amount: number;
      pending_invoices_count: number;
      period_start: string;
      period_end: string;
    }>('/analytics/dashboard', params);

    if (result.error) {
      return NextResponse.json(
        { error: result.error.error, details: result.error.details },
        { status: 500 }
      );
    }

    // FastAPI returns snake_case, frontend expects camelCase
    // Transform response
    const response = {
      paidInvoicesCount: result.data.paid_invoices_count,
      unpaidInvoicesCount: result.data.unpaid_invoices_count,
      totalPaidAmount: result.data.total_paid_amount,
      totalUnpaidAmount: result.data.total_unpaid_amount,
      pendingInvoicesCount: result.data.pending_invoices_count,
      periodStart: result.data.period_start,
      periodEnd: result.data.period_end,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Analytics dashboard error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch dashboard metrics' },
      { status: 500 }
    );
  }
}
