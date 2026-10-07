// src/pages/Pickup.tsx
import { useState, useEffect } from 'react'
import { Truck, CheckCircle, Clock, XCircle, PackageCheck, RefreshCw, AlertTriangle } from 'lucide-react'
import { createPickup, listMyPickups, cancelPickup, type PickupRequest } from '../api/pickups'

const CATEGORIES = [
  'plastic', 'paper', 'cardboard', 'glass', 'metal',
  'organic', 'textile', 'e-waste', 'battery', 'hazardous',
]

function StatusBadge({ status }: { status: PickupRequest['status'] }) {
  const map = {
    pending:   { color: 'bg-amber-100 text-amber-700',     icon: <Clock      size={13} />, label: 'Pending'   },
    confirmed: { color: 'bg-blue-100 text-blue-700',       icon: <Truck      size={13} />, label: 'Confirmed' },
    completed: { color: 'bg-emerald-100 text-emerald-700', icon: <CheckCircle size={13}/>, label: 'Completed' },
    cancelled: { color: 'bg-red-100 text-red-700',         icon: <XCircle    size={13} />, label: 'Cancelled' },
  }
  const s = map[status] ?? map.pending
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${s.color}`}>
      {s.icon} {s.label}
    </span>
  )
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

export default function Pickup() {
  const [records, setRecords] = useState<PickupRequest[]>([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted]   = useState(false)
  const [form, setForm] = useState({
    waste_category: CATEGORIES[0],
    quantity_kg: '',
    address: '',
  })

  // Load existing pickups on mount
  useEffect(() => {
    listMyPickups()
      .then(setRecords)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const qty = parseFloat(form.quantity_kg)
    if (!form.address.trim() || isNaN(qty) || qty <= 0) return
    setSubmitting(true)
    setError(null)
    try {
      const newPickup = await createPickup({
        waste_category: form.waste_category,
        quantity_kg: qty,
        address: form.address.trim(),
      })
      setRecords(prev => [newPickup, ...prev])
      setForm({ waste_category: CATEGORIES[0], quantity_kg: '', address: '' })
      setSubmitted(true)
      setTimeout(() => setSubmitted(false), 4000)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to submit pickup request.')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleCancel(id: number) {
    try {
      const updated = await cancelPickup(id)
      setRecords(prev => prev.map(r => r.id === id ? updated : r))
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to cancel pickup.')
    }
  }

  return (
    <div className="max-w-3xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Pickup Requests</h1>
        <p className="text-gray-500 mt-1">Schedule a waste collection from your address. Earn +5 EcoPoints per request.</p>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-4">
        <h2 className="font-semibold text-gray-800 flex items-center gap-2">
          <Truck size={18} className="text-emerald-600" /> Request a Pickup
        </h2>

        <div className="grid sm:grid-cols-2 gap-4">
          {/* Category */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Waste Category</label>
            <select
              value={form.waste_category}
              onChange={e => setForm(f => ({ ...f, waste_category: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
            >
              {CATEGORIES.map(c => (
                <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
              ))}
            </select>
          </div>

          {/* Quantity */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Estimated Weight (kg)</label>
            <input
              type="number" min="0.1" step="0.1" placeholder="e.g. 2.5"
              value={form.quantity_kg}
              onChange={e => setForm(f => ({ ...f, quantity_kg: e.target.value }))}
              required
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
            />
          </div>
        </div>

        {/* Address */}
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Collection Address</label>
          <textarea
            rows={2} placeholder="Enter your full collection address…"
            value={form.address}
            onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
            required
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 resize-none"
          />
        </div>

        <button
          type="submit" disabled={submitting}
          className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-300 text-white font-semibold py-2.5 rounded-xl transition-colors flex items-center justify-center gap-2"
        >
          {submitting ? <><RefreshCw size={16} className="animate-spin" /> Submitting…</> : 'Submit Pickup Request'}
        </button>

        {submitted && (
          <div className="flex items-center gap-2 text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 text-sm">
            <PackageCheck size={16} /> Request submitted! You earned +5 EcoPoints. Our team will confirm shortly.
          </div>
        )}

        {error && (
          <div className="flex items-center gap-2 text-rose-700 bg-rose-50 border border-rose-200 rounded-xl px-4 py-3 text-sm">
            <AlertTriangle size={16} /> {error}
          </div>
        )}
      </form>

      {/* Past requests table */}
      <section>
        <h2 className="text-lg font-semibold text-gray-800 mb-3">Your Requests</h2>
        {loading && <p className="text-gray-400 text-sm">Loading…</p>}
        {!loading && records.length === 0 && (
          <p className="text-gray-400 text-sm">No pickup requests yet. Submit one above!</p>
        )}
        {records.length > 0 && (
          <div className="overflow-x-auto rounded-xl border border-gray-200 shadow-sm">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 text-gray-500 uppercase text-xs">
                <tr>
                  {['#', 'Category', 'Weight', 'Address', 'Status', 'Date', 'Action'].map(h => (
                    <th key={h} className="px-4 py-3 text-left font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-100">
                {records.map(r => (
                  <tr key={r.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-gray-400">{r.id}</td>
                    <td className="px-4 py-3 capitalize font-medium text-gray-700">{r.waste_category}</td>
                    <td className="px-4 py-3 text-gray-600">{r.quantity_kg} kg</td>
                    <td className="px-4 py-3 text-gray-500 max-w-[180px] truncate">{r.address}</td>
                    <td className="px-4 py-3"><StatusBadge status={r.status} /></td>
                    <td className="px-4 py-3 text-gray-400">{fmtDate(r.created_at)}</td>
                    <td className="px-4 py-3">
                      {(r.status === 'pending' || r.status === 'confirmed') && (
                        <button
                          onClick={() => handleCancel(r.id)}
                          className="text-xs text-rose-600 hover:text-rose-800 transition-colors"
                        >
                          Cancel
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
