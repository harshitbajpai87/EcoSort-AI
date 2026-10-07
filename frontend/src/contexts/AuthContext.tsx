/**
 * src/contexts/AuthContext.tsx
 * =============================
 * Authentication context providing:
 *   - Current user state (UserProfile | null)
 *   - Loading state while session is being restored
 *   - login / register / logout actions
 *   - Automatic session restoration on page load via stored JWT
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'

import { getMe, login as apiLogin, logout as apiLogout, register as apiRegister } from '../api/auth'
import { tokenStore } from '../api/core'
import type { UserProfile, LoginRequest, RegisterRequest } from '../api/auth'

// ── Types ─────────────────────────────────────────────────────────────────────

interface AuthState {
  user: UserProfile | null
  /** True while the initial session check is running */
  loading: boolean
}

interface AuthContextValue extends AuthState {
  login: (data: LoginRequest) => Promise<void>
  register: (data: RegisterRequest) => Promise<void>
  logout: () => Promise<void>
  /** Refresh the user profile from the backend (e.g. after eco-points change) */
  refreshUser: () => Promise<void>
}

// ── Context ───────────────────────────────────────────────────────────────────

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

// ── Provider ──────────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ user: null, loading: true })

  // Restore session on mount: if a stored token exists, fetch the profile.
  useEffect(() => {
    const token = tokenStore.getAccess()
    if (!token) {
      setState({ user: null, loading: false })
      return
    }
    getMe()
      .then(user => setState({ user, loading: false }))
      .catch(() => {
        tokenStore.clear()
        setState({ user: null, loading: false })
      })
  }, [])

  const login = useCallback(async (data: LoginRequest) => {
    await apiLogin(data)        // stores tokens in tokenStore
    const user = await getMe()
    setState({ user, loading: false })
  }, [])

  const register = useCallback(async (data: RegisterRequest) => {
    await apiRegister(data)     // stores tokens in tokenStore
    const user = await getMe()
    setState({ user, loading: false })
  }, [])

  const logout = useCallback(async () => {
    await apiLogout()           // clears tokenStore
    setState({ user: null, loading: false })
  }, [])

  const refreshUser = useCallback(async () => {
    try {
      const user = await getMe()
      setState(s => ({ ...s, user }))
    } catch {
      // If refresh fails the session is probably gone — clear it
      tokenStore.clear()
      setState({ user: null, loading: false })
    }
  }, [])

  return (
    <AuthContext.Provider value={{ ...state, login, register, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  )
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}
