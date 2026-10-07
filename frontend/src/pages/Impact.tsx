// src/pages/Impact.tsx
// Environmental impact + Sustainability Report page
import { useEffect, useState } from 'react'
import { Leaf, TreePine, Zap, Droplets, RefreshCw, FileDown, AlertTriangle } from 'lucide-react'
import { api } from '../api/core'
import { useAuth } from '../contexts/AuthContext'

interface ImpactStats {
  total_waste_kg: number
  co2_saved_kg: number
  trees_equivalent: number
  plastic_bottles_equivalent: number
  energy_saved_kwh: number
}

interface DashboardStats {
  total_scans: number
  total_waste_diverted_kg: number
  eco_points: number
  hazardous_count: number
  scans_by_category: Record<string, number>
  total_pickups: number
  completed_pickups: number
}

const SDG_ITEMS = [
  {
    num: '11', emoji: '🏙️', color: 'bg-orange-50 border-orange-200',
    title: 'Sustainable Cities & Communities',
    desc: 'AI-powered routing reduces urban landfill burden. Smart pickup management optimises collection routes, cutting vehicle emissions.',
    metric: (s: DashboardStats) => `${s.total_pickups} smart pickups scheduled`,
  },
  {
    num: '12', emoji: '♻️', color: 'bg-amber-50 border-amber-200',
    title: 'Responsible Consumption & Production',
    desc: 'AI guidance promotes correct waste sorting at source. Feedback loop continuously improves classification accuracy.',
    metric: (s: DashboardStats) => `${s.total_scans} waste items classified`,
  },
  {
    num: '13', emoji: '🌍', color: 'bg-emerald-50 border-emerald-200',
    title: 'Climate Action',
    desc: 'Diverting waste from landfills prevents methane emissions. Accurate classification enables higher recycling rates.',
    metric: (s: DashboardStats) => `${s.total_waste_diverted_kg.toFixed(1)} kg diverted from landfill`,
  },
]

function ImpactCard({ icon, value, unit, label, color }: {
  icon: React.ReactNode; value: number; unit: string; label: string; color: string
}) {
  return (
    <div className={`${color} rounded-2xl p-5 text-center shadow-sm`}>
      <div className="flex justify-center mb-2">{icon}</div>
      <p className="text-3xl font-extrabold">{value.toLocaleString(undefined, { maximumFractionDigits: 1 })}</p>
      <p className="text-sm font-medium opacity-80">{unit}</p>
      <p className="text-xs opacity-60 mt-1">{label}</p>
    </div>
  )
}

function generateReport(user: { name: string; eco_points: number } | null, stats: DashboardStats | null, impact: ImpactStats | null): string {
  const date = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })
  const name = user?.name ?? 'User'
  return `EcoSort AI — Monthly Sustainability Report
Generated: ${date}
User: ${name}
EcoPoints: ${user?.eco_points ?? 0}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
WASTE MANAGEMENT SUMMARY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Total scans completed:     ${stats?.total_scans ?? 0}
Total waste categorised:   ${stats?.total_waste_diverted_kg?.toFixed(1) ?? 0} kg
Hazardous items detected:  ${stats?.hazardous_count ?? 0}
Total pickup requests:     ${stats?.total_pickups ?? 0}
Completed pickups:         ${stats?.completed_pickups ?? 0}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ENVIRONMENTAL IMPACT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CO₂ emissions saved:       ${impact?.co2_saved_kg?.toFixed(2) ?? 0} kg
Trees equivalent:          ${impact?.trees_equivalent?.toFixed(2) ?? 0} trees (1 yr CO₂ absorption)
Plastic bottles diverted:  ${impact?.plastic_bottles_equivalent?.toFixed(0) ?? 0} bottles
Energy saved:              ${impact?.energy_saved_kwh?.toFixed(1) ?? 0} kWh

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
WASTE CATEGORIES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${Object.entries(stats?.scans_by_category ?? {}).map(([k, v]) => `  ${k.padEnd(15)} ${v} scans`).join('\n')}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SDG ALIGNMENT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  SDG 11 — Sustainable Cities & Communities
  SDG 12 — Responsible Consumption & Production
  SDG 13 — Climate Action

Powered by EcoSort AI × IBM watsonx.ai
`
}

export default function Impact() {
  const { user } = useAuth()
  const [stats, setStats]   = useState<DashboardStats | null>(null)
  const [impact, setImpact] = useState<ImpactStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]   = useState<string | null>(null)

  useEffect(() => {
    Promise.all([
      api.get<DashboardStats>('/analytics/dashboard'),
      api.get<ImpactStats>('/analytics/impact'),
    ])
      .then(([s, i]) => { setStats(s); setImpact(i) })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  function downloadReport() {
    const text = generateReport(user, stats, impact)
    const blob = new Blob([text], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `ecosort-sustainability-report-${new Date().toISOString().slice(0, 10)}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  if (loading) return <div className="flex items-center gap-2 text-gray-400 mt-8"><RefreshCw size={18} className="animate-spin" /> Loading impact data…</div>
  if (error) return <div className="flex items-center gap-2 text-rose-500 mt-8"><AlertTriangle size={18} /> {error}</div>

  return (
    <div className="max-w-4xl space-y-8">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Environmental Impact</h1>
          <p className="text-gray-500 mt-1">Your personal contribution to a cleaner, greener planet.</p>
        </div>
        <button
          onClick={downloadReport}
          className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors"
        >
          <FileDown size={16} /> Download Report
        </button>
      </div>

      {/* Impact cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <ImpactCard icon={<Leaf size={28} className="text-emerald-600" />}  value={impact?.co2_saved_kg ?? 0}              unit="kg CO₂ saved"         label="Greenhouse gas prevented" color="bg-emerald-50 text-emerald-900" />
        <ImpactCard icon={<TreePine size={28} className="text-green-600" />} value={impact?.trees_equivalent ?? 0}          unit="trees equivalent"     label="1 yr CO₂ absorption"      color="bg-green-50 text-green-900" />
        <ImpactCard icon={<Droplets size={28} className="text-blue-600" />}  value={impact?.plastic_bottles_equivalent ?? 0} unit="bottles diverted"    label="PET plastic prevented"    color="bg-blue-50 text-blue-900" />
        <ImpactCard icon={<Zap size={28} className="text-yellow-600" />}     value={impact?.energy_saved_kwh ?? 0}          unit="kWh energy saved"     label="Recycling vs. extraction"  color="bg-yellow-50 text-yellow-900" />
      </div>

      {/* Summary stats */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
        <h2 className="font-semibold text-gray-800 mb-4">Your Contribution Summary</h2>
        <div className="grid sm:grid-cols-3 gap-4 text-center">
          <div>
            <p className="text-3xl font-extrabold text-emerald-600">{stats?.total_scans ?? 0}</p>
            <p className="text-sm text-gray-500 mt-0.5">Waste items scanned</p>
          </div>
          <div>
            <p className="text-3xl font-extrabold text-blue-600">{stats?.total_waste_diverted_kg?.toFixed(1) ?? 0} kg</p>
            <p className="text-sm text-gray-500 mt-0.5">Diverted from landfill</p>
          </div>
          <div>
            <p className="text-3xl font-extrabold text-amber-600">{stats?.eco_points ?? user?.eco_points ?? 0}</p>
            <p className="text-sm text-gray-500 mt-0.5">EcoPoints earned</p>
          </div>
        </div>
      </div>

      {/* SDG alignment */}
      <div>
        <h2 className="text-lg font-semibold text-gray-800 mb-4">UN Sustainable Development Goals</h2>
        <div className="grid sm:grid-cols-3 gap-4">
          {SDG_ITEMS.map(sdg => (
            <div key={sdg.num} className={`border rounded-2xl p-5 ${sdg.color}`}>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-2xl">{sdg.emoji}</span>
                <span className="font-bold text-lg">SDG {sdg.num}</span>
              </div>
              <p className="font-semibold text-sm mb-1">{sdg.title}</p>
              <p className="text-xs opacity-80 mb-3">{sdg.desc}</p>
              {stats && <p className="text-xs font-medium opacity-70">📊 {sdg.metric(stats)}</p>}
            </div>
          ))}
        </div>
      </div>

      {/* Methodology */}
      <div className="bg-gray-50 rounded-2xl border border-gray-200 p-5 text-sm text-gray-600">
        <h3 className="font-semibold text-gray-800 mb-2">Methodology Notes</h3>
        <ul className="space-y-1 text-xs list-disc list-inside">
          <li>CO₂ factors based on IPCC emission-factor guidelines per material category.</li>
          <li>Weight estimates are averages per item category (e.g. 0.3 kg for plastic bottles).</li>
          <li>Energy savings calculated using Ecoinvent recycling vs. virgin material factors.</li>
          <li>Tree equivalence: 1 tree absorbs approximately 21 kg CO₂ per year.</li>
        </ul>
      </div>
    </div>
  )
}
