'use client'

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'

/**
 * Visitor ZIP + coordinates for the near-me listing (2026-09-10).
 *
 * Used by exactly three listings -- /brands/<brand>, /services/<service> and
 * /clinics -- where the visitor has chosen no location. On a state or city page
 * they HAVE chosen one, and overriding that with their IP would be wrong, so
 * those pages never call this. See docs/ZIP-NEAR-ME-LISTING-2026-09-10.md.
 *
 * Resolution order, first that works wins:
 *   1. localStorage -- synchronous, no network, no wait for a repeat visitor.
 *   2. GET /api/geo/ip -- one request, given up on after RESOLVE_TIMEOUT_MS.
 *   3. nothing: the page keeps its national fallback list.
 *
 * The ZIP never enters the URL and nothing here navigates. All of this is
 * post-hydration, so the served HTML is unchanged and a crawler (which has no
 * IP geo anyway) sees the same national list it saw before.
 */

export type NearMeStatus =
  /**
   * Server render and the first client render, before any resolution has run.
   *
   * This value exists so the served HTML and the first client render agree:
   * both show the real fallback list. Starting at 'resolving' would put the
   * loading skeleton into the server-rendered HTML, which is exactly what the
   * fallback-list rule forbids, and would make the first client render
   * disagree with the markup it is hydrating.
   */
  | 'idle'
  /** Waiting on /api/geo/ip. The listings show a skeleton in this state. */
  | 'resolving'
  /** A ZIP and coordinates are available. */
  | 'ready'
  /** Nothing could be resolved (non-US, VPN, blocked, timed out). */
  | 'none'

export type NearMeSource = 'saved' | 'ip' | 'none'

export type NearMePlace = {
  zip: string
  city: string | null
  stateCode: string | null
  lat: number
  lng: number
}

export type NearMeState = {
  status: NearMeStatus
  zip: string | null
  city: string | null
  stateCode: string | null
  lat: number | null
  lng: number | null
  source: NearMeSource
  /** Resolves false when the ZIP is not in the dataset; state is left alone. */
  setZip: (zip: string) => Promise<boolean>
  clear: () => void
}

const STORAGE_KEY = 'iw:near-me'

/**
 * A visitor on a slow connection must never be left looking at a skeleton. Past
 * this, give up on geo and show the fallback list, which is a complete, useful
 * page in its own right.
 */
const RESOLVE_TIMEOUT_MS = 1200

/**
 * Runs before paint on the client and degrades to useEffect on the server,
 * where useLayoutEffect warns and does nothing. Before-paint matters: a
 * returning visitor's saved ZIP is read here, and reading it after paint is
 * what would make the skeleton flash for someone who should never see it.
 */
const useIsomorphicLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

/**
 * Every read and write is wrapped: private mode, blocked site data and a few
 * embedded webviews all throw on access, and the page must render correctly
 * with no stored value rather than break.
 */
function readSaved(): NearMePlace | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<NearMePlace>
    if (typeof parsed?.zip !== 'string' || !/^\d{5}$/.test(parsed.zip)) return null
    if (!isFiniteNumber(parsed.lat) || !isFiniteNumber(parsed.lng)) return null
    return {
      zip: parsed.zip,
      city: typeof parsed.city === 'string' ? parsed.city : null,
      stateCode: typeof parsed.stateCode === 'string' ? parsed.stateCode : null,
      lat: parsed.lat,
      lng: parsed.lng,
    }
  } catch {
    return null
  }
}

function writeSaved(place: NearMePlace) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(place))
  } catch {
    /* storage unavailable: the ZIP still applies for this page view */
  }
}

function clearSaved() {
  try {
    window.localStorage.removeItem(STORAGE_KEY)
  } catch {
    /* nothing to do */
  }
}

export function useNearMe(): NearMeState {
  const [status, setStatus] = useState<NearMeStatus>('idle')
  const [place, setPlace] = useState<NearMePlace | null>(null)
  const [source, setSource] = useState<NearMeSource>('none')

  // Set once the visitor picks a ZIP by hand, so a late-arriving IP answer
  // cannot overwrite a choice they made while it was in flight.
  const overriddenRef = useRef(false)

  useIsomorphicLayoutEffect(() => {
    const saved = readSaved()
    if (saved) {
      setPlace(saved)
      setSource('saved')
      setStatus('ready')
      return
    }

    setStatus('resolving')

    const controller = new AbortController()
    const timer = window.setTimeout(() => {
      controller.abort()
      if (!overriddenRef.current) setStatus((s) => (s === 'resolving' ? 'none' : s))
    }, RESOLVE_TIMEOUT_MS)

    fetch('/api/geo/ip', { signal: controller.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((data: any) => {
        if (overriddenRef.current) return
        if (isFiniteNumber(data?.lat) && isFiniteNumber(data?.lng) && typeof data?.zip === 'string' && data.zip) {
          setPlace({
            zip: String(data.zip).slice(0, 5),
            city: typeof data.city === 'string' ? data.city : null,
            stateCode: typeof data.stateCode === 'string' ? data.stateCode : null,
            lat: data.lat,
            lng: data.lng,
          })
          setSource('ip')
          setStatus('ready')
          return
        }
        // Coordinates without a ZIP cannot label the heading, and the heading is
        // half of what makes this feature readable. Treat it as unresolved.
        setStatus('none')
      })
      .catch(() => {
        if (!overriddenRef.current) setStatus('none')
      })
      .finally(() => window.clearTimeout(timer))

    return () => {
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [])

  const setZip = useCallback(async (zip: string): Promise<boolean> => {
    const clean = zip.trim()
    if (!/^\d{5}$/.test(clean)) return false

    try {
      const res = await fetch(`/api/geo/zip?zip=${encodeURIComponent(clean)}`)
      if (!res.ok) return false
      const data = (await res.json()) as any
      if (!data?.found || !isFiniteNumber(data.lat) || !isFiniteNumber(data.lng)) return false

      const next: NearMePlace = {
        zip: String(data.zip ?? clean),
        city: typeof data.city === 'string' ? data.city : null,
        stateCode: typeof data.state === 'string' ? data.state : null,
        lat: data.lat,
        lng: data.lng,
      }
      overriddenRef.current = true
      writeSaved(next)
      setPlace(next)
      setSource('saved')
      setStatus('ready')
      return true
    } catch {
      return false
    }
  }, [])

  const clear = useCallback(() => {
    clearSaved()
    overriddenRef.current = true
    setPlace(null)
    setSource('none')
    setStatus('none')
  }, [])

  return {
    status,
    zip: place?.zip ?? null,
    city: place?.city ?? null,
    stateCode: place?.stateCode ?? null,
    lat: place?.lat ?? null,
    lng: place?.lng ?? null,
    source,
    setZip,
    clear,
  }
}
