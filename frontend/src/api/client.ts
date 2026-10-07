/**
 * src/api/client.ts
 * ==================
 * Legacy compatibility shim.
 * All pages have been updated to import from the typed modules directly.
 * This file re-exports the symbols that existing components still use.
 */

export type { ClassificationResult, ScanSummary } from './scans'
export { predictWaste, listScans } from './scans'
export type { ChatResponse } from './chat'
export { sendChat } from './chat'
export { api } from './core'

/** @deprecated Use api.get('/health') instead */
export async function checkHealth(): Promise<{ status: string }> {
  const { api: _api } = await import('./core')
  return _api.get<{ status: string }>('/health')
}
