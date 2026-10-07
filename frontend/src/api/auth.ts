/**
 * src/api/auth.ts
 * ================
 * Typed API module for authentication endpoints.
 */

import { api, tokenStore } from './core'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface RegisterRequest {
  name: string
  email: string
  password: string
  phone?: string
  location?: string
}

export interface LoginRequest {
  email: string
  password: string
}

export interface TokenResponse {
  access_token: string
  refresh_token: string
  token_type: string
}

export interface UserProfile {
  id: number
  name: string
  email: string
  phone: string | null
  location: string | null
  role: 'USER' | 'COLLECTOR' | 'ADMIN'
  eco_points: number
  created_at: string
  updated_at: string
}

// ── API calls ─────────────────────────────────────────────────────────────────

export async function register(data: RegisterRequest): Promise<TokenResponse> {
  const res = await api.post<TokenResponse>('/auth/register', data, { skipAuth: true })
  tokenStore.set(res.access_token, res.refresh_token)
  return res
}

export async function login(data: LoginRequest): Promise<TokenResponse> {
  const res = await api.post<TokenResponse>('/auth/login', data, { skipAuth: true })
  tokenStore.set(res.access_token, res.refresh_token)
  return res
}

export async function refreshToken(): Promise<TokenResponse> {
  const refresh = tokenStore.getRefresh()
  if (!refresh) throw new Error('No refresh token available.')
  const res = await api.post<TokenResponse>('/auth/refresh', { refresh_token: refresh }, { skipAuth: true })
  tokenStore.set(res.access_token, res.refresh_token)
  return res
}

export async function getMe(): Promise<UserProfile> {
  return api.get<UserProfile>('/auth/me')
}

export async function logout(): Promise<void> {
  try {
    await api.post('/auth/logout')
  } finally {
    tokenStore.clear()
  }
}
