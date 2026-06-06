/**
 * Catch-all proxy route: /fastapi/* → FastAPI backend
 *
 * This route proxies ALL client-side API calls to the FastAPI backend.
 * It runs on the Next.js server where FASTAPI_URL env var is available
 * (e.g. http://api:8000 in Docker), so the browser never needs to know
 * the backend URL directly. This avoids CORS issues entirely.
 *
 * Usage from client code:  apiFetch('/api/auth/login', { ... })
 *   → browser sends POST /fastapi/api/auth/login
 *   → this route proxies to http://api:8000/api/auth/login
 */

import { NextRequest, NextResponse } from 'next/server';

const FASTAPI_URL = process.env.FASTAPI_URL || 'http://localhost:8000';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path?: string[] }> }
) {
  return proxyRequest(request, params);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ path?: string[] }> }
) {
  return proxyRequest(request, params);
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ path?: string[] }> }
) {
  return proxyRequest(request, params);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ path?: string[] }> }
) {
  return proxyRequest(request, params);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ path?: string[] }> }
) {
  return proxyRequest(request, params);
}

async function proxyRequest(
  request: NextRequest,
  paramsPromise: Promise<{ path?: string[] }>
) {
  const { path } = await paramsPromise;
  const pathStr = (path || []).join('/');
  const url = `${FASTAPI_URL}/${pathStr}`;

  // Forward query parameters
  const searchParams = request.nextUrl.searchParams.toString();
  const fullUrl = searchParams ? `${url}?${searchParams}` : url;

  // Build headers — forward Authorization and Content-Type
  const headers: Record<string, string> = {};
  const authHeader = request.headers.get('Authorization');
  if (authHeader) {
    headers['Authorization'] = authHeader;
  }
  const contentType = request.headers.get('Content-Type');
  if (contentType) {
    headers['Content-Type'] = contentType;
  }

  try {
    // Build fetch options
    const fetchOptions: RequestInit = {
      method: request.method,
      headers,
    };

    // Forward request body for non-GET methods
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      fetchOptions.body = await request.text();
    }

    const response = await fetch(fullUrl, fetchOptions);

    // Build response headers
    const responseHeaders = new Headers();
    const responseContentType = response.headers.get('Content-Type');
    if (responseContentType) {
      responseHeaders.set('Content-Type', responseContentType);
    }

    return new NextResponse(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
    });
  } catch (error) {
    console.error(`Proxy error [${request.method}] /fastapi/${pathStr}:`, error);
    return NextResponse.json(
      { error: 'Backend service unavailable' },
      { status: 503 }
    );
  }
}
