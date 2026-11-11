import { useEffect, useState } from 'react'

// Counts from 0 up to `target` over `duration` ms, for the headline numbers.
// requestAnimationFrame runs once per screen refresh, so the count moves smoothly.
export function useCountUp(target, duration = 800) {
  const [value, setValue] = useState(0)

  useEffect(() => {
    let frame
    const start = performance.now()
    function step(now) {
      const progress = Math.min((now - start) / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3) // fast at first, slow at the end
      setValue(Math.round(target * eased))
      if (progress < 1) frame = requestAnimationFrame(step)
    }
    frame = requestAnimationFrame(step)
    return () => cancelAnimationFrame(frame)
  }, [target, duration])

  return value
}

// True one frame after the component appears. Used to start CSS transitions
// (bars growing, dots sliding in) from their "empty" position.
export function useAppeared() {
  const [appeared, setAppeared] = useState(false)
  useEffect(() => {
    const frame = requestAnimationFrame(() => setAppeared(true))
    return () => cancelAnimationFrame(frame)
  }, [])
  return appeared
}
