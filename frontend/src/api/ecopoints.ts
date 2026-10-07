/**
 * src/api/ecopoints.ts
 * =====================
 * Typed API module for EcoPoints rewards system.
 */

import { api } from './core'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface BadgeInfo {
  id: string
  name: string
  emoji: string
  threshold: number
  description: string
}

export interface EcoPointsBalance {
  user_id: number
  eco_points: number
  badges: BadgeInfo[]
}

export interface LeaderboardEntry {
  rank: number
  user_id: number
  name: string
  eco_points: number
  badges: BadgeInfo[]
}

// ── API calls ─────────────────────────────────────────────────────────────────

export async function getMyEcoPoints(): Promise<EcoPointsBalance> {
  return api.get<EcoPointsBalance>('/ecopoints/me')
}

export async function getLeaderboard(limit = 10): Promise<LeaderboardEntry[]> {
  return api.get<LeaderboardEntry[]>(`/ecopoints/leaderboard?limit=${limit}`)
}
