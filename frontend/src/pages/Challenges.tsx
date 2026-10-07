// src/pages/Challenges.tsx
import { useEffect, useState } from 'react'
import { Trophy, Target, Users, Clock, RefreshCw, AlertTriangle, CheckCircle, Plus } from 'lucide-react'
import { api } from '../api/core'
import { useAuth } from '../contexts/AuthContext'

interface Challenge {
  id: number
  title: string
  description: string
  challenge_type: 'scan' | 'pickup' | 'points'
  target: number
  reward_points: number
  badge: string | null
  start_date: string
  end_date: string
  is_active: boolean
  participant_count: number
}

interface ParticipantStatus {
  challenge_id: number
  progress: number
  completed: boolean
  completed_at: string | null
}

function TypeBadge({ type }: { type: string }) {
  const map: Record<string, string> = {
    scan:    'bg-blue-100 text-blue-700',
    pickup:  'bg-green-100 text-green-700',
    points:  'bg-amber-100 text-amber-700',
  }
  return <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${map[type] ?? 'bg-gray-100'}`}>{type}</span>
}

function daysLeft(endDate: string): number {
  return Math.max(0, Math.ceil((new Date(endDate).getTime() - Date.now()) / 86400000))
}

function ProgressBar({ current, target }: { current: number; target: number }) {
  const pct = Math.min((current / target) * 100, 100)
  return (
    <div>
      <div className="flex justify-between text-xs text-gray-500 mb-1">
        <span>{current} / {target}</span>
        <span>{pct.toFixed(0)}%</span>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-2">
        <div className="bg-emerald-500 h-2 rounded-full transition-all" style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

export default function Challenges() {
  const { user } = useAuth()
  const [challenges, setChallenges]     = useState<Challenge[]>([])
  const [myProgress, setMyProgress]     = useState<ParticipantStatus[]>([])
  const [loading, setLoading]           = useState(true)
  const [error, setError]               = useState<string | null>(null)
  const [joiningId, setJoiningId]       = useState<number | null>(null)
  const [joinMsg, setJoinMsg]           = useState<string | null>(null)

  useEffect(() => {
    Promise.all([
      api.get<Challenge[]>('/challenges/'),
      api.get<ParticipantStatus[]>('/challenges/my'),
    ])
      .then(([c, m]) => { setChallenges(c); setMyProgress(m) })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  async function handleJoin(id: number) {
    setJoiningId(id)
    setJoinMsg(null)
    try {
      const r = await api.post<{ message: string }>(`/challenges/${id}/join`)
      setJoinMsg(r.message)
      // Refresh progress
      const prog = await api.get<ParticipantStatus[]>('/challenges/my')
      setMyProgress(prog)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to join challenge.')
    } finally {
      setJoiningId(null)
    }
  }

  const participatingIds = new Set(myProgress.map(p => p.challenge_id))
  const completedIds = new Set(myProgress.filter(p => p.completed).map(p => p.challenge_id))

  if (loading) return <div className="flex items-center gap-2 text-gray-400 mt-8"><RefreshCw size={18} className="animate-spin" /> Loading challenges…</div>

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Community Challenges</h1>
          <p className="text-gray-500 mt-1">Join recycling challenges and earn EcoPoints + badges!</p>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 text-rose-600 bg-rose-50 border border-rose-200 rounded-xl px-4 py-3 text-sm">
          <AlertTriangle size={16} /> {error}
        </div>
      )}

      {joinMsg && (
        <div className="flex items-center gap-2 text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 text-sm">
          <CheckCircle size={16} /> {joinMsg}
        </div>
      )}

      {challenges.length === 0 && (
        <div className="text-center py-16 text-gray-400">
          <Trophy size={40} className="mx-auto mb-3 text-gray-300" />
          <p>No active challenges right now. Check back soon!</p>
          {user?.role === 'ADMIN' && (
            <p className="text-sm mt-2 text-emerald-600">As an admin, you can create challenges via the API.</p>
          )}
        </div>
      )}

      <div className="grid sm:grid-cols-2 gap-5">
        {challenges.map(c => {
          const joined = participatingIds.has(c.id)
          const completed = completedIds.has(c.id)
          const prog = myProgress.find(p => p.challenge_id === c.id)

          return (
            <div key={c.id} className={`bg-white rounded-2xl border shadow-sm p-5 space-y-3
              ${completed ? 'border-emerald-300 bg-emerald-50' : 'border-gray-200'}`}>
              {/* Header */}
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="font-semibold text-gray-900">{c.title}</h3>
                  <div className="flex items-center gap-2 mt-1">
                    <TypeBadge type={c.challenge_type} />
                    {c.badge && <span className="text-xs text-gray-500">🏅 {c.badge}</span>}
                  </div>
                </div>
                {completed && <CheckCircle size={20} className="text-emerald-500 shrink-0" />}
              </div>

              <p className="text-sm text-gray-600">{c.description}</p>

              {/* Stats row */}
              <div className="flex items-center gap-4 text-xs text-gray-500">
                <span className="flex items-center gap-1"><Target size={11} /> {c.target}</span>
                <span className="flex items-center gap-1"><Trophy size={11} className="text-amber-500" /> +{c.reward_points} pts</span>
                <span className="flex items-center gap-1"><Users size={11} /> {c.participant_count} joined</span>
                <span className="flex items-center gap-1"><Clock size={11} /> {daysLeft(c.end_date)} days left</span>
              </div>

              {/* Progress bar if joined */}
              {joined && prog && !completed && (
                <ProgressBar current={prog.progress} target={c.target} />
              )}
              {completed && <p className="text-xs text-emerald-700 font-medium">✅ Completed! +{c.reward_points} pts earned.</p>}

              {/* Action */}
              {!joined && !completed && (
                <button
                  onClick={() => handleJoin(c.id)}
                  disabled={joiningId === c.id}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-300 text-white text-sm font-medium py-2 rounded-xl transition-colors flex items-center justify-center gap-2"
                >
                  {joiningId === c.id ? <RefreshCw size={14} className="animate-spin" /> : <Plus size={14} />}
                  Join Challenge
                </button>
              )}
              {joined && !completed && (
                <div className="text-center text-xs text-emerald-700 font-medium bg-emerald-50 rounded-lg py-1.5">
                  ✅ You've joined this challenge — keep going!
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
