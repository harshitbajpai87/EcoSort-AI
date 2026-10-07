// src/pages/Dashboard.tsx
import { useEffect, useState } from 'react'
import { listScans, ScanSummary } from '../api/client'
import { Recycle, Weight, Star, AlertTriangle, CheckCircle } from 'lucide-react'

// ── SDG badges ──────────────────────────────────────────────────────────────
const SDG_BADGES = [
  {
    num: '11',
    color: 'bg-orange-100 text-orange-700 border-orange-300',
    title: 'Sustainable Cities',
    desc: 'Smart waste routing reduces urban landfill burden.',
  },
  {
    num: '12',
    color: 'bg-amber-100 text-amber-700 border-amber-300',
    title: 'Responsible Consumption',
    desc: 'AI guidance promotes correct sorting at source.',
  },
  {
    num: '13',
    color: 'bg-emerald-100 text-emerald-700 border-emerald-300',
    title: 'Climate Action',
    desc: 'Diverting waste from landfill cuts methane emissions.',
  },
]

// ── Helpers ──────────────────────────────────────────────────────────────────
function categoryColor(cat: string): string {
  const map: Record<string, string> = {
    plastic:   'bg-blue-100 text-blue-700',
    paper:     'bg-sky-100 text-sky-700',
    cardboard: 'bg-yellow-100 text-yellow-700',
    glass:     'bg-green-100 text-green-700',
    metal:     'bg-gray-200 text-gray-700',
    organic:   'bg-lime-100 text-lime-700',
    textile:   'bg-purple-100 text-purple-700',
    'e-waste': 'bg-red-100 text-red-700',
    battery:   'bg-orange-100 text-orange-700',
    hazardous: 'bg-rose-100 text-rose-700',
  }
  return map[cat] ?? 'bg-gray-100 text-gray-700'
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
  })
}

// Weight approximations per category (kg per scan)
const WEIGHT_MAP: Record<string, number> = {
  plastic: 0.3, paper: 0.5, cardboard: 1.2, glass: 0.8,
  metal: 0.4, organic: 0.6, textile: 0.7, 'e-waste': 1.5,
  battery: 0.2, hazardous: 0.5,
}

export default function Dashboard() {
  const [scans, setScans] = useState<ScanSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    listScans(50)
      .then(setScans)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  const totalScans   = scans.length
  const divertedKg   = scans.reduce((s, r) => s + (WEIGHT_MAP[r.predicted_category] ?? 0.4), 0)
  const ecoPoints    = totalScans * 10
  const hazardousCount = scans.filter(s => s.is_hazardous).length

  return (
    <div className="space-y-8 max-w-5xl">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-500 mt-1">Welcome to EcoSort AI — your smart waste management platform.</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={<Recycle size={22} className="text-emerald-600" />}
          label="Total Scans" value={String(totalScans)} bg="bg-emerald-50" />
        <StatCard icon={<Weight size={22} className="text-blue-600" />}
          label="Waste Diverted" value={`${divertedKg.toFixed(1)} kg`} bg="bg-blue-50" />
        <StatCard icon={<Star size={22} className="text-amber-500" />}
          label="Eco-Points" value={String(ecoPoints)} bg="bg-amber-50" />
        <StatCard icon={<AlertTriangle size={22} className="text-rose-500" />}
          label="Hazardous Items" value={String(hazardousCount)} bg="bg-rose-50" />
      </div>

      {/* Recent scans table */}
      <section>
        <h2 className="text-lg font-semibold text-gray-800 mb-3">Recent Scans</h2>
        {loading && <p className="text-gray-400 text-sm">Loading…</p>}
        {error   && (
          <p className="text-rose-500 text-sm">
            ⚠️ Could not connect to backend: {error}. Make sure the server is running.
          </p>
        )}
        {!loading && !error && scans.length === 0 && (
          <p className="text-gray-400 text-sm">No scans yet — head to the AI Scanner to get started!</p>
        )}
        {!loading && scans.length > 0 && (
          <div className="overflow-x-auto rounded-xl border border-gray-200 shadow-sm">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 text-gray-500 uppercase text-xs">
                <tr>
                  {['#', 'Category', 'Confidence', 'Bin', 'Hazardous', 'Date'].map(h => (
                    <th key={h} className="px-4 py-3 text-left font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-100">
                {scans.slice(0, 20).map(s => (
                  <tr key={s.scan_id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-gray-400">{s.scan_id}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${categoryColor(s.predicted_category)}`}>
                        {s.predicted_category}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{s.confidence_pct}</td>
                    <td className="px-4 py-3 text-gray-600">{s.recommended_bin}</td>
                    <td className="px-4 py-3">
                      {s.is_hazardous
                        ? <AlertTriangle size={15} className="text-rose-500" />
                        : <CheckCircle  size={15} className="text-emerald-500" />}
                    </td>
                    <td className="px-4 py-3 text-gray-400">{fmtDate(s.scanned_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* SDG badges */}
      <section>
        <h2 className="text-lg font-semibold text-gray-800 mb-3">UN SDG Alignment</h2>
        <div className="grid sm:grid-cols-3 gap-4">
          {SDG_BADGES.map(b => (
            <div key={b.num} className={`border rounded-xl p-4 ${b.color}`}>
              <p className="text-2xl font-extrabold mb-1">SDG {b.num}</p>
              <p className="font-semibold text-sm">{b.title}</p>
              <p className="text-xs mt-1 opacity-80">{b.desc}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}

function StatCard({ icon, label, value, bg }: {
  icon: React.ReactNode; label: string; value: string; bg: string
}) {
  return (
    <div className={`${bg} rounded-xl p-4 flex items-center gap-3 shadow-sm`}>
      <div className="p-2 bg-white rounded-lg shadow-sm">{icon}</div>
      <div>
        <p className="text-xs text-gray-500 font-medium">{label}</p>
        <p className="text-xl font-bold text-gray-800">{value}</p>
      </div>
    </div>
  )
}
