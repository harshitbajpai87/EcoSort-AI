// src/App.tsx
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import { LangProvider } from './contexts/LangContext'
import ProtectedRoute from './components/ProtectedRoute'
import Sidebar from './components/Sidebar'

import Dashboard        from './pages/Dashboard'
import Scanner          from './pages/Scanner'
import EcoChat          from './pages/EcoChat'
import Pickup           from './pages/Pickup'
import Profile          from './pages/Profile'
import Login            from './pages/Login'
import Register         from './pages/Register'
import Leaderboard      from './pages/Leaderboard'
import RecyclingCenters from './pages/RecyclingCenters'
import Analytics        from './pages/Analytics'
import AdminDashboard   from './pages/AdminDashboard'
import CollectorDashboard from './pages/CollectorDashboard'
import Challenges       from './pages/Challenges'
import Impact           from './pages/Impact'
import Landing          from './pages/Landing'

/** Layout wrapper used for all authenticated pages (sidebar + main area). */
function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <main className="flex-1 ml-60 p-6 overflow-y-auto min-h-screen">
        {children}
      </main>
    </div>
  )
}

/** Helper to wrap a page in ProtectedRoute + AppLayout */
function Protected({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedRoute>
      <AppLayout>{children}</AppLayout>
    </ProtectedRoute>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <LangProvider>
      <AuthProvider>
        <Routes>
          {/* Public routes */}
          <Route path="/landing"  element={<Landing />} />
          <Route path="/login"    element={<Login />} />
          <Route path="/register" element={<Register />} />

          {/* Protected routes */}
          <Route path="/"            element={<Protected><Dashboard /></Protected>} />
          <Route path="/scanner"     element={<Protected><Scanner /></Protected>} />
          <Route path="/chat"        element={<Protected><EcoChat /></Protected>} />
          <Route path="/pickup"      element={<Protected><Pickup /></Protected>} />
          <Route path="/profile"     element={<Protected><Profile /></Protected>} />
          <Route path="/leaderboard" element={<Protected><Leaderboard /></Protected>} />
          <Route path="/centers"     element={<Protected><RecyclingCenters /></Protected>} />
          <Route path="/analytics"   element={<Protected><Analytics /></Protected>} />
          <Route path="/challenges"  element={<Protected><Challenges /></Protected>} />
          <Route path="/impact"      element={<Protected><Impact /></Protected>} />
          <Route path="/admin"       element={<Protected><AdminDashboard /></Protected>} />
          <Route path="/collector"   element={<Protected><CollectorDashboard /></Protected>} />

          {/* Catch-all: redirect to landing */}
          <Route path="*" element={<Landing />} />
        </Routes>
      </AuthProvider>
      </LangProvider>
    </BrowserRouter>
  )
}
