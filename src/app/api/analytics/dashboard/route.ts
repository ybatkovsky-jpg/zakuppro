/**
 * Analytics Dashboard API Route
 * Proxies to FastAPI backend /api/analytics/dashboard
 */

import { NextRequest, NextResponse } from 'next/server';
import { apiClient } from '@/lib/api-client'
import { getAuthHeaders } from '@/lib/auth-proxy';

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
    const result = await apiClient.fetch<{
      paid_invoices_count: number;
      unpaid_invoices_count: number;
      total_paid_amount: number;
      total_unpaid_amount: number;
      pending_invoices_count: number;
      period_start: string;
      period_end: string;
    }>('/analytics/dashboard', { headers: getAuthHeaders(request), params });

    if (result.error || !result.data) {
      return NextResponse.json(
        { error: result.error?.error || 'No data returned from backend', details: result.error?.details },
        { status: 500 }
      );
    }

    // FastAPI returns snake_case, frontend expects camelCase
    // Transform response
    const data = result.data;
    const response = {
      paidInvoicesCount: data.paid_invoices_count,
      unpaidInvoicesCount: data.unpaid_invoices_count,
      totalPaidAmount: data.total_paid_amount,
      totalUnpaidAmount: data.total_unpaid_amount,
      pendingInvoicesCount: data.pending_invoices_count,
      periodStart: data.period_start,
      periodEnd: data.period_end,
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
