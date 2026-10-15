import { useEffect, useState } from 'react'

import { errorMessage } from '../api/client'

// Runs an API call when the page opens (and again when `deps` change).
// Gives back { data, loading, error, reload } so every page can show
// a loading state, an error state with a "Try again" button, and the data.
export function useApi(loader, deps) {
  const [state, setState] = useState({ data: null, loading: true, error: null })
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let cancelled = false // ignore late answers if the user already left the page
    setState((old) => ({ ...old, loading: true, error: null }))
    loader()
      .then((data) => !cancelled && setState({ data, loading: false, error: null }))
      .catch((error) => !cancelled && setState({ data: null, loading: false, error: errorMessage(error) }))
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, attempt])

  return { ...state, reload: () => setAttempt((n) => n + 1) }
}
