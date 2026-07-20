'use client'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import {
  haversineDistance,
  isValidUKPostcode,
  lookupPostcode,
  lookupPostcodesBulk,
  reverseGeocodePostcode,
} from '@/lib/pricing'

// LocalStorage key for the buyer's postcode preference — survives across
// pages, tab restarts, and logins/logouts. Cleared explicitly via
// clearPostcode() (the "X" on the current-location chip).
const STORAGE_KEY = 'mealoyo-buyer-postcode'

// Distance-based feed filter shared by the homepage and browse page.
//
// Loads the buyer's postcode from (in order):
//   1. localStorage — persists whatever was last entered / GPS'd
//   2. get_my_profile_full — auto-fills for signed-in buyers on first mount
//
// Geocodes the buyer postcode once (via postcodes.io), and every seller
// postcode in one batched call. Distance for each listing is stored in a
// Map keyed by listingId so the caller can render badges + filter by miles.
//
// Radius defaults to 8mi with an expand() escape hatch to 15mi (matches
// the "Try expanding your search" empty-state affordance).

export type BuyerCoords = { lat: number; lng: number } | null

const DEFAULT_RADIUS = 8
const EXPANDED_RADIUS = 15

export interface UseLocationFilterOptions {
  // Whether to auto-fill the buyer postcode from the user's saved profile
  // on mount. Pages that already know the buyer id can skip this to save
  // the RPC round trip.
  autoFillFromProfile?: boolean
}

// Small helper so a caller can pass any postcode-carrying object and get
// distances by listing id. `postcodeOf` extracts the postcode string.
export function useLocationFilter<T extends { id: string }>(
  items: T[],
  postcodeOf: (item: T) => string | null | undefined,
  { autoFillFromProfile = true }: UseLocationFilterOptions = {},
) {
  const [postcode, setPostcodeState] = useState<string | null>(null)
  const [buyerCoords, setBuyerCoords] = useState<BuyerCoords>(null)
  const [coordsLoading, setCoordsLoading] = useState(false)
  const [coordsError, setCoordsError] = useState<string | null>(null)
  const [radiusMiles, setRadiusMiles] = useState(DEFAULT_RADIUS)
  // postcode-normalised (upper, no spaces) → distance in miles
  const [distancesByPostcode, setDistancesByPostcode] = useState<Map<string, number>>(new Map())
  // Nulls too so we know we've tried and failed for a given postcode
  const [coordsCache, setCoordsCache] = useState<Map<string, { latitude: number; longitude: number } | null>>(new Map())

  const normalise = (p: string) => p.toUpperCase().replace(/\s+/g, '')

  // ── Hydrate: localStorage → profile ──────────────────────────────────
  useEffect(() => {
    if (typeof window === 'undefined') return
    const cached = window.localStorage.getItem(STORAGE_KEY)
    if (cached && isValidUKPostcode(cached)) {
      setPostcodeState(cached)
      return
    }
    if (!autoFillFromProfile) return
    let alive = true
    ;(async () => {
      const { data } = await supabase.rpc('get_my_profile_full')
      if (!alive) return
      const pc = (data?.postcode as string | null) ?? null
      if (pc && isValidUKPostcode(pc)) {
        setPostcodeState(pc)
        try { window.localStorage.setItem(STORAGE_KEY, pc) } catch { /* private mode */ }
      }
    })()
    return () => { alive = false }
  }, [autoFillFromProfile])

  // ── Fetch buyer coords whenever postcode changes ────────────────────
  useEffect(() => {
    // Functional-updater bail-out: if the value we'd write is what's already
    // there, return the same reference so React skips the re-render. See the
    // long note on the second effect below — same reason.
    if (!postcode) { setBuyerCoords(prev => prev === null ? prev : null); return }
    let alive = true
    setCoordsLoading(true); setCoordsError(null)
    ;(async () => {
      const loc = await lookupPostcode(postcode)
      if (!alive) return
      if (!loc) {
        setBuyerCoords(null)
        setCoordsError("Couldn't find that postcode — please try another.")
      } else {
        setBuyerCoords({ lat: loc.latitude, lng: loc.longitude })
      }
      setCoordsLoading(false)
    })()
    return () => { alive = false }
  }, [postcode])

  // ── Batch look up every seller postcode in the current feed ─────────
  //
  // Callers pass `postcodeOf` as an inline arrow (`l => l.profiles?.postcode`)
  // rather than a memoised callback, so its identity flips on every parent
  // render. That means this effect re-fires every render. Any bare
  // `setState(new Map())` here would then reset state to a fresh reference,
  // trigger another render in the parent, recreate the arrow, re-fire the
  // effect — an infinite loop that starves React's useTransition (which
  // router.push relies on) and silently breaks client-side navigation on
  // every page that uses this hook. Fix: use functional updaters that return
  // the SAME reference when the resulting value would be equal, so React
  // bails out via Object.is and no re-render is scheduled.
  useEffect(() => {
    if (!buyerCoords) {
      setDistancesByPostcode(prev => prev.size === 0 ? prev : new Map())
      return
    }
    const needed: string[] = []
    for (const item of items) {
      const pc = postcodeOf(item)
      if (!pc) continue
      const key = normalise(pc)
      if (!coordsCache.has(key)) needed.push(pc)
    }
    let alive = true
    ;(async () => {
      let cache = coordsCache
      if (needed.length) {
        const fresh = await lookupPostcodesBulk(needed)
        if (!alive) return
        cache = new Map(coordsCache)
        for (const [k, v] of fresh.entries()) cache.set(k, v)
        setCoordsCache(cache)
      }
      // Compute per-postcode distance once. Same postcode across many
      // listings only pays for one haversine.
      const dists = new Map<string, number>()
      for (const item of items) {
        const pc = postcodeOf(item)
        if (!pc) continue
        const key = normalise(pc)
        if (dists.has(key)) continue
        const loc = cache.get(key)
        if (loc) dists.set(key, haversineDistance(buyerCoords.lat, buyerCoords.lng, loc.latitude, loc.longitude))
      }
      if (!alive) return
      setDistancesByPostcode(prev => {
        if (prev.size !== dists.size) return dists
        for (const [k, v] of dists) if (prev.get(k) !== v) return dists
        return prev
      })
    })()
    return () => { alive = false }
  }, [buyerCoords, items, postcodeOf, coordsCache])

  // Distance for one item, or null if unknown (seller has no postcode /
  // postcode won't resolve).
  const distanceFor = useCallback((item: T): number | null => {
    if (!buyerCoords) return null
    const pc = postcodeOf(item)
    if (!pc) return null
    return distancesByPostcode.get(normalise(pc)) ?? null
  }, [buyerCoords, postcodeOf, distancesByPostcode])

  // items filtered to within radiusMiles. If we don't know the buyer's
  // location the filter is a no-op — returns the full input list.
  const filtered = useMemo(() => {
    if (!buyerCoords) return items
    return items.filter(item => {
      const d = distanceFor(item)
      if (d == null) return false // seller postcode missing or unresolved
      return d <= radiusMiles
    })
  }, [items, buyerCoords, distanceFor, radiusMiles])

  // Setters — write-through to localStorage so the choice survives navigation.
  const setPostcode = useCallback((pc: string | null) => {
    const trimmed = pc?.trim() ?? null
    if (trimmed && !isValidUKPostcode(trimmed)) {
      setCoordsError('Please enter a valid UK postcode.')
      return
    }
    setPostcodeState(trimmed)
    setRadiusMiles(DEFAULT_RADIUS)
    if (typeof window !== 'undefined') {
      try {
        if (trimmed) window.localStorage.setItem(STORAGE_KEY, trimmed)
        else window.localStorage.removeItem(STORAGE_KEY)
      } catch { /* private mode */ }
    }
  }, [])

  const clearPostcode = useCallback(() => setPostcode(null), [setPostcode])

  // Widen the radius (empty-state "Try expanding your search" affordance).
  const expandRadius = useCallback(() => setRadiusMiles(EXPANDED_RADIUS), [])
  const removeRadius = useCallback(() => setRadiusMiles(Number.POSITIVE_INFINITY), [])

  // GPS → postcode. Uses the browser's geolocation + postcodes.io reverse.
  const useGPS = useCallback(async () => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setCoordsError('Your browser does not support location detection.')
      return
    }
    setCoordsLoading(true); setCoordsError(null)
    await new Promise<void>((resolve) => {
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          const geo = await reverseGeocodePostcode(pos.coords.latitude, pos.coords.longitude)
          if (geo?.postcode) setPostcode(geo.postcode)
          else setCoordsError("Couldn't find a postcode for your location.")
          setCoordsLoading(false)
          resolve()
        },
        () => {
          setCoordsError('Location permission denied.')
          setCoordsLoading(false)
          resolve()
        },
        { enableHighAccuracy: false, timeout: 6000, maximumAge: 300000 },
      )
    })
  }, [setPostcode])

  return {
    postcode,
    setPostcode,
    clearPostcode,
    buyerCoords,
    coordsLoading,
    coordsError,
    filtered,
    distanceFor,
    radiusMiles,
    isRadiusExpanded: radiusMiles === EXPANDED_RADIUS,
    isRadiusRemoved: radiusMiles === Number.POSITIVE_INFINITY,
    expandRadius,
    removeRadius,
    useGPS,
    DEFAULT_RADIUS,
    EXPANDED_RADIUS,
  }
}
