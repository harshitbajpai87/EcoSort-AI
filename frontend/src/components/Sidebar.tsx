// src/components/Sidebar.tsx
import { NavLink, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard,
  ScanLine,
  MessageCircle,
  Truck,
  Leaf,
  UserCircle,
  LogOut,
  Trophy,
  MapPin,
  BarChart2,
  Target,
  TreePine,
  ShieldCheck,
  Globe,
} from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import NotificationBell from './NotificationBell'
import LangSwitcher from './LangSwitcher'

// Base nav for all authenticated users
const BASE_NAV = [
  { to: '/',          icon: LayoutDashboard, label: 'Dashboard'       },
  { to: '/scanner',   icon: ScanLine,        label: 'AI Scanner'      },
  { to: '/chat',      icon: MessageCircle,   label: 'EcoChat'         },
  { to: '/pickup',    icon: Truck,           label: 'Pickup Requests' },
  { to: '/leaderboard', icon: Trophy,        label: 'Leaderboard'     },
  { to: '/challenges',  icon: Target,        label: 'Challenges'      },
  { to: '/centers',    icon: MapPin,         label: 'Recycling Map'   },
  { to: '/analytics',  icon: BarChart2,      label: 'Analytics'       },
  { to: '/impact',     icon: TreePine,       label: 'Impact & Report' },
  { to: '/profile',    icon: UserCircle,     label: 'Profile'         },
]

export default function Sidebar() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  async function handleLogout() {
    await logout()
    navigate('/login', { replace: true })
  }

  // Build nav — add role-specific items
  const nav = [...BASE_NAV]
  if (user?.role === 'COLLECTOR' || user?.role === 'ADMIN') {
    nav.splice(4, 0, { to: '/collector', icon: Truck, label: 'Collector Queue' })
  }
  if (user?.role === 'ADMIN') {
    nav.splice(0, 0, { to: '/admin', icon: ShieldCheck, label: 'Admin Panel' })
  }

  return (
    <aside className="fixed inset-y-0 left-0 w-60 bg-emerald-900 text-white flex flex-col z-20 shadow-xl">
      {/* Logo + notification bell */}
      <div className="flex items-center gap-2 px-5 py-4 border-b border-emerald-700">
        <Leaf className="text-emerald-300 shrink-0" size={26} />
        <div className="flex-1 min-w-0">
          <p className="font-bold text-base leading-tight truncate">EcoSort AI</p>
          <p className="text-emerald-400 text-[10px]">IBM Internship Project</p>
        </div>
        <NotificationBell />
      </div>

      {/* Nav links */}
      <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-0.5">
        {nav.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to + label}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                isActive
                  ? 'bg-emerald-700 text-white'
                  : 'text-emerald-200 hover:bg-emerald-800 hover:text-white'
              }`
            }
          >
            <Icon size={16} />
            {label}
          </NavLink>
        ))}

        {/* Landing page link */}
        <NavLink
          to="/landing"
          className={({ isActive }) =>
            `flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
              isActive ? 'bg-emerald-700 text-white' : 'text-emerald-200 hover:bg-emerald-800 hover:text-white'
            }`
          }
        >
          <Globe size={16} />
          About EcoSort
        </NavLink>
      </nav>

      {/* User info + logout */}
      {user && (
        <div className="px-4 py-3 border-t border-emerald-700 space-y-1.5">
          <div className="flex items-center gap-2 text-emerald-200 text-xs">
            <UserCircle size={15} className="shrink-0" />
            <span className="truncate font-medium">{user.name}</span>
          </div>
          <div className="text-emerald-400 text-xs">⭐ {user.eco_points} pts</div>
          {user.role !== 'USER' && (
            <div className={`text-[10px] px-1.5 py-0.5 rounded-full w-fit font-medium
              ${user.role === 'ADMIN' ? 'bg-red-900/60 text-red-300' : 'bg-blue-900/60 text-blue-300'}`}>
              {user.role}
            </div>
          )}
          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 text-emerald-300 hover:text-white text-xs transition-colors mt-0.5"
          >
            <LogOut size={12} />
            Sign out
          </button>
        </div>
      )}

      {/* Language switcher */}
      <div className="px-4 py-2 border-t border-emerald-700">
        <LangSwitcher />
      </div>

      {/* Footer */}
      <div className="px-4 py-2 border-t border-emerald-700 text-emerald-400 text-[10px]">
        Powered by IBM watsonx.ai
      </div>
    </aside>
  )
}
