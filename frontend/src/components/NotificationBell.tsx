// src/components/NotificationBell.tsx
import { useEffect, useState, useRef } from 'react'
import { Bell, X, CheckCheck } from 'lucide-react'
import { listNotifications, markNotificationRead, markAllNotificationsRead, type Notification } from '../api/notifications'

const CATEGORY_ICONS: Record<string, string> = {
  pickup:    '🚛',
  points:    '⭐',
  challenge: '🏆',
  system:    'ℹ️',
}

function fmtTime(iso: string) {
  const d = new Date(iso)
  const now = Date.now()
  const diff = now - d.getTime()
  if (diff < 60000)  return 'just now'
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`
  return d.toLocaleDateString()
}

export default function NotificationBell() {
  const [open, setOpen]       = useState(false)
  const [notifs, setNotifs]   = useState<Notification[]>([])
  const [loading, setLoading] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const unread = notifs.filter(n => !n.read).length

  // Load on open
  useEffect(() => {
    if (!open) return
    setLoading(true)
    listNotifications()
      .then(setNotifs)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [open])

  // Close on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  async function handleMarkRead(id: number) {
    await markNotificationRead(id).catch(() => {})
    setNotifs(prev => prev.map(n => n.id === id ? { ...n, read: true } : n))
  }

  async function handleMarkAllRead() {
    await markAllNotificationsRead().catch(() => {})
    setNotifs(prev => prev.map(n => ({ ...n, read: true })))
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(o => !o)}
        className="relative p-2 text-emerald-300 hover:text-white transition-colors"
        title="Notifications"
      >
        <Bell size={18} />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-rose-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-10 w-80 bg-white border border-gray-200 rounded-2xl shadow-xl z-50 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <span className="font-semibold text-gray-800 text-sm">Notifications</span>
            <div className="flex items-center gap-2">
              {unread > 0 && (
                <button onClick={handleMarkAllRead}
                  className="text-xs text-emerald-600 hover:text-emerald-800 flex items-center gap-1">
                  <CheckCheck size={12} /> Mark all read
                </button>
              )}
              <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X size={14} />
              </button>
            </div>
          </div>

          <div className="max-h-80 overflow-y-auto">
            {loading && <p className="text-center text-gray-400 py-6 text-sm">Loading…</p>}
            {!loading && notifs.length === 0 && (
              <p className="text-center text-gray-400 py-8 text-sm">No notifications yet.</p>
            )}
            {notifs.map(n => (
              <div
                key={n.id}
                onClick={() => !n.read && handleMarkRead(n.id)}
                className={`flex gap-3 px-4 py-3 border-b border-gray-50 cursor-pointer hover:bg-gray-50 transition-colors
                  ${!n.read ? 'bg-emerald-50' : ''}`}
              >
                <span className="text-lg shrink-0 mt-0.5">{CATEGORY_ICONS[n.category] ?? 'ℹ️'}</span>
                <div className="flex-1 min-w-0">
                  <p className={`text-xs font-semibold ${!n.read ? 'text-gray-900' : 'text-gray-600'}`}>{n.title}</p>
                  <p className="text-xs text-gray-500 mt-0.5 leading-relaxed line-clamp-2">{n.body}</p>
                  <p className="text-[10px] text-gray-400 mt-1">{fmtTime(n.created_at)}</p>
                </div>
                {!n.read && <div className="w-2 h-2 bg-emerald-500 rounded-full mt-1.5 shrink-0" />}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
