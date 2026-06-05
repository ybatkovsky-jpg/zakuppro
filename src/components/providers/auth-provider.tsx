'use client'

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import type { User, UserRole } from '@/types/fastapi'
import { login as authLogin, logout as authLogout } from '@/lib/auth'
import { apiFetch, setOnUnauthorized } from '@/lib/api-client'

interface AuthContextType {
  user: User | null
  role: UserRole | null
  token: string | null
  isAuthenticated: boolean
  isLoading: boolean
  login: (username: string, password: string) => Promise<{ success: boolean; error?: string }>
  logout: () => void
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // On mount: restore session from localStorage token
  useEffect(() => {
    const storedToken = localStorage.getItem('auth_token')
    if (storedToken) {
      setToken(storedToken)
      apiFetch<User>('/api/auth/users/me')
        .then((result) => {
          if (result.data) {
            setUser({ id: result.data.id, username: result.data.username, role: result.data.role })
          } else {
            // Token invalid or expired — clear state
            authLogout()
            setToken(null)
          }
        })
        .catch(() => {
          authLogout()
          setToken(null)
        })
        .finally(() => setIsLoading(false))
    } else {
      setIsLoading(false)
    }
  }, [])

  // Register 401 callback for auto-logout on token expiration
  useEffect(() => {
    setOnUnauthorized(() => {
      authLogout()
      setUser(null)
      setToken(null)
    })
    return () => setOnUnauthorized(null)
  }, [])

  const login = useCallback(async (username: string, password: string): Promise<{ success: boolean; error?: string }> => {
    const result = await authLogin(username, password)
    if (!result.success) {
      return result
    }

    // authLogin already stored the token and basic info in localStorage
    const storedToken = localStorage.getItem('auth_token')
    setToken(storedToken)

    // Fetch full user object from backend
    try {
      const meResult = await apiFetch<User>('/api/auth/users/me')
      if (meResult.data) {
        setUser({ id: meResult.data.id, username: meResult.data.username, role: meResult.data.role })
      } else {
        // Token was stored but /users/me failed — treat as authenticated with partial info
        const role = localStorage.getItem('user_role') as UserRole | null
        const username = localStorage.getItem('username')
        if (role && username) {
          setUser({ id: 0, username, role })
        }
      }
    } catch {
      // login succeeded even if /users/me fails
      const role = localStorage.getItem('user_role') as UserRole | null
      const username = localStorage.getItem('username')
      if (role && username) {
        setUser({ id: 0, username, role })
      }
    }

    return { success: true }
  }, [])

  const logout = useCallback(() => {
    authLogout()
    setUser(null)
    setToken(null)
  }, [])

  const role = user?.role ?? null
  const isAuthenticated = !!token && !!user

  return (
    <AuthContext.Provider value={{ user, role, token, isAuthenticated, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return ctx
}
