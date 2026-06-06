/**
 * Client-side authenticated fetch wrapper.
 *
 * Automatically adds the Authorization header from localStorage
 * to all requests going to the FastAPI backend via the /fastapi proxy.
 *
 * On the client side, all /api/ requests are routed through /fastapi/api/...
 * so the browser never needs to know the backend URL directly.
 * This avoids CORS issues and hardcoded IPs.
 */

const AUTH_TOKEN_KEY = 'auth_token'

// Client-side: route through Next.js /fastapi proxy to reach FastAPI backend
// Server-side: use FASTAPI_URL env var directly
const API_PREFIX = typeof window === 'undefined'
  ? (process.env.FASTAPI_URL || 'http://localhost:8000')
  : '/fastapi';

/**
 * Fetch wrapper that automatically adds Authorization header from localStorage
 * and routes requests through the /fastapi proxy.
 */
export async function authFetch(input: string | URL | globalThis.Request, init?: RequestInit): Promise<Response> {
  const token = typeof window !== 'undefined' ? localStorage.getItem(AUTH_TOKEN_KEY) : null

  // If input is a string starting with /api/, prepend the API prefix
  let url: string | URL | globalThis.Request = input
  if (typeof input === 'string' && input.startsWith('/api/')) {
    url = `${API_PREFIX}${input}`
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

