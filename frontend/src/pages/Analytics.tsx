// src/pages/Analytics.tsx
import { useEffect, useState } from 'react'
import { BarChart2, Leaf, Recycle, Zap, RefreshCw, TrendingUp, TreePine, AlertTriangle } from 'lucide-react'
import { getDashboardStats, type DashboardStats } from '../api/analytics'
import { api } from '../api/core'

interface ImpactStats {
  total_waste_kg: number
  co2_saved_kg: number
  trees_equivalent: number
  plastic_bottles_equivalent: number
  energy_saved_kwh: number
}

interface MLMetrics {
  total_feedbacks: number
  correct_predictions: number
  incorrect_predictions: number
  accuracy_pct: number
  top_error_categories: { category: string; count: number }[]
  pending_review: number
}

const CATEGORY_COLORS: Record<string, string> = {
  plastic:   '#3b82f6',
  paper:     '#0ea5e9',
  cardboard: '#f59e0b',
  glass:     '#10b981',
  metal:     '#6b7280',
  organic:   '#84cc16',
  textile:   '#8b5cf6',
  'e-waste': '#ef4444',
  battery:   '#f97316',
  hazardous: '#f43f5e',
}

function StatCard({ icon, label, value, sub, color }: {
  icon: React.ReactNode; label: string; value: string; sub?: string; color: string
}) {
  return (
    <div className={`${color} rounded-2xl p-5 flex items-start gap-3 shadow-sm`}>
      <div className="p-2 bg-white/80 rounded-xl">{icon}</div>
      <div>
        <p className="text-xs font-medium opacity-70">{label}</p>
        <p className="text-2xl font-extrabold">{value}</p>
        {sub && <p className="text-xs opacity-60 mt-0.5">{sub}</p>}
      </div>
    </div>
  )
}

function MiniBar({ label, count, max, color }: { label: string; count: number; max: number; color: string }) {
  const pct = max > 0 ? (count / max) * 100 : 0
  return (
    <div className="flex items-center gap-3 text-sm">
      <span className="w-20 capitalize text-gray-600 text-xs truncate">{label}</span>
      <div className="flex-1 bg-gray-100 rounded-full h-3">
        <div className="h-3 rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
      <span className="w-8 text-right text-xs font-semibold text-gray-700">{count}</span>
    </div>
  )
}

function CircleProgress({ pct, label }: { pct: number; label: string }) {
  const r = 36, c = 2 * Math.PI * r
  const dash = (pct / 100) * c
  return (
    <div className="flex flex-col items-center gap-1">
      <svg width="90" height="90" viewBox="0 0 90 90">
        <circle cx="45" cy="45" r={r} fill="none" stroke="#e5e7eb" strokeWidth="8" />
        <circle cx="45" cy="45" r={r} fill="none" stroke="#10b981" strokeWidth="8"
          strokeDasharray={`${dash} ${c}`} strokeLinecap="round"
          transform="rotate(-90 45 45)" />
        <text x="45" y="50" textAnchor="middle" fontSize="14" fontWeight="bold" fill="#1f2328">
          {pct.toFixed(0)}%
        </text>
      </svg>
      <p className="text-xs text-gray-500 text-center">{label}</p>
    </div>
  )
}

export default function Analytics() {
  const [stats, setStats]   = useState<DashboardStats | null>(null)
  const [impact, setImpact] = useState<ImpactStats | null>(null)
  const [ml, setMl]         = useState<MLMetrics | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]   = useState<string | null>(null)

  useEffect(() => {
    Promise.all([
      getDashboardStats(),
      api.get<ImpactStats>('/analytics/impact'),
      api.get<MLMetrics>('/analytics/ml'),
    ])
      .then(([s, i, m]) => { setStats(s); setImpact(i); setMl(m) })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return (
    <div className="flex items-center gap-2 text-gray-400 mt-8">
      <RefreshCw size={18} className="animate-spin" /> Loading analytics…
    </div>
  )
  if (error) return (
    <div className="flex items-center gap-2 text-rose-500 mt-8">
      <AlertTriangle size={18} /> {error}
    </div>
  )

  const byCategory = Object.entries(stats?.scans_by_category ?? {})
  const maxCat = Math.max(...byCategory.map(([,c]) => c), 1)

  return (
    <div className="max-w-5xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Analytics Dashboard</h1>
        <p className="text-gray-500 mt-1">Your waste management impact and platform metrics.</p>
      </div>

      {/* Top stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={<Recycle size={20} className="text-emerald-700"/>}  label="Total Scans"        value={String(stats?.total_scans ?? 0)}                        color="bg-emerald-50 text-emerald-900" />
        <StatCard icon={<Leaf    size={20} className="text-blue-700"   />}  label="Waste Diverted"     value={`${stats?.total_waste_diverted_kg ?? 0} kg`}             color="bg-blue-50 text-blue-900" />
        <StatCard icon={<TrendingUp size={20} className="text-amber-600"/>} label="EcoPoints"          value={String(stats?.eco_points ?? 0)}                          color="bg-amber-50 text-amber-900" />
        <StatCard icon={<AlertTriangle size={20} className="text-rose-600"/>} label="Hazardous Items" value={String(stats?.hazardous_count ?? 0)}                      color="bg-rose-50 text-rose-900" />
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Category breakdown */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
          <h2 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <BarChart2 size={16} className="text-emerald-600" /> Scans by Category
          </h2>
          {byCategory.length === 0 ? (
            <p className="text-gray-400 text-sm">No scan data yet.</p>
          ) : (
            <div className="space-y-2.5">
              {byCategory.sort(([,a],[,b]) => b-a).map(([cat, cnt]) => (
                <MiniBar key={cat} label={cat} count={cnt} max={maxCat} color={CATEGORY_COLORS[cat] ?? '#6b7280'} />
              ))}
            </div>
          )}
        </div>

        {/* Environmental impact */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
          <h2 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <Leaf size={16} className="text-emerald-600" /> Environmental Impact
          </h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="text-center p-3 bg-emerald-50 rounded-xl">
              <p className="text-2xl font-extrabold text-emerald-700">{impact?.co2_saved_kg ?? 0}</p>
              <p className="text-xs text-emerald-600 mt-0.5">kg CO₂ saved</p>
            </div>
            <div className="text-center p-3 bg-green-50 rounded-xl">
              <p className="text-2xl font-extrabold text-green-700">{impact?.trees_equivalent ?? 0}</p>
              <p className="text-xs text-green-600 mt-0.5">trees equivalent</p>
            </div>
            <div className="text-center p-3 bg-blue-50 rounded-xl">
              <p className="text-2xl font-extrabold text-blue-700">{impact?.plastic_bottles_equivalent ?? 0}</p>
              <p className="text-xs text-blue-600 mt-0.5">plastic bottles diverted</p>
            </div>
            <div className="text-center p-3 bg-yellow-50 rounded-xl">
              <p className="text-2xl font-extrabold text-yellow-700">{impact?.energy_saved_kwh ?? 0}</p>
              <p className="text-xs text-yellow-600 mt-0.5">kWh energy saved</p>
            </div>
          </div>
        </div>
      </div>

      {/* ML Metrics */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
        <h2 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
          <Zap size={16} className="text-purple-600" /> ML Model Performance
        </h2>
        <div className="grid sm:grid-cols-3 gap-6 items-center">
          <CircleProgress pct={ml?.accuracy_pct ?? 0} label={`${ml?.total_feedbacks ?? 0} feedbacks`} />
          <div className="sm:col-span-2 space-y-3">
            <div className="flex gap-6 text-sm">
              <div>
                <p className="text-xs text-gray-500">Correct</p>
                <p className="font-bold text-emerald-600">{ml?.correct_predictions ?? 0}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Incorrect</p>
                <p className="font-bold text-rose-500">{ml?.incorrect_predictions ?? 0}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Pending Review</p>
                <p className="font-bold text-amber-600">{ml?.pending_review ?? 0}</p>
              </div>
            </div>
            {(ml?.top_error_categories?.length ?? 0) > 0 && (
              <div>
                <p className="text-xs text-gray-500 mb-2">Top error categories:</p>
                <div className="flex flex-wrap gap-2">
                  {ml!.top_error_categories.map(e => (
                    <span key={e.category}
                      className="text-xs bg-rose-50 text-rose-700 px-2 py-0.5 rounded-full capitalize">
                      {e.category} ({e.count})
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Pickup stats */}
      <div className="grid sm:grid-cols-2 gap-4">
        <StatCard icon={<Recycle size={20} className="text-indigo-700"/>} label="Total Pickup Requests" value={String(stats?.total_pickups ?? 0)} color="bg-indigo-50 text-indigo-900" />
        <StatCard icon={<TreePine size={20} className="text-teal-700"/>} label="Completed Pickups" value={String(stats?.completed_pickups ?? 0)} sub="+50 EcoPoints each" color="bg-teal-50 text-teal-900" />
      </div>
    </div>
  )
}
