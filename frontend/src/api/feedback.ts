/**
 * src/api/feedback.ts
 * ====================
 * Typed API module for user feedback.
 */

import { api } from './core'

export interface FeedbackRequest {
  scan_id?: number
  predicted_category: string
  corrected_category?: string
  is_correct: boolean
  comment?: string
  rating?: number
}

export interface FeedbackResponse {
  id: number
  message: string
  created_at: string
}

export async function submitFeedback(data: FeedbackRequest): Promise<FeedbackResponse> {
  return api.post<FeedbackResponse>('/feedback/', data)
}
