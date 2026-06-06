/**
 * Server-side auth helper for Next.js API routes.
 *
 * Extracts the Authorization header from an incoming browser request
 * so it can be forwarded to the FastAPI backend via apiFetch.
 *
 * Usage in API routes:
 *   import { getAuthHeaders } from '@/lib/auth-proxy'
 *   const result = await apiFetch('/api/projects', { headers: getAuthHeaders(request) })
 */

import { NextRequest } from 'next/server'

/**
 * Extract Authorization header from a NextRequest (browser → Next.js server).
 * Returns a headers object suitable for passing to apiFetch options.
 */
export function getAuthHeaders(request: NextRequest): Record<string, string> {
  const authHeader = request.headers.get('Authorization')
  if (authHeader) {
    return { Authorization: authHeader }
  }
  return {}
}

/**
 * Extract Authorization header and also forward Content-Type.
 * Useful for POST/PUT/PATCH routes that forward body to FastAPI.
 */
export function getForwardedHeaders(request: NextRequest): Record<string, string> {
  const headers: Record<string, string> = {}
  const authHeader = request.headers.get('Authorization')
  if (authHeader) {
    headers['Authorization'] = authHeader
  }
  const contentType = request.headers.get('Content-Type')
  if (contentType) {
    headers['Content-Type'] = contentType
  }
  return headers
}
