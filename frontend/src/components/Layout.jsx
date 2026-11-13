import { NavLink, Outlet, useLocation } from 'react-router-dom'

import { USE_MOCK } from '../api/client'
import Logo from './Logo'
import ModeToggle from './ModeToggle'

function navClass({ isActive }) {
  return `rounded px-3 py-1.5 text-sm font-medium transition ${
    isActive
      ? 'bg-zinc-800 text-zinc-100 ring-1 ring-zinc-700'
      : 'text-zinc-400 hover:bg-zinc-800/60 hover:text-zinc-200'
  }`
}

export default function Layout() {
  const location = useLocation()
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 border-b border-zinc-800 bg-zinc-950/90 backdrop-blur-sm">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-2.5">
          <NavLink to="/" aria-label="LogSense home">
            <Logo />
          </NavLink>
          <nav className="flex items-center gap-0.5">
            <NavLink to="/" end className={navClass}>Upload</NavLink>
            <NavLink to="/history" className={navClass}>History</NavLink>
            <NavLink to="/compare" className={navClass}>Compare</NavLink>
            <span className="ml-3 border-l border-zinc-800 pl-3">
              <ModeToggle />
            </span>
          </nav>
        </div>
      </header>

      {USE_MOCK && (
        <div className="border-b border-amber-900/50 bg-amber-950/50 px-4 py-1.5 text-center text-xs font-medium text-amber-400">
          Mock mode · showing static data from src/mock/, not the real backend
        </div>
      )}

      <main key={location.pathname} className="rise mx-auto max-w-6xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  )
}
