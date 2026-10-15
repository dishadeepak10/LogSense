import { NavLink, Outlet } from 'react-router-dom'

import { USE_MOCK } from '../api/client'

function navClass({ isActive }) {
  return `rounded-md px-3 py-1.5 text-sm font-medium ${
    isActive ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-200'
  }`
}

// Header and page frame shared by every page. <Outlet /> is where the current page appears.
export default function Layout() {
  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <NavLink to="/" className="flex items-center gap-2 text-lg font-bold text-slate-900">
            <span className="rounded-md bg-blue-600 px-1.5 py-0.5 text-sm text-white">LS</span>
            LogSense
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
        <div className="bg-amber-100 px-4 py-1.5 text-center text-xs font-medium text-amber-900">
          Mock mode: showing data from src/mock/, not the real backend.
        </div>
      )}
      <main className="mx-auto max-w-6xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  )
}
