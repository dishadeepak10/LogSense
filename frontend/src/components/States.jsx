import { LogoMark } from './Logo'

// The three states every page needs besides "data loaded".

export function Loading({ text = 'Loading...' }) {
  return (
    <div role="status" className="flex flex-col items-center justify-center gap-3 py-16 text-zinc-400">
      <LogoMark size={44} looping />
      {text}
    </div>
  )
}

export function ErrorState({ message, onRetry }) {
  return (
    <div role="alert" className="rounded-lg border border-red-900 bg-red-950/40 p-5 text-red-300">
      <p className="font-medium">Something went wrong</p>
      <p className="mt-1 text-sm">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-3 rounded-md bg-panel px-3 py-1.5 text-sm font-medium text-red-300 ring-1 ring-red-800 hover:bg-red-900"
        >
          Try again
        </button>
      )}
    </div>
  )
}

export function EmptyState({ title, children }) {
  return (
    <div className="rounded-lg border border-dashed border-zinc-700 bg-panel p-8 text-center">
      <p className="font-medium text-zinc-300">{title}</p>
      {children && <div className="mt-1 text-sm text-zinc-400">{children}</div>}
    </div>
  )
}
