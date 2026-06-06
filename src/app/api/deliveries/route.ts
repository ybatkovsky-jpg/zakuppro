/**
 * Deliveries API Route — Stub
 *
 * The SQLAlchemy database does not have a Delivery table.
 * Returns an empty list for now. This feature will be implemented
 * when the delivery tracking module is added to FastAPI.
 */
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  return NextResponse.json([])
}

export async function POST(request: Request) {
  return NextResponse.json(
    { error: 'Отслеживание доставок пока недоступно' },
    { status: 501 }
  )
}
