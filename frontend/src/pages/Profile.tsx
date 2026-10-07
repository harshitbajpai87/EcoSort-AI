/**
 * src/pages/Profile.tsx
 * ======================
 * User profile page — displays current user info and allows logout.
 */

import { useAuth } from '../contexts/AuthContext'
import { useNavigate } from 'react-router-dom'
import { User, Mail, Phone, MapPin, Star, LogOut, Shield } from 'lucide-react'

function roleBadge(role: string) {
  const styles: Record<string, string> = {
    ADMIN:     'bg-red-100 text-red-700 border-red-200',
    COLLECTOR: 'bg-blue-100 text-blue-700 border-blue-200',
    USER:      'bg-emerald-100 text-emerald-700 border-emerald-200',
  }
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium border ${styles[role] ?? styles.USER}`}>
      <Shield size={11} />
      {role}
    </span>
  )
}

export default function Profile() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  if (!user) return null

  async function handleLogout() {
    await logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Profile</h1>
        <p className="text-gray-500 mt-1">Your EcoSort AI account details.</p>
      </div>

      {/* Profile card */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-5">
        {/* Avatar row */}
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-emerald-700 flex items-center justify-center text-white text-2xl font-bold">
            {user.name.charAt(0).toUpperCase()}
          </div>
          <div>
            <p className="font-semibold text-lg text-gray-900">{user.name}</p>
            {roleBadge(user.role)}
          </div>
        </div>

        <hr className="border-gray-100" />

        {/* Details */}
        <div className="space-y-3">
          <div className="flex items-center gap-3 text-sm text-gray-700">
            <Mail size={16} className="text-gray-400 shrink-0" />
            <span>{user.email}</span>
          </div>
          {user.phone && (
            <div className="flex items-center gap-3 text-sm text-gray-700">
              <Phone size={16} className="text-gray-400 shrink-0" />
              <span>{user.phone}</span>
            </div>
          )}
          {user.location && (
            <div className="flex items-center gap-3 text-sm text-gray-700">
              <MapPin size={16} className="text-gray-400 shrink-0" />
              <span>{user.location}</span>
            </div>
          )}
          <div className="flex items-center gap-3 text-sm text-gray-700">
            <Star size={16} className="text-amber-500 shrink-0" />
            <span><span className="font-semibold text-amber-600">{user.eco_points}</span> Eco-Points</span>
          </div>
          <div className="flex items-center gap-3 text-sm text-gray-700">
            <User size={16} className="text-gray-400 shrink-0" />
            <span>Member since {new Date(user.created_at).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}</span>
          </div>
        </div>

        <hr className="border-gray-100" />

        {/* Logout */}
        <button
          onClick={handleLogout}
          className="flex items-center gap-2 text-rose-600 hover:text-rose-700
                     font-medium text-sm transition-colors"
        >
          <LogOut size={16} />
          Sign out
        </button>
      </div>
    </div>
  )
}
