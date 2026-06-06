/**
 * Client-side authenticated fetch wrapper.
 *
 * Automatically adds the Authorization header from localStorage
 * to all requests.
 *
 * Some routes are handled by Next.js API routes directly (using Prisma),
 * while others need to be proxied to the FastAPI backend via /fastapi.
 */

const AUTH_TOKEN_KEY = 'auth_token'

// Client-side: route through Next.js /fastapi proxy to reach FastAPI backend
// Server-side: use FASTAPI_URL env var directly
const API_PREFIX = typeof window === 'undefined'
  ? (process.env.FASTAPI_URL || 'http://localhost:8000')
  : '/fastapi';

// Routes handled by Next.js API routes (Prisma-based) - should NOT go through /fastapi proxy
const NEXTJS_API_ROUTES = [
  '/api/company',
  '/api/settings/',
  '/api/email/',
  '/api/assistant',
  '/api/assistant/chat',
  '/api/seed',
  '/api/reports',
  '/api/search',
]

/**
 * Check if a route should be handled by Next.js API routes directly
 * (not proxied to FastAPI)
 */
function isNextjsRoute(path: string): boolean {
  return NEXTJS_API_ROUTES.some(route => path.startsWith(route))
}

/**
 * Fetch wrapper that automatically adds Authorization header from localStorage.
 * Routes to /fastapi proxy only for FastAPI-backed endpoints.
 */
export async function authFetch(input: string | URL | globalThis.Request, init?: RequestInit): Promise<Response> {
  const token = typeof window !== 'undefined' ? localStorage.getItem(AUTH_TOKEN_KEY) : null

  // If input is a string starting with /api/, decide routing
  let url: string | URL | globalThis.Request = input
  if (typeof input === 'string' && input.startsWith('/api/')) {
    // Check if this route should be handled by Next.js directly
    if (isNextjsRoute(input)) {
      // Use Next.js API route directly (no /fastapi prefix)
      url = input
    } else {
      // Route through /fastapi proxy to FastAPI backend
      url = `${API_PREFIX}${input}`
    }
  }

  const headers = new Headers(init?.headers)

  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`)
  }

  return fetch(url, {
    ...init,
    headers,
  })
}

