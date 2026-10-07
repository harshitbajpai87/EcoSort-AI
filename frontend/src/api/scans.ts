/**
 * src/api/scans.ts
 * =================
 * Typed API module for waste scanning and scan history.
 */

import { api, request } from './core'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ClassificationResult {
  scan_id: number
  predicted_category: string
  confidence: number
  confidence_pct: string
  recommended_bin: string
  is_hazardous: boolean
  instructions: string
  source: string
  scanned_at: string
}

export interface ScanSummary {
  scan_id: number
  predicted_category: string
  confidence_pct: string
  recommended_bin: string
  is_hazardous: boolean
  scanned_at: string
}

// ── API calls ─────────────────────────────────────────────────────────────────

export async function predictWaste(file: File): Promise<ClassificationResult> {
  const form = new FormData()
  form.append('file', file)
  return request<ClassificationResult>('POST', '/classifications/predict', form)
}

export async function listScans(limit = 20): Promise<ScanSummary[]> {
  return api.get<ScanSummary[]>(`/classifications/?limit=${limit}`)
}

export async function getScan(id: number): Promise<ClassificationResult> {
  return api.get<ClassificationResult>(`/classifications/${id}`)
}
