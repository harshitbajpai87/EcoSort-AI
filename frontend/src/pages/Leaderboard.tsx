// src/pages/Leaderboard.tsx
import { useEffect, useState } from 'react'
import { Trophy, Star, Shield, RefreshCw, Medal } from 'lucide-react'
import { getLeaderboard, getMyEcoPoints, type LeaderboardEntry, type EcoPointsBalance } from '../api/ecopoints'
import { useAuth } from '../contexts/AuthContext'

const ALL_BADGES = [
  { id: 'seedling',      name: 'Seedling',      emoji: '🌱', threshold: 10,   description: 'Earned your first EcoPoints!' },
  { id: 'recycler',      name: 'Recycler',      emoji: '♻️', threshold: 50,   description: 'Recycled 5+ waste items.' },
  { id: 'eco_hero',      name: 'Eco Hero',      emoji: '🦸', threshold: 200,  description: 'Reached 200 EcoPoints.' },
  { id: 'green_warrior', name: 'Green Warrior', emoji: '🌿', threshold: 500,  description: 'Reached 500 EcoPoints.' },
  { id: 'planet_saver',  name: 'Planet Saver',  emoji: '🌍', threshold: 1000, description: 'Reached 1,000 EcoPoints!' },
  { id: 'eco_champion',  name: 'Eco Champion',  emoji: '🏆', threshold: 2500, description: 'Reached 2,500 EcoPoints!' },
  { id: 'sustainability_master', name: 'Sustainability Master', emoji: '🌟', threshold: 5000, description: 'Reached 5,000 EcoPoints — a true master!' },
]

function RankMedal({ rank }: { rank: number }) {
  if (rank === 1) return <span className="text-xl">🥇</span>
  if (rank === 2) return <span className="text-xl">🥈</span>
  if (rank === 3) return <span className="text-xl">🥉</span>
  return <span className="text-sm font-bold text-gray-500">#{rank}</span>
}

export default function Leaderboard() {
  const { user } = useAuth()
  const [entries, setEntries]   = useState<LeaderboardEntry[]>([])
  const [myBalance, setMyBalance] = useState<EcoPointsBalance | null>(null)
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState<string | null>(null)

  useEffect(() => {
    Promise.all([getLeaderboard(20), getMyEcoPoints()])
      .then(([lb, bal]) => { setEntries(lb); setMyBalance(bal) })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  const earnedBadges = myBalance?.badges ?? []
  const unearnedBadges = ALL_BADGES.filter(b => !earnedBadges.find((e: { id: string }) => e.id === b.id))
  const nextBadge = unearnedBadges[0]
  const myPoints = myBalance?.eco_points ?? 0
  const progress = nextBadge ? Math.min((myPoints / nextBadge.threshold) * 100, 100) : 100

  return (
    <div className="max-w-4xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Leaderboard & Badges</h1>
        <p className="text-gray-500 mt-1">Earn EcoPoints by scanning waste, completing pickups, and finishing challenges.</p>
      </div>

      {loading && <div className="flex items-center gap-2 text-gray-400"><RefreshCw size={16} className="animate-spin" /> Loading…</div>}
      {error   && <p className="text-rose-500 text-sm">⚠️ {error}</p>}

      {!loading && !error && (
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Left: Leaderboard */}
          <div className="lg:col-span-2 space-y-4">
            <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
              <Trophy size={18} className="text-amber-500" /> Global Leaderboard
            </h2>
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 text-gray-500 uppercase text-xs">
                  <tr>
                    {['Rank', 'Name', 'EcoPoints', 'Badges'].map(h => (
                      <th key={h} className="px-4 py-3 text-left font-medium">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {entries.map(e => (
                    <tr key={e.user_id}
                      className={`hover:bg-gray-50 ${e.user_id === user?.id ? 'bg-emerald-50' : ''}`}
                    >
                      <td className="px-4 py-3"><RankMedal rank={e.rank} /></td>
                      <td className="px-4 py-3 font-medium text-gray-800">
                        {e.name}
                        {e.user_id === user?.id && (
                          <span className="ml-2 text-xs bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full">You</span>
                        )}
                      </td>
                      <td className="px-4 py-3 font-semibold text-amber-600">
                        <span className="flex items-center gap-1"><Star size={13} /> {e.eco_points}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="flex gap-1 flex-wrap">
                          {(e.badges as Array<{emoji: string; name: string}>).slice(0, 4).map(b => (
                            <span key={b.name} title={b.name} className="text-base">{b.emoji}</span>
                          ))}
                          {e.badges.length > 4 && <span className="text-xs text-gray-400">+{e.badges.length - 4}</span>}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {entries.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-4 py-8 text-center text-gray-400">
                        No users yet — be the first to earn points!
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Right: My Badges */}
          <div className="space-y-4">
            {/* Points summary */}
            <div className="bg-emerald-700 text-white rounded-2xl p-5 shadow-sm">
              <p className="text-emerald-300 text-xs font-medium uppercase tracking-wide mb-1">Your EcoPoints</p>
              <p className="text-4xl font-extrabold">{myPoints}</p>
              {nextBadge && (
                <>
                  <p className="text-emerald-200 text-xs mt-2 mb-1">
                    Next: {nextBadge.emoji} {nextBadge.name} ({nextBadge.threshold - myPoints} pts away)
                  </p>
                  <div className="w-full bg-emerald-900 rounded-full h-2">
                    <div className="bg-emerald-300 h-2 rounded-full" style={{ width: `${progress}%` }} />
                  </div>
                </>
              )}
              {!nextBadge && (
                <p className="text-emerald-200 text-xs mt-2">🌟 All badges unlocked!</p>
              )}
            </div>

            {/* Earned badges */}
            <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
              <Medal size={18} className="text-emerald-600" /> Your Badges
            </h2>
            <div className="space-y-2">
              {ALL_BADGES.map(b => {
                const earned = earnedBadges.find((e: { id: string }) => e.id === b.id)
                return (
                  <div
                    key={b.id}
                    className={`flex items-center gap-3 p-3 rounded-xl border text-sm transition-all
                      ${earned ? 'bg-emerald-50 border-emerald-200' : 'bg-gray-50 border-gray-200 opacity-50'}`}
                  >
                    <span className="text-2xl">{b.emoji}</span>
                    <div>
                      <p className={`font-semibold ${earned ? 'text-emerald-800' : 'text-gray-500'}`}>{b.name}</p>
                      <p className="text-xs text-gray-500">{b.description}</p>
                      {!earned && (
                        <p className="text-xs text-gray-400 mt-0.5">{b.threshold} pts required</p>
                      )}
                    </div>
                    {earned && <Shield size={14} className="ml-auto text-emerald-500 shrink-0" />}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
