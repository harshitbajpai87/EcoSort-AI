/**
 * src/api/chat.ts
 * ================
 * Typed API module for EcoChat conversational assistant.
 */

import { api } from './core'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ChatMessage {
  message: string
}

export interface ChatResponse {
  reply: string
  source: string
}

// ── API calls ─────────────────────────────────────────────────────────────────

export async function sendChat(message: string): Promise<ChatResponse> {
  return api.post<ChatResponse>('/chat/', { message })
}
