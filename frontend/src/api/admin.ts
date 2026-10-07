/**
 * src/api/admin.ts
 * =================
 * Typed API module for admin-only operations.
 */

import { api } from './core'
import type { UserProfile } from './auth'
import type { PickupRequest } from './pickups'

export interface AdminStats {
  total_users: number
  total_scans: number
  total_pickups: number
  pending_pickups: number
  completed_pickups: number
  total_feedbacks: number
  incorrect_predictions: number
}

// ── Users ─────────────────────────────────────────────────────────────────────

export async function adminListUsers(page = 1, limit = 50): Promise<UserProfile[]> {
  return api.get<UserProfile[]>(`/admin/users?page=${page}&limit=${limit}`)
}

export async function adminGetUser(id: number): Promise<UserProfile> {
  return api.get<UserProfile>(`/admin/users/${id}`)
}

export async function adminUpdateUserRole(
  id: number,
  role: 'USER' | 'COLLECTOR' | 'ADMIN',
): Promise<UserProfile> {
  return api.patch<UserProfile>(`/admin/users/${id}/role`, { role })
}

// ── Pickups ───────────────────────────────────────────────────────────────────

export async function adminListPickups(): Promise<PickupRequest[]> {
  return api.get<PickupRequest[]>('/admin/pickups')
}

export async function adminUpdatePickupStatus(
  id: number,
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled',
): Promise<PickupRequest> {
  return api.patch<PickupRequest>(`/admin/pickups/${id}/status`, { status })
}

// ── Stats ─────────────────────────────────────────────────────────────────────

export async function adminGetStats(): Promise<AdminStats> {
  return api.get<AdminStats>('/admin/stats')
}
