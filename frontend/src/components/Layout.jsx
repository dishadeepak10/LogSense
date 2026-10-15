import { NavLink, Outlet, useLocation } from 'react-router-dom'

import { USE_MOCK } from '../api/client'

function navClass({ isActive }) {
  return `rounded-lg px-3 py-1.5 text-sm font-medium transition ${
    isActive ? 'bg-white/10 text-white ring-1 ring-white/15' : 'text-slate-400 hover:bg-white/5 hover:text-white'
  }`
}

// Header and page frame shared by every page. <Outlet /> is where the current page appears.
export default function Layout() {
  const location = useLocation()
  return (
    <div className="min-h-screen">
      {/* sticky + backdrop-blur: the header stays on top and the page blurs behind it */}
      <header className="sticky top-0 z-20 border-b border-white/10 bg-slate-950/70 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <NavLink to="/" className="group flex items-center gap-2 text-xl font-bold">
            <span className="rounded-lg bg-linear-to-br from-blue-500 to-violet-600 px-2 py-0.5 text-sm text-white shadow-lg shadow-blue-900/50 transition group-hover:rotate-6 group-hover:scale-110">
              LS
            </span>
            <span className="bg-linear-to-r from-blue-300 to-violet-300 bg-clip-text text-transparent">LogSense</span>
          </NavLink>
          <nav className="flex gap-1">
            <NavLink to="/" end className={navClass}>
              Upload
            </NavLink>
            <NavLink to="/history" className={navClass}>
              History
            </NavLink>
          </nav>
        </div>
      </header>
      {USE_MOCK && (
        <div className="bg-amber-950 px-4 py-1.5 text-center text-xs font-medium text-amber-200">
          Mock mode: showing data from src/mock/, not the real backend.
        </div>
      )}
      {/* key changes on every page change, so the page plays its "rise" animation again */}
      <main key={location.pathname} className="rise mx-auto max-w-6xl px-4 py-8">
        <Outlet />
      </main>
    </div>
  )
}
