/**
 * POST /api/auth/login - Proxy login requests to FastAPI
 *
 * Handles authentication requests and transforms FastAPI error responses
 * to match the frontend's expected format.
 */

import { NextRequest, NextResponse } from 'next/server';
import { apiFetch } from '@/lib/api-client';
import type { LoginRequest, LoginResponse } from '@/types/fastapi';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate request body
    if (!body.username || !body.password) {
      return NextResponse.json(
        { error: 'Username and password are required' },
        { status: 400 }
      );
    }

    const loginData: LoginRequest = {
      username: body.username,
      password: body.password,
    };

    // Forward request to FastAPI
    const result = await apiFetch<LoginResponse>('/api/auth/login', {
      method: 'POST',
      body: loginData,
    });

    // Handle error response from FastAPI
    if (result.error) {
      const statusCode = (result.error.details as any)?.status || 401;
      return NextResponse.json(
        { error: result.error.error, details: result.error.details },
        { status: statusCode }
      );
    }

    // Return successful login response
    return NextResponse.json(result.data, { status: 200 });
  } catch (error) {
    console.error('Login proxy error:', error);
    return NextResponse.json(
      { error: 'Authentication service unavailable' },
      { status: 503 }
    );
  }
}
