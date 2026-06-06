/**
 * Client-side authenticated fetch wrapper.
 *
 * Automatically adds the Authorization header from localStorage
 * to all requests going to Next.js API routes (/api/...).
 *
 * Usage (replace fetch with authFetch in components):
 *   const res = await authFetch('/api/stats')
 *   const res = await authFetch('/api/projects', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
 */

const AUTH_TOKEN_KEY = 'auth_token'

/**
 * Fetch wrapper that automatically adds Authorization header from localStorage.
 * Drop-in replacement for fetch() when calling /api/ routes from browser components.
 */
export async function authFetch(input: string | URL | globalThis.Request, init?: RequestInit): Promise<Response> {
  const token = typeof window !== 'undefined' ? localStorage.getItem(AUTH_TOKEN_KEY) : null

  const headers = new Headers(init?.headers)

  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`)
  }

  return fetch(input, {
    ...init,
    headers,
  })
}
