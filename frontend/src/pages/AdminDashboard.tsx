// src/pages/AdminDashboard.tsx
import { useEffect, useState } from 'react'
import { Users, Truck, BarChart2, RefreshCw, ShieldCheck, AlertTriangle } from 'lucide-react'
import { adminGetStats, adminListUsers, adminListPickups, adminUpdateUserRole, adminUpdatePickupStatus, type AdminStats } from '../api/admin'
import type { UserProfile } from '../api/auth'
import type { PickupRequest } from '../api/pickups'
import { useAuth } from '../contexts/AuthContext'
import { useNavigate } from 'react-router-dom'

type Tab = 'overview' | 'users' | 'pickups'

const ROLE_OPTIONS = ['USER', 'COLLECTOR', 'ADMIN'] as const
const PICKUP_STATUSES = ['pending', 'confirmed', 'completed', 'cancelled'] as const

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    pending:   'bg-amber-100 text-amber-700',
    confirmed: 'bg-blue-100 text-blue-700',
    completed: 'bg-emerald-100 text-emerald-700',
    cancelled: 'bg-red-100 text-red-700',
    USER:      'bg-gray-100 text-gray-700',
    COLLECTOR: 'bg-blue-100 text-blue-700',
    ADMIN:     'bg-red-100 text-red-700',
  }
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${map[status] ?? 'bg-gray-100 text-gray-600'}`}>
      {status}
    </span>
  )
}

export default function AdminDashboard() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [tab, setTab]           = useState<Tab>('overview')
  const [stats, setStats]       = useState<AdminStats | null>(null)
  const [users, setUsers]       = useState<UserProfile[]>([])
  const [pickups, setPickups]   = useState<PickupRequest[]>([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState<string | null>(null)

  // Redirect non-admins
  useEffect(() => {
    if (user && user.role !== 'ADMIN') navigate('/', { replace: true })
  }, [user, navigate])

  useEffect(() => {
    Promise.all([
      adminGetStats(),
      adminListUsers(),
      adminListPickups(),
    ])
      .then(([s, u, p]) => { setStats(s); setUsers(u); setPickups(p) })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  async function handleRoleChange(id: number, role: 'USER' | 'COLLECTOR' | 'ADMIN') {
    try {
      const updated = await adminUpdateUserRole(id, role)
      setUsers(prev => prev.map(u => u.id === id ? updated : u))
    } catch (e: unknown) { setError(e instanceof Error ? e.message : 'Failed.') }
  }

  async function handlePickupStatus(id: number, status: PickupRequest['status']) {
    try {
      const updated = await adminUpdatePickupStatus(id, status)
      setPickups(prev => prev.map(p => p.id === id ? updated : p))
    } catch (e: unknown) { setError(e instanceof Error ? e.message : 'Failed.') }
  }

  if (loading) return <div className="flex items-center gap-2 text-gray-400 mt-8"><RefreshCw size={18} className="animate-spin" /> Loading…</div>
  if (error)   return <div className="flex items-center gap-2 text-rose-500 mt-8"><AlertTriangle size={18} /> {error}</div>

  return (
    <div className="max-w-6xl space-y-6">
      <div className="flex items-center gap-3">
        <ShieldCheck size={24} className="text-red-600" />
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Admin Dashboard</h1>
          <p className="text-gray-500 text-sm">Manage users, pickups, and platform settings.</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit">
        {(['overview', 'users', 'pickups'] as Tab[]).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium capitalize transition-colors
              ${tab === t ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>
            {t}
          </button>
        ))}
      </div>

      {/* Overview */}
      {tab === 'overview' && stats && (
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Total Users',       value: stats.total_users,           icon: <Users size={20} className="text-blue-600" />,    bg: 'bg-blue-50' },
            { label: 'Total Scans',       value: stats.total_scans,           icon: <BarChart2 size={20} className="text-emerald-600" />, bg: 'bg-emerald-50' },
            { label: 'Total Pickups',     value: stats.total_pickups,         icon: <Truck size={20} className="text-amber-600" />,    bg: 'bg-amber-50' },
            { label: 'Pending Pickups',   value: stats.pending_pickups,       icon: <Truck size={20} className="text-rose-600" />,     bg: 'bg-rose-50' },
            { label: 'Completed Pickups', value: stats.completed_pickups,     icon: <Truck size={20} className="text-teal-600" />,     bg: 'bg-teal-50' },
            { label: 'Total Feedbacks',   value: stats.total_feedbacks,       icon: <BarChart2 size={20} className="text-purple-600" />, bg: 'bg-purple-50' },
            { label: 'Wrong Predictions', value: stats.incorrect_predictions, icon: <AlertTriangle size={20} className="text-orange-600"/>, bg: 'bg-orange-50' },
          ].map(s => (
            <div key={s.label} className={`${s.bg} rounded-xl p-4 flex items-center gap-3 shadow-sm`}>
              <div className="p-2 bg-white rounded-lg">{s.icon}</div>
              <div>
                <p className="text-xs text-gray-500 font-medium">{s.label}</p>
                <p className="text-xl font-bold text-gray-800">{s.value}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Users tab */}
      {tab === 'users' && (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 uppercase text-xs">
              <tr>
                {['ID', 'Name', 'Email', 'Role', 'EcoPoints', 'Joined', 'Change Role'].map(h => (
                  <th key={h} className="px-4 py-3 text-left font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {users.map(u => (
                <tr key={u.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-400">{u.id}</td>
                  <td className="px-4 py-3 font-medium text-gray-800">{u.name}</td>
                  <td className="px-4 py-3 text-gray-600">{u.email}</td>
                  <td className="px-4 py-3"><StatusBadge status={u.role} /></td>
                  <td className="px-4 py-3 text-amber-600 font-semibold">{u.eco_points}</td>
                  <td className="px-4 py-3 text-gray-400 text-xs">{new Date(u.created_at).toLocaleDateString()}</td>
                  <td className="px-4 py-3">
                    <select
                      value={u.role}
                      onChange={e => handleRoleChange(u.id, e.target.value as 'USER'|'COLLECTOR'|'ADMIN')}
                      className="border border-gray-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-400"
                      disabled={u.id === user?.id}
                    >
                      {ROLE_OPTIONS.map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pickups tab */}
      {tab === 'pickups' && (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 uppercase text-xs">
              <tr>
                {['ID', 'User', 'Category', 'Weight', 'Address', 'Status', 'Date', 'Update'].map(h => (
                  <th key={h} className="px-4 py-3 text-left font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {pickups.map(p => (
                <tr key={p.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-400">{p.id}</td>
                  <td className="px-4 py-3 text-gray-600">{p.user_id}</td>
                  <td className="px-4 py-3 capitalize font-medium text-gray-800">{p.waste_category}</td>
                  <td className="px-4 py-3 text-gray-600">{p.quantity_kg} kg</td>
                  <td className="px-4 py-3 text-gray-500 max-w-[160px] truncate">{p.address}</td>
                  <td className="px-4 py-3"><StatusBadge status={p.status} /></td>
                  <td className="px-4 py-3 text-gray-400 text-xs">{new Date(p.created_at).toLocaleDateString()}</td>
                  <td className="px-4 py-3">
                    <select
                      value={p.status}
                      onChange={e => handlePickupStatus(p.id, e.target.value as PickupRequest['status'])}
                      className="border border-gray-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-400"
                    >
                      {PICKUP_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
