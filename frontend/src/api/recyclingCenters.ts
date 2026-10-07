/**
 * src/api/recyclingCenters.ts
 * ============================
 * Typed API module for recycling center data.
 */

import { api } from './core'

export interface RecyclingCenter {
  id: number
  name: string
  address: string
  accepted_categories: string[]
  latitude: number | null
  longitude: number | null
  opening_hours: string | null
  phone: string | null
  website: string | null
}

export async function listRecyclingCenters(): Promise<RecyclingCenter[]> {
  return api.get<RecyclingCenter[]>('/recycling-centers/')
}

export async function getRecyclingCenter(id: number): Promise<RecyclingCenter> {
  return api.get<RecyclingCenter>(`/recycling-centers/${id}`)
}
