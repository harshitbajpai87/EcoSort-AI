/**
 * src/api/pickups.ts
 * ===================
 * Typed API module for pickup request management.
 */

import { api } from './core'

// ── Types ─────────────────────────────────────────────────────────────────────

export type PickupStatus = 'pending' | 'confirmed' | 'completed' | 'cancelled'

export interface PickupRequest {
  id: number
  user_id: number
  waste_category: string
  quantity_kg: number
  address: string
  status: PickupStatus
  created_at: string
}

export interface CreatePickupRequest {
  waste_category: string
  quantity_kg: number
  address: string
}

// ── API calls ─────────────────────────────────────────────────────────────────

export async function createPickup(data: CreatePickupRequest): Promise<PickupRequest> {
  return api.post<PickupRequest>('/pickups/', data)
}

export async function listMyPickups(): Promise<PickupRequest[]> {
  return api.get<PickupRequest[]>('/pickups/')
}

export async function getPickup(id: number): Promise<PickupRequest> {
  return api.get<PickupRequest>(`/pickups/${id}`)
}

export async function cancelPickup(id: number): Promise<PickupRequest> {
  return api.patch<PickupRequest>(`/pickups/${id}/cancel`)
}
