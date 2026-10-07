// src/pages/Landing.tsx
// Professional landing page for EcoSort AI
import { useNavigate } from 'react-router-dom'
import { Leaf, ScanLine, MessageCircle, Truck, Trophy, MapPin, BarChart2, Globe, Zap, Shield } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'

const FEATURES = [
  {
    icon: <ScanLine size={24} className="text-emerald-600" />,
    title: 'AI Waste Scanner',
    desc: 'Upload or capture a photo of any waste item. Our computer vision model instantly classifies it and provides precise disposal guidance.',
  },
  {
    icon: <MessageCircle size={24} className="text-blue-600" />,
    title: 'EcoChat AI',
    desc: 'Powered by IBM watsonx.ai (Granite), EcoChat answers all your waste management, recycling, and composting questions — in English, Hindi, or Hinglish.',
  },
  {
    icon: <Truck size={24} className="text-amber-600" />,
    title: 'Smart Pickup',
    desc: 'Schedule a doorstep waste collection. Our collector network confirms and tracks each request in real time.',
  },
  {
    icon: <Trophy size={24} className="text-rose-500" />,
    title: 'EcoPoints & Badges',
    desc: 'Earn points for every scan, pickup, and challenge you complete. Climb the leaderboard and unlock eco badges.',
  },
  {
    icon: <MapPin size={24} className="text-purple-600" />,
    title: 'Recycling Locator',
    desc: 'Find the nearest recycling center for any waste type. GPS-powered nearest-first sorting with accepted category filters.',
  },
  {
    icon: <BarChart2 size={24} className="text-teal-600" />,
    title: 'Analytics & Reports',
    desc: 'Track your personal CO₂ savings, waste diverted, and EcoPoints earned. Download monthly sustainability reports.',
  },
]

const STATS = [
  { value: '10+', label: 'Waste Categories' },
  { value: 'IBM', label: 'watsonx.ai Powered' },
  { value: '3',   label: 'UN SDGs Supported' },
  { value: '∞',   label: 'Impact Potential' },
]

const SDGS = [
  { num: 11, color: '#f97316', title: 'Sustainable Cities', icon: '🏙️' },
  { num: 12, color: '#f59e0b', title: 'Responsible Consumption', icon: '♻️' },
  { num: 13, color: '#10b981', title: 'Climate Action', icon: '🌍' },
]

const TECH_STACK = [
  { name: 'React + TypeScript', icon: '⚛️' },
  { name: 'FastAPI + Python',   icon: '🐍' },
  { name: 'PostgreSQL',         icon: '🐘' },
  { name: 'IBM watsonx.ai',     icon: '🤖' },
  { name: 'Computer Vision',    icon: '👁️' },
  { name: 'TailwindCSS',        icon: '🎨' },
]

export default function Landing() {
  const navigate = useNavigate()
  const { user } = useAuth()

  return (
    <div className="min-h-screen bg-white font-sans">
      {/* Nav */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/90 backdrop-blur border-b border-gray-100 shadow-sm">
        <div className="max-w-6xl mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Leaf size={22} className="text-emerald-600" />
            <span className="font-bold text-lg text-gray-900">EcoSort AI</span>
            <span className="text-xs text-gray-400 ml-1 hidden sm:inline">IBM Internship Project</span>
          </div>
          <div className="flex items-center gap-3">
            {user ? (
              <button
                onClick={() => navigate('/')}
                className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-1.5 rounded-lg text-sm font-medium transition-colors"
              >
                Go to App
              </button>
            ) : (
              <>
                <button onClick={() => navigate('/login')}
                  className="text-sm text-gray-600 hover:text-gray-900 transition-colors">Login</button>
                <button onClick={() => navigate('/register')}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-1.5 rounded-lg text-sm font-medium transition-colors">
                  Get Started
                </button>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-28 pb-20 bg-gradient-to-br from-emerald-900 via-emerald-800 to-emerald-700 text-white text-center px-6">
        <div className="max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 bg-emerald-700/60 border border-emerald-500 rounded-full px-4 py-1.5 text-sm mb-6">
            <Zap size={13} className="text-yellow-300" />
            Powered by IBM watsonx.ai (Granite 13B)
          </div>
          <h1 className="text-4xl sm:text-5xl font-extrabold leading-tight mb-4">
            Smart Waste Management<br />for a Sustainable Future
          </h1>
          <p className="text-emerald-200 text-lg max-w-2xl mx-auto mb-8">
            EcoSort AI uses computer vision and IBM watsonx.ai to classify waste, guide disposal,
            reward recycling, and help build cleaner, smarter cities — aligned with UN SDGs 11, 12, and 13.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <button
              onClick={() => navigate(user ? '/' : '/register')}
              className="bg-white text-emerald-800 hover:bg-emerald-50 font-bold px-8 py-3 rounded-xl text-base transition-colors shadow-lg"
            >
              🌱 {user ? 'Open App' : 'Start Sorting Free'}
            </button>
            <button
              onClick={() => document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })}
              className="border border-emerald-400 text-emerald-100 hover:bg-emerald-800 px-8 py-3 rounded-xl text-base transition-colors"
            >
              Learn More ↓
            </button>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="bg-emerald-50 py-12 px-6 border-b border-emerald-100">
        <div className="max-w-4xl mx-auto grid grid-cols-2 sm:grid-cols-4 gap-6 text-center">
          {STATS.map(s => (
            <div key={s.label}>
              <p className="text-3xl font-extrabold text-emerald-700">{s.value}</p>
              <p className="text-sm text-gray-600 mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-20 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900">Everything You Need</h2>
            <p className="text-gray-500 mt-2">A complete smart waste management platform, not just an image classifier.</p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {FEATURES.map(f => (
              <div key={f.title} className="bg-white border border-gray-200 rounded-2xl p-6 hover:shadow-md transition-shadow">
                <div className="w-10 h-10 bg-gray-50 rounded-xl flex items-center justify-center mb-3">
                  {f.icon}
                </div>
                <h3 className="font-semibold text-gray-900 mb-1">{f.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* SDGs */}
      <section className="py-16 px-6 bg-gray-50">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Aligned with UN Sustainable Development Goals</h2>
          <p className="text-gray-500 mb-8">EcoSort AI directly contributes to three of the 17 SDGs adopted by all UN member states.</p>
          <div className="grid sm:grid-cols-3 gap-5">
            {SDGS.map(s => (
              <div key={s.num} className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm text-center">
                <span className="text-4xl">{s.icon}</span>
                <p className="text-2xl font-extrabold mt-2" style={{ color: s.color }}>SDG {s.num}</p>
                <p className="text-sm font-medium text-gray-700 mt-1">{s.title}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Tech stack */}
      <section className="py-16 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Built with Production-Grade Tech</h2>
          <p className="text-gray-500 mb-8">Modern stack designed for scalability, security, and real-world deployment.</p>
          <div className="flex flex-wrap justify-center gap-3">
            {TECH_STACK.map(t => (
              <span key={t.name} className="flex items-center gap-2 bg-gray-100 rounded-xl px-4 py-2 text-sm font-medium text-gray-700">
                <span>{t.icon}</span> {t.name}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* Security */}
      <section className="py-12 px-6 bg-emerald-50 border-y border-emerald-100">
        <div className="max-w-4xl mx-auto flex flex-wrap justify-center gap-8 text-sm text-gray-600">
          {[
            { icon: <Shield size={16} className="text-emerald-600" />, text: 'JWT Authentication + Refresh Tokens' },
            { icon: <Shield size={16} className="text-emerald-600" />, text: 'bcrypt Password Hashing' },
            { icon: <Shield size={16} className="text-emerald-600" />, text: 'Rate Limiting' },
            { icon: <Shield size={16} className="text-emerald-600" />, text: 'Role-Based Access Control' },
            { icon: <Globe size={16} className="text-emerald-600" />, text: 'Vercel + Render Deployment' },
            { icon: <Globe size={16} className="text-emerald-600" />, text: 'PostgreSQL Production DB' },
          ].map(s => (
            <div key={s.text} className="flex items-center gap-2">{s.icon} {s.text}</div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-6 bg-emerald-900 text-white text-center">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-3xl font-bold mb-3">Ready to Sort Smarter?</h2>
          <p className="text-emerald-200 mb-8">Join EcoSort AI — scan your first waste item and start earning EcoPoints today.</p>
          <button
            onClick={() => navigate(user ? '/' : '/register')}
            className="bg-white text-emerald-800 hover:bg-emerald-50 font-bold px-10 py-3 rounded-xl text-base transition-colors shadow-lg"
          >
            {user ? 'Go to Dashboard →' : 'Create Free Account →'}
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-400 text-sm py-8 px-6 text-center">
        <p className="mb-1">
          <Leaf size={14} className="inline text-emerald-500 mr-1" />
          <strong className="text-white">EcoSort AI</strong> — IBM Internship Project
        </p>
        <p>Powered by IBM watsonx.ai · Built with React, FastAPI, PostgreSQL</p>
        <p className="mt-2 text-xs text-gray-500">SDG 11 · SDG 12 · SDG 13 · © 2024 EcoSort AI</p>
      </footer>
    </div>
  )
}
