/**
 * Authentication utilities for ZakupPro
 *
 * Handles JWT authentication, login/logout, and user session management.
 */

import { apiFetch } from './api-client';
import { setAuthToken, clearAuthToken, getAuthToken } from './api-client';
import type { LoginRequest, LoginResponse, UserRole } from '@/types/fastapi';

// =============================================================================
// Constants
// =============================================================================

const USER_ROLE_KEY = 'user_role';
const USER_ID_KEY = 'user_id';
const USERNAME_KEY = 'username';

// =============================================================================
// Authentication Functions
// =============================================================================

/**
 * Authenticate user with username and password
 * Stores JWT token and user info on success
 */
export async function login(username: string, password: string): Promise<{
  success: boolean;
  error?: string;
  role?: UserRole;
}> {
  try {
    const loginData: LoginRequest = { username, password };

    const result = await apiFetch<LoginResponse>('/api/auth/login', {
      method: 'POST',
      body: loginData,
    });

    if (result.error) {
      return { success: false, error: result.error.error };
    }

    const { access_token, role } = result.data!;

    // Store token and user info
    setAuthToken(access_token);
    setUserSession(username, role);

    return { success: true, role };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Login failed',
    };
  }
}

/**
 * Log out the current user
 * Clears JWT token and user info from localStorage
 */
export function logout(): void {
  clearAuthToken();
  clearUserSession();
}

/**
 * Check if user is authenticated
 */
export function isAuthenticated(): boolean {
  return getAuthToken() !== null;
}

/**
 * Get the current user's role
 */
export function getUserRole(): UserRole | null {
  if (typeof window === 'undefined') return null;
  const role = localStorage.getItem(USER_ROLE_KEY) as UserRole | null;
  return role;
}

/**
 * Get the current user's ID
 */
export function getUserId(): number | null {
  if (typeof window === 'undefined') return null;
  const userId = localStorage.getItem(USER_ID_KEY);
  return userId ? parseInt(userId, 10) : null;
}

/**
 * Get the current username
 */
export function getUsername(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(USERNAME_KEY);
}

// =============================================================================
// User Session Helpers (Private)
// =============================================================================

function setUserSession(username: string, role: UserRole): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(USER_ROLE_KEY, role);
  localStorage.setItem(USERNAME_KEY, username);
  // User ID will be set when we get it from the /users/me endpoint
  localStorage.removeItem(USER_ID_KEY);
}

function clearUserSession(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(USER_ROLE_KEY);
  localStorage.removeItem(USER_ID_KEY);
  localStorage.removeItem(USERNAME_KEY);
}
