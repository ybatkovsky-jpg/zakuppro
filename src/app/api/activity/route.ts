/**
 * Activity Feed API Route — Proxies to FastAPI backend
 *
 * Aggregates recent activity from project status history and other sources.
 * Since the DB uses SQLAlchemy models (not Prisma), we query FastAPI.
 */
import { apiFetch } from '@/lib/api-client'
import { getAuthHeaders } from '@/lib/auth-proxy'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

interface ActivityItem {
  id: string
  type: 'project_created' | 'status_changed' | 'request_created' | 'invoice_received' | 'warehouse_transaction'
  title: string
  description: string
  timestamp: string
}

export async function GET(request: NextRequest) {
  try {
    const activities: ActivityItem[] = []

    // Fetch recent projects for "project created" activity
    const projectsResult = await apiFetch<any[]>('/api/projects', { headers: getAuthHeaders(request) })
    const projects = projectsResult.data || []

    for (const p of projects.slice(0, 5)) {
      activities.push({
        id: `project-${p.id}`,
        type: 'project_created',
        title: p.name || 'Без названия',
        description: 'Новый проект создан',
        timestamp: p.created_at || new Date().toISOString(),
      })
    }

    // Sort by timestamp desc
    activities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())

    return NextResponse.json(activities.slice(0, 20))
  } catch (error) {
    console.error('Activity error:', error)
    return NextResponse.json([])
  }
}
