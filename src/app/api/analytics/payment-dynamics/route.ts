/**
 * Analytics Payment Dynamics API Route
 * Proxies to FastAPI backend /api/analytics/payment-dynamics
 */

import { NextRequest, NextResponse } from 'next/server';
import { apiClient } from '@/lib/api-client';

/**
 * GET /api/analytics/payment-dynamics
 * Get payment dynamics time series data from FastAPI backend
 *
 * Query params:
 * - period_start: Optional start date (ISO string)
 * - period_end: Optional end date (ISO string)
 * - group_by: Grouping period - 'day', 'week', or 'month' (default: 'day')
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const periodStart = searchParams.get('period_start');
    const periodEnd = searchParams.get('period_end');
    const groupBy = searchParams.get('group_by') || 'day';

    // Build query params for FastAPI
    const params: Record<string, string> = {
      group_by: groupBy,
    };
    if (periodStart) params.period_start = periodStart;
    if (periodEnd) params.period_end = periodEnd;

    // Proxy to FastAPI
    const result = await apiClient.get<{
      data: Array<{
        date: string;
        paid_amount: number;
        paid_count: number;
      }>;
      total_amount: number;
      total_count: number;
      period_start: string;
      period_end: string;
    }>('/analytics/payment-dynamics', params);

    if (result.error) {
      return NextResponse.json(
        { error: result.error.error, details: result.error.details },
        { status: 500 }
      );
    }

    // FastAPI returns snake_case, transform to camelCase for frontend
    const response = {
      data: result.data.data.map((point) => ({
        date: point.date,
        paidAmount: point.paid_amount,
        paidCount: point.paid_count,
      })),
      totalAmount: result.data.total_amount,
      totalCount: result.data.total_count,
      periodStart: result.data.period_start,
      periodEnd: result.data.period_end,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Analytics payment-dynamics error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch payment dynamics' },
      { status: 500 }
    );
  }
}
