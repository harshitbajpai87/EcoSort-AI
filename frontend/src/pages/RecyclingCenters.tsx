// src/pages/RecyclingCenters.tsx
import { useEffect, useState } from 'react'
import { MapPin, Phone, Globe, Clock, Search, Filter, RefreshCw } from 'lucide-react'
import { listRecyclingCenters, type RecyclingCenter } from '../api/recyclingCenters'

const CATEGORIES = [
  'all', 'plastic', 'paper', 'cardboard', 'glass', 'metal',
  'organic', 'textile', 'e-waste', 'battery', 'hazardous',
]

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLon = (lon2 - lon1) * Math.PI / 180
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLon/2)**2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
}

// Demo centers for immediate display
const DEMO_CENTERS: RecyclingCenter[] = [
  {
    id: 1, name: 'Green Valley Recycling Hub', address: '12 Eco Street, Green Valley, GV1 1AB',
    accepted_categories: ['plastic','paper','cardboard','glass','metal'],
    latitude: 28.6139, longitude: 77.2090, opening_hours: 'Mon–Sat 8am–6pm', phone: '+91-11-2345-6789', website: 'https://greenvalleyhub.example.com',
  },
  {
    id: 2, name: 'E-Waste Collection Centre', address: '45 Tech Park Road, Electronics Zone, EZ2 2CD',
    accepted_categories: ['e-waste','battery'],
    latitude: 28.6200, longitude: 77.2200, opening_hours: 'Mon–Fri 9am–5pm', phone: '+91-11-9876-5432', website: null,
  },
  {
    id: 3, name: 'Organic Compost Station', address: '7 Garden Lane, Eco City, EC3 3EF',
    accepted_categories: ['organic','textile'],
    latitude: 28.6050, longitude: 77.1980, opening_hours: 'Daily 7am–8pm', phone: null, website: null,
  },
  {
    id: 4, name: 'Hazardous Waste Drop-off', address: '99 Safety Road, Industrial Area, IA4 4GH',
    accepted_categories: ['hazardous','battery','e-waste'],
    latitude: 28.6300, longitude: 77.2100, opening_hours: 'Mon, Wed, Fri 10am–4pm', phone: '+91-11-1122-3344', website: null,
  },
  {
    id: 5, name: 'City Scrap Metal Yard', address: '23 Industrial Drive, Metal Works, MW5 5IJ',
    accepted_categories: ['metal','e-waste','cardboard'],
    latitude: 28.5950, longitude: 77.2300, opening_hours: 'Mon–Sat 7am–7pm', phone: '+91-11-5566-7788', website: null,
  },
]

function CenterCard({ center, distance }: { center: RecyclingCenter; distance?: number }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <h3 className="font-semibold text-gray-900">{center.name}</h3>
          {distance !== undefined && (
            <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">
              📍 {distance.toFixed(1)} km away
            </span>
          )}
        </div>
        <MapPin size={18} className="text-emerald-500 shrink-0 mt-0.5" />
      </div>

      <p className="text-sm text-gray-500 mt-2 flex items-start gap-1.5">
        <MapPin size={12} className="text-gray-400 shrink-0 mt-0.5" /> {center.address}
      </p>

      {center.opening_hours && (
        <p className="text-xs text-gray-400 mt-1.5 flex items-center gap-1.5">
          <Clock size={12} /> {center.opening_hours}
        </p>
      )}
      {center.phone && (
        <p className="text-xs text-gray-400 mt-1 flex items-center gap-1.5">
          <Phone size={12} /> {center.phone}
        </p>
      )}
      {center.website && (
        <a href={center.website} target="_blank" rel="noopener noreferrer"
          className="text-xs text-emerald-600 hover:text-emerald-800 mt-1 flex items-center gap-1.5">
          <Globe size={12} /> Website
        </a>
      )}

      <div className="flex flex-wrap gap-1.5 mt-3">
        {center.accepted_categories.map(cat => (
          <span key={cat}
            className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full capitalize">
            {cat}
          </span>
        ))}
      </div>
    </div>
  )
}

export default function RecyclingCenters() {
  const [centers, setCenters]       = useState<RecyclingCenter[]>([])
  const [loading, setLoading]       = useState(true)
  const [search, setSearch]         = useState('')
  const [filterCat, setFilterCat]   = useState('all')
  const [userLocation, setUserLocation] = useState<{ lat: number; lon: number } | null>(null)
  const [locating, setLocating]     = useState(false)
  const [, setLocError]             = useState('')

  useEffect(() => {
    listRecyclingCenters()
      .then(data => setCenters(data.length ? data : DEMO_CENTERS))
      .catch((_err) => setCenters(DEMO_CENTERS))  // fall back to demo data
      .finally(() => setLoading(false))
  }, [])

  function locateMe() {
    setLocating(true)
    navigator.geolocation?.getCurrentPosition(
      pos => {
        setUserLocation({ lat: pos.coords.latitude, lon: pos.coords.longitude })
        setLocating(false)
      },
      () => { setLocating(false); setLocError('Location access denied. Enable GPS and try again.') },
      { timeout: 8000 }
    )
  }

  const filtered = centers.filter(c => {
    const matchSearch = c.name.toLowerCase().includes(search.toLowerCase()) ||
                        c.address.toLowerCase().includes(search.toLowerCase())
    const matchCat = filterCat === 'all' || c.accepted_categories.includes(filterCat)
    return matchSearch && matchCat
  })

  const sorted = userLocation
    ? [...filtered].sort((a, b) => {
        if (!a.latitude || !b.latitude) return 0
        const dA = haversineKm(userLocation.lat, userLocation.lon, a.latitude!, a.longitude!)
        const dB = haversineKm(userLocation.lat, userLocation.lon, b.latitude!, b.longitude!)
        return dA - dB
      })
    : filtered

  return (
    <div className="max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Recycling Center Locator</h1>
        <p className="text-gray-500 mt-1">Find nearby waste collection and recycling facilities.</p>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text" placeholder="Search by name or address…"
            value={search} onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter size={14} className="text-gray-500" />
          <select
            value={filterCat} onChange={e => setFilterCat(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
          >
            {CATEGORIES.map(c => <option key={c} value={c}>{c === 'all' ? 'All categories' : c}</option>)}
          </select>
        </div>
        <button
          onClick={locateMe} disabled={locating}
          className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-300 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          {locating ? <RefreshCw size={14} className="animate-spin" /> : <MapPin size={14} />}
          {locating ? 'Locating…' : userLocation ? 'Update Location' : 'Use My Location'}
        </button>
      </div>

      {userLocation && (
        <p className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
          📍 Showing results sorted by distance from your location.
        </p>
      )}

      {loading && <div className="flex items-center gap-2 text-gray-400"><RefreshCw size={16} className="animate-spin" /> Loading centers…</div>}

      <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {sorted.map(c => (
          <CenterCard
            key={c.id}
            center={c}
            distance={
              userLocation && c.latitude && c.longitude
                ? haversineKm(userLocation.lat, userLocation.lon, c.latitude, c.longitude)
                : undefined
            }
          />
        ))}
        {!loading && sorted.length === 0 && (
          <div className="col-span-full text-center text-gray-400 py-12">
            <MapPin size={32} className="mx-auto mb-3 text-gray-300" />
            <p>No centers match your filter. Try a different category.</p>
          </div>
        )}
      </div>
    </div>
  )
}
