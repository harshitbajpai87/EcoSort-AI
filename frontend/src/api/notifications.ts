/**
 * src/api/notifications.ts
 * =========================
 * Typed API module for user notifications.
 */

import { api } from './core'

export interface Notification {
  id: number
  title: string
  body: string
  category: string
  read: boolean
  created_at: string
}

export async function listNotifications(): Promise<Notification[]> {
  return api.get<Notification[]>('/notifications/')
}

export async function markNotificationRead(id: number): Promise<void> {
  return api.patch<void>(`/notifications/${id}/read`)
}

export async function markAllNotificationsRead(): Promise<void> {
  return api.post<void>('/notifications/read-all')
}
