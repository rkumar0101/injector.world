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

type ZipCentre = { lat: number; lng: number; city: string | null; stateCode: string | null }

/**
 * The centre of a ZIP from our own zip_codes table, via /api/geo/zip. Null for
 * an unknown ZIP, a network failure or an abort; callers decide the fallback.
 */
async function fetchZipCentre(zip: string, signal?: AbortSignal): Promise<ZipCentre | null> {
  try {
    const res = await fetch(`/api/geo/zip?zip=${encodeURIComponent(zip)}`, { signal })
    if (!res.ok) return null
    const data = (await res.json()) as any
    if (!data?.found || !isFiniteNumber(data.lat) || !isFiniteNumber(data.lng)) return null
    return {
      lat: data.lat,
      lng: data.lng,
      city: typeof data.city === 'string' ? data.city : null,
      stateCode: typeof data.state === 'string' ? data.state : null,
    }
  } catch {
    return null
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
    // The IP's own answer, kept in case the ZIP-centre lookup is slow.
    let ipPlace: NearMePlace | null = null
    let settled = false
    // Set on unmount (and on React's dev double-run), so a request aborted by
    // cleanup cannot write 'none' over the run that replaced it.
    let cancelled = false
    let timer = 0

    function settle(next: NearMePlace | null) {
      if (settled || cancelled || overriddenRef.current) return
      settled = true
      window.clearTimeout(timer)
      if (next) {
        setPlace(next)
        setSource('ip')
        setStatus('ready')
      } else {
        setStatus('none')
      }
    }

    timer = window.setTimeout(() => {
      controller.abort()
      // Out of time. If the IP answered but the ZIP centre did not, the IP's
      // point is still the visitor's area, and a local list beats none.
      settle(ipPlace)
    }, RESOLVE_TIMEOUT_MS)

    void (async () => {
      try {
        const res = await fetch('/api/geo/ip', { signal: controller.signal })
        const data: any = res.ok ? await res.json() : null
        if (!isFiniteNumber(data?.lat) || !isFiniteNumber(data?.lng) || typeof data?.zip !== 'string' || !data.zip) {
          // Coordinates without a ZIP cannot label the heading, and the heading
          // is half of what makes this feature readable. Treat as unresolved.
          settle(null)
          return
        }
        const zip = String(data.zip).slice(0, 5)
        ipPlace = {
          zip,
          city: typeof data.city === 'string' ? data.city : null,
          stateCode: typeof data.stateCode === 'string' ? data.stateCode : null,
          lat: data.lat,
          lng: data.lng,
        }

        /**
         * Measure from the centre of the ZIP the heading names, not from the
         * IP's own point (2026-09-12).
         *
         * The IP point is wherever the geo provider pins that address block. It
         * is not the visitor and it is not the ZIP, so distances measured from
         * it cannot be checked against anything the page shows. Founder checked
         * them on the map and they were off: a VPN exit in Houston produced
         * Mosaic Dermatology 0.2 mi and Westlake Dermatology 0.3 mi, which only
         * reproduce from the point 29.73,-95.41 (the IP point, rounded). From the
         * 77098 centre Westlake is 0.6 mi.
         *
         * The centre is also what the manual "Change" path already uses, so
         * both ways into the listing now measure from the same kind of point.
         */
        const centre = await fetchZipCentre(zip, controller.signal)
        settle(
          centre
            ? {
                zip,
                city: centre.city ?? ipPlace.city,
                stateCode: centre.stateCode ?? ipPlace.stateCode,
                lat: centre.lat,
                lng: centre.lng,
              }
            : ipPlace,
        )
      } catch {
        settle(ipPlace)
      }
    })()

    return () => {
      cancelled = true
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [])

  const setZip = useCallback(async (zip: string): Promise<boolean> => {
    const clean = zip.trim()
    if (!/^\d{5}$/.test(clean)) return false

    const centre = await fetchZipCentre(clean)
    if (!centre) return false

    const next: NearMePlace = {
      zip: clean,
      city: centre.city,
      stateCode: centre.stateCode,
      lat: centre.lat,
      lng: centre.lng,
    }
    overriddenRef.current = true
    writeSaved(next)
    setPlace(next)
    setSource('saved')
    setStatus('ready')
    return true
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
