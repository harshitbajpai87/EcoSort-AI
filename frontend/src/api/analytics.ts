/**
 * src/api/analytics.ts
 * =====================
 * Typed API module for dashboard analytics.
 */

import { api } from './core'

export interface DashboardStats {
  total_scans: number
  total_waste_diverted_kg: number
  eco_points: number
  hazardous_count: number
  scans_by_category: Record<string, number>
  total_pickups: number
  completed_pickups: number
}

export async function getDashboardStats(): Promise<DashboardStats> {
  return api.get<DashboardStats>('/analytics/dashboard')
}
