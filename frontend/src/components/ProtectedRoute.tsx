/**
 * src/components/ProtectedRoute.tsx
 * ==================================
 * Wraps routes that require authentication.
 * Redirects unauthenticated users to /login, preserving the intended destination.
 */

import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { RefreshCw } from 'lucide-react'

interface Props {
  children: React.ReactNode
  /** Required role. If omitted, any authenticated user is allowed. */
  requiredRole?: 'USER' | 'COLLECTOR' | 'ADMIN'
}

export default function ProtectedRoute({ children, requiredRole }: Props) {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-3 text-gray-500">
          <RefreshCw size={28} className="animate-spin text-emerald-600" />
          <p className="text-sm font-medium">Loading…</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />
  }

  if (requiredRole && user.role !== requiredRole) {
    return <Navigate to="/" replace />
  }

  return <>{children}</>
}
