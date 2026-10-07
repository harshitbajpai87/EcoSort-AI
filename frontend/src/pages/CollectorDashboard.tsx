// src/pages/CollectorDashboard.tsx
import { useEffect, useState } from 'react'
import { Truck, CheckCircle, Clock, RefreshCw, AlertTriangle, PackageCheck } from 'lucide-react'
import { api } from '../api/core'
import type { PickupRequest } from '../api/pickups'
import { useAuth } from '../contexts/AuthContext'
import { useNavigate } from 'react-router-dom'

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    pending:   'bg-amber-100 text-amber-700',
    confirmed: 'bg-blue-100 text-blue-700',
    completed: 'bg-emerald-100 text-emerald-700',
    cancelled: 'bg-red-100 text-red-700',
  }
  return <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${map[status] ?? 'bg-gray-100'}`}>{status}</span>
}

const NEXT_STATUS: Record<string, PickupRequest['status']> = {
  pending:   'confirmed',
  confirmed: 'completed',
}

export default function CollectorDashboard() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [pickups, setPickups] = useState<PickupRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)
  const [updatingId, setUpdatingId] = useState<number | null>(null)

  // Redirect non-collectors/admins
  useEffect(() => {
    if (user && user.role === 'USER') navigate('/', { replace: true })
  }, [user, navigate])

  useEffect(() => {
    api.get<PickupRequest[]>('/pickups/collector/queue')
      .then(setPickups)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  async function handleAdvanceStatus(pickup: PickupRequest) {
    const next = NEXT_STATUS[pickup.status]
    if (!next) return
    setUpdatingId(pickup.id)
    try {
      const updated = await api.patch<PickupRequest>(`/pickups/${pickup.id}/status`, { status: next })
      setPickups(prev => prev.map(p => p.id === pickup.id ? updated : p).filter(p => p.status !== 'completed'))
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Update failed.')
    } finally {
      setUpdatingId(null)
    }
  }

  async function handleCancel(id: number) {
    setUpdatingId(id)
    try {
      await api.patch(`/pickups/${id}/status`, { status: 'cancelled' })
      setPickups(prev => prev.filter(p => p.id !== id))
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Cancel failed.')
    } finally {
      setUpdatingId(null)
    }
  }

  const pending   = pickups.filter(p => p.status === 'pending')
  const confirmed = pickups.filter(p => p.status === 'confirmed')

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex items-center gap-3">
        <Truck size={24} className="text-blue-600" />
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Collector Dashboard</h1>
          <p className="text-gray-500 text-sm">Manage pickup requests in your queue.</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid sm:grid-cols-2 gap-4">
        <div className="bg-amber-50 rounded-xl p-4 flex items-center gap-3">
          <div className="p-2 bg-white rounded-lg"><Clock size={20} className="text-amber-600" /></div>
          <div>
            <p className="text-xs text-gray-500">Pending</p>
            <p className="text-xl font-bold text-amber-700">{pending.length}</p>
          </div>
        </div>
        <div className="bg-blue-50 rounded-xl p-4 flex items-center gap-3">
          <div className="p-2 bg-white rounded-lg"><Truck size={20} className="text-blue-600" /></div>
          <div>
            <p className="text-xs text-gray-500">Confirmed (in transit)</p>
            <p className="text-xl font-bold text-blue-700">{confirmed.length}</p>
          </div>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 text-rose-600 bg-rose-50 border border-rose-200 rounded-xl px-4 py-3 text-sm">
          <AlertTriangle size={16} /> {error}
        </div>
      )}

      {loading && <div className="flex items-center gap-2 text-gray-400"><RefreshCw size={16} className="animate-spin" /> Loading queue…</div>}

      {!loading && pickups.length === 0 && (
        <div className="text-center py-12 text-gray-400">
          <PackageCheck size={40} className="mx-auto mb-3 text-gray-300" />
          <p>No active pickups in the queue!</p>
        </div>
      )}

      {pickups.map(p => (
        <div key={p.id} className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="font-semibold text-gray-900 capitalize">{p.waste_category}</span>
                <StatusBadge status={p.status} />
              </div>
              <p className="text-sm text-gray-500">📍 {p.address}</p>
              <p className="text-sm text-gray-500 mt-0.5">⚖️ {p.quantity_kg} kg</p>
              <p className="text-xs text-gray-400 mt-1">Request #{p.id} — User #{p.user_id}</p>
              <p className="text-xs text-gray-400">{new Date(p.created_at).toLocaleString()}</p>
            </div>

            <div className="flex flex-col gap-2 shrink-0">
              {NEXT_STATUS[p.status] && (
                <button
                  onClick={() => handleAdvanceStatus(p)}
                  disabled={updatingId === p.id}
                  className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-300 text-white text-sm px-4 py-2 rounded-lg transition-colors"
                >
                  {updatingId === p.id ? <RefreshCw size={14} className="animate-spin" /> : <CheckCircle size={14} />}
                  {p.status === 'pending' ? 'Confirm' : 'Mark Complete'}
                </button>
              )}
              {p.status === 'pending' && (
                <button
                  onClick={() => handleCancel(p.id)}
                  disabled={updatingId === p.id}
                  className="text-sm text-rose-600 hover:text-rose-800 border border-rose-300 px-4 py-2 rounded-lg transition-colors"
                >
                  Cancel
                </button>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
