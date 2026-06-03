/**
 * FastAPI Client for ZakupPro
 *
 * Provides a typed fetch wrapper for communicating with the FastAPI backend.
 * Handles authentication, error transformation, and standard request/response processing.
 */

import type { ApiError } from '@/types/fastapi';

// =============================================================================
// Configuration
// =============================================================================

const FASTAPI_URL = process.env.FASTAPI_URL || 'http://localhost:8000';
const FASTAPI_AUTH_TOKEN = process.env.FASTAPI_AUTH_TOKEN;

// =============================================================================
// Types
// =============================================================================

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  body?: unknown;
  headers?: Record<string, string>;
  params?: Record<string, string | number | boolean | undefined>;
}

export interface ApiResult<T> {
  data: T | null;
  error: ApiError | null;
}

// =============================================================================
// Error Handling
// =============================================================================

class ApiError_ extends Error {
  status: number;
  details?: unknown;

  constructor(message: string, status: number, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details;
  }
}

/**
 * Transform FastAPI HTTPException response into standard ApiError format
 */
function transformError(response: Response, body?: unknown): ApiError {
  const status = response.status;

  // FastAPI HTTPException format: { "detail": string | object }
  let message = 'An error occurred';
  let details: unknown;

  if (body && typeof body === 'object' && 'detail' in body) {
    const detail = body.detail;
    if (typeof detail === 'string') {
      message = detail;
    } else if (detail && typeof detail === 'object') {
      message = 'API request failed';
      details = detail;
    }
  } else if (body && typeof body === 'string') {
    message = body;
  } else {
    message = response.statusText || `HTTP ${status}`;
  }

  return { error: message, details };
}

/**
 * Build query string from params object
 */
function buildQueryString(params: Record<string, string | number | boolean | undefined>): string {
  const searchParams = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) {
      searchParams.append(key, String(value));
    }
  }
  const queryString = searchParams.toString();
  return queryString ? `?${queryString}` : '';
}

// =============================================================================
// API Client
// =============================================================================

/**
 * Core fetch function with error handling and authentication
 */
export async function apiFetch<T>(
  endpoint: string,
  options: RequestOptions = {}
): Promise<ApiResult<T>> {
  const url = `${FASTAPI_URL}${endpoint}`;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  // Add Authorization header if token is configured
  if (FASTAPI_AUTH_TOKEN) {
    headers['Authorization'] = `Bearer ${FASTAPI_AUTH_TOKEN}`;
  }

  const config: RequestInit = {
    method: options.method || 'GET',
    headers,
  };

  if (options.body) {
    config.body = JSON.stringify(options.body);
  }

  // Add query parameters if provided
  let fullUrl = url;
  if (options.params) {
    fullUrl += buildQueryString(options.params);
  }

  try {
    const response = await fetch(fullUrl, config);

    // Handle 204 No Content (successful delete, etc.)
    if (response.status === 204) {
      return { data: null as T, error: null };
    }

    // Parse JSON body
    let body: unknown;
    const contentType = response.headers.get('content-type');
    if (contentType?.includes('application/json')) {
      body = await response.json();
    } else {
      body = await response.text();
    }

    // Check for error status
    if (!response.ok) {
      const error = transformError(response, body);
      return { data: null, error };
    }

    return { data: body as T, error: null };
  } catch (err) {
    // Network errors, fetch errors, etc.
    const error: ApiError = {
      error: err instanceof Error ? err.message : 'Network error',
    };
    return { data: null, error };
  }
}

// =============================================================================
// HTTP Method Helpers
// =============================================================================

export async function get<T>(
  endpoint: string,
  params?: Record<string, string | number | boolean | undefined>
): Promise<ApiResult<T>> {
  return apiFetch<T>(endpoint, { method: 'GET', params });
}

export async function post<T>(
  endpoint: string,
  body?: unknown
): Promise<ApiResult<T>> {
  return apiFetch<T>(endpoint, { method: 'POST', body });
}

export async function put<T>(
  endpoint: string,
  body?: unknown
): Promise<ApiResult<T>> {
  return apiFetch<T>(endpoint, { method: 'PUT', body });
}

export async function patch<T>(
  endpoint: string,
  body?: unknown
): Promise<ApiResult<T>> {
  return apiFetch<T>(endpoint, { method: 'PATCH', body });
}

export async function del<T>(
  endpoint: string
): Promise<ApiResult<T>> {
  return apiFetch<T>(endpoint, { method: 'DELETE' });
}

// =============================================================================
// Convenience Functions
// =============================================================================

/**
 * Throws an error if the API result contains an error
 * Useful for handling API responses in a try/catch pattern
 */
export function throwErrorOnError<T>(result: ApiResult<T>): T {
  if (result.error) {
    throw new ApiError_(
      result.error.error,
      0, // Status not available in ApiResult
      result.error.details
    );
  }
  return result.data as T;
}

/**
 * Check if the API result is successful
 */
export function isSuccess<T>(result: ApiResult<T>): result is ApiResult<T> & { data: T } {
  return result.error === null && result.data !== null;
}

/**
 * Check if the API result failed
 */
export function isFailure<T>(result: ApiResult<T>): result is ApiResult<T> & { error: ApiError } {
  return result.error !== null;
}

// =============================================================================
// Export default client object
// =============================================================================

export const apiClient = {
  get,
  post,
  put,
  patch,
  delete: del,
  fetch: apiFetch,
};

export default apiClient;
