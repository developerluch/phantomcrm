import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { AnimatePresence, LayoutGroup } from 'framer-motion'
import { Splash } from './Splash'
import { getApiBaseUrl } from '../services/config'

// Cinematic timeline — slower, more deliberate splash for a premium
// boot feel:
//   0.0s –  2.0s  splash beats (boot, ghost emerges, eye-wake +
//                 reticle scan, wordmark types in with glow pulse)
//   2.0s –  2.8s  splash exits (bg fades + ghost morphs left via layoutId)
//   2.8s –  3.9s  brand panel + login form fade in cross-faded with
//                 the splash dismissal, settling by ~4.0s.
const MIN_DURATION_MS = 2000
const MAX_DURATION_MS = 5000

// SplashGoneContext carries a deterministic "splash has fully unmounted"
// signal that auth-surface children can use to time their entrance. This
// replaces the previous wall-clock framer-motion delays (2.7s–3.9s) that
// were synced manually to the splash timeline and broke whenever the
// splash didn't render or its timing shifted. The flag flips true the
// moment AnimatePresence's onExitComplete fires (or immediately if the
// splash never mounts because the API was ready before the gate rendered).
const SplashGoneContext = createContext<boolean>(false)

export function useSplashGone(): boolean {
  return useContext(SplashGoneContext)
}

// Surfaces "API was unreachable on boot" so consumers (LoginPage) can
// render a warning banner instead of letting the user submit blind into
// a network error. Once latched true, stays true for the lifetime of the
// session — only resets on full reload.
const ApiHealthContext = createContext<{ apiUnreachable: boolean }>({
  apiUnreachable: false,
})

export function useApiHealth(): { apiUnreachable: boolean } {
  return useContext(ApiHealthContext)
}

export function SplashGate({ children }: { children: ReactNode }) {
  const [apiReady, setApiReady] = useState(false)
  const [minElapsed, setMinElapsed] = useState(false)
  const [forceExit, setForceExit] = useState(false)
  const [splashGone, setSplashGone] = useState(false)
  const [apiUnreachable, setApiUnreachable] = useState(false)

  // Latch apiUnreachable on the first render where forceExit fired with
  // apiReady still false. Once latched, never resets — even if a slow API
  // response arrives at 5500ms, the banner stays so the user has a
  // consistent signal rather than the warning flickering off mid-session.
  useEffect(() => {
    if (forceExit && !apiReady && !apiUnreachable) {
      setApiUnreachable(true)
    }
  }, [forceExit, apiReady, apiUnreachable])

  useEffect(() => {
    const min = setTimeout(() => setMinElapsed(true), MIN_DURATION_MS)
    const max = setTimeout(() => setForceExit(true), MAX_DURATION_MS)
    const controller = new AbortController()

    ;(async () => {
      try {
        const res = await fetch(`${getApiBaseUrl()}/api/v1/health`, {
          method: 'GET',
          signal: controller.signal,
        })
        // 401 still proves the API is alive (it's just rejecting unauth'd
        // requests) — accept it as readiness for splash purposes.
        if (res.ok || res.status === 401) setApiReady(true)
      } catch {
        // Network failure / abort / CORS — let the max-duration timer handle exit.
      }
    })()

    return () => {
      clearTimeout(min)
      clearTimeout(max)
      controller.abort()
    }
  }, [])

  const ready = (apiReady && minElapsed) || forceExit

  // Safety net: if the splash exit animation never completes (e.g.
  // framer-motion misses the onExitComplete callback in some edge case),
  // flip splashGone true 1s after `ready` so the auth surface never gets
  // stuck invisible. The splash bg fade completes in 800ms; 1s leaves a
  // 200ms cushion. Independent of the AnimatePresence callback below.
  useEffect(() => {
    if (!ready) return
    const t = setTimeout(() => setSplashGone(true), 1000)
    return () => clearTimeout(t)
  }, [ready])

  // LayoutGroup establishes a shared layout context across the
  // AnimatePresence boundary. Both the splash's PhantomMark
  // (inside AnimatePresence) and the AuthBrandPanel's PhantomMark
  // (in `children`, always mounted) carry layoutId="phantom-mark"; the
  // LayoutGroup is what tells framer-motion to correlate them. Without
  // it, the auth-panel ghost mounts with no source layout to read and
  // pops into place instead of morphing.
  //
  // Children render under the splash so auth checks and route resolution
  // run in parallel with the brand moment, not serialized after it.
  //
  // The contents-display wrapper around `{children}` carries `inert` and
  // `aria-hidden` while splashGone is false, so keyboard tab and screen
  // readers can't reach the invisible login form behind the overlay
  // *or during the exit animation*. Gating on !splashGone (not !ready)
  // covers the 1s gap between `ready` flipping and the splash actually
  // unmounting — during that window the splash is still visually
  // occluding, so the form must stay untabbable.
  // `display: contents` keeps the wrapper out of the layout tree — children
  // render as if there's no extra box — while still letting `inert`
  // propagate to descendants. inert is a valid HTML attribute supported
  // in modern browsers (Chrome 102+, Safari 15.5+, Electron's Chromium
  // is current) but @types/react 18.3 doesn't yet include it in
  // HTMLAttributes. Spread via a Record bypasses the missing type without
  // resorting to `any`. React 19's types include `inert?: boolean`
  // natively — when this codebase upgrades, the spread can be inlined
  // as a normal JSX prop.
  const inertProps: Record<string, unknown> = !splashGone
    ? { inert: '', 'aria-hidden': true }
    : {}

  return (
    <ApiHealthContext.Provider value={{ apiUnreachable }}>
      <SplashGoneContext.Provider value={splashGone}>
        <LayoutGroup>
          <div className="contents" {...inertProps}>
            {children}
          </div>
          <AnimatePresence onExitComplete={() => setSplashGone(true)}>
            {!ready && <Splash key="splash" />}
          </AnimatePresence>
        </LayoutGroup>
      </SplashGoneContext.Provider>
    </ApiHealthContext.Provider>
  )
}
