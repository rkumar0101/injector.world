'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import { APIProvider, InfoWindow, Map, useMap } from '@vis.gl/react-google-maps'
import { MarkerClusterer } from '@googlemaps/markerclusterer'
import { useTheme } from 'next-themes'
import { MapZoomControl } from '@/components/shared/MapZoomControl'
import { rememberListing } from '@/lib/from-listing'
import { DARK_MAP_STYLE, LIGHT_MAP_STYLE } from '@/lib/maps/theme'
import { svgToDataUrl } from '@/lib/maps/svg-icon'

export type MapPin = {
  id: string
  lat: number
  lng: number
  title: string
  subtitle?: string
  meta?: string
  href: string
  rating?: number
  price?: number
}

const API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY

function dotIcon(active: boolean): { url: string; size: number } {
  const r = active ? 10 : 8
  const size = r * 2 + 4
  const c = size / 2
  const fill = active ? '#0B1B34' : '#3FA68A'
  const stroke = active ? '#3FA68A' : '#FFFFFF'
  return {
    size,
    url: svgToDataUrl(
      `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">` +
        `<circle cx="${c}" cy="${c}" r="${r}" fill="${fill}" stroke="${stroke}" stroke-width="2"/></svg>`,
    ),
  }
}

// Diameter steps (36/44/52) mirror the old GL layer's radius step
// (18/22/26 * 2) for count thresholds at 10 and 50.
function clusterIcon(count: number): { url: string; size: number } {
  const size = count >= 50 ? 52 : count >= 10 ? 44 : 36
  const c = size / 2
  return {
    size,
    url: svgToDataUrl(
      `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">` +
        `<circle cx="${c}" cy="${c}" r="${c - 2}" fill="#0B1B34" stroke="#3FA68A" stroke-width="2"/>` +
        `<text x="${c}" y="${c}" text-anchor="middle" dominant-baseline="central" font-family="Arial, sans-serif" font-size="13" font-weight="600" fill="#FFFFFF">${count}</text></svg>`,
    ),
  }
}

type PopupState = { pin: MapPin; lat: number; lng: number }

export function ListingMapInner({
  pins,
  activePinId,
  onPinClick,
  height = 520,
}: {
  pins: MapPin[]
  activePinId?: string | null
  onPinClick?: (id: string) => void
  height?: number
}) {
  const { resolvedTheme } = useTheme()
  const mapStyle = resolvedTheme === 'dark' ? DARK_MAP_STYLE : LIGHT_MAP_STYLE

  const valid = useMemo(
    () =>
      pins.filter(
        (p) =>
          p.lat !== 0 && p.lng !== 0 &&
          p.lat >= -90 && p.lat <= 90 &&
          p.lng >= -180 && p.lng <= 180,
      ),
    [pins],
  )

  const initCenter = useMemo<{ lat: number; lng: number }>(() => {
    if (valid.length === 0) return { lat: 40.7128, lng: -74.006 }
    const lat = valid.reduce((s, p) => s + p.lat, 0) / valid.length
    const lng = valid.reduce((s, p) => s + p.lng, 0) / valid.length
    return { lat, lng }
  }, [valid])

  if (valid.length === 0) {
    return (
      <div
        className="w-full rounded-2xl bg-surface border border-border flex items-center justify-center text-ink-tertiary text-body-sm"
        style={{ height }}
      >
        No location data available
      </div>
    )
  }

  if (!API_KEY) {
    return (
      <div
        className="w-full rounded-2xl bg-surface border border-border flex items-center justify-center text-ink-tertiary text-body-sm"
        style={{ height }}
      >
        Map unavailable
      </div>
    )
  }

  return (
    <div className="injectors-map rounded-2xl overflow-hidden border border-border shadow-md" style={{ height }}>
      <APIProvider apiKey={API_KEY}>
        <Map
          defaultCenter={initCenter}
          defaultZoom={11}
          gestureHandling="cooperative"
          disableDefaultUI
          clickableIcons={false}
          styles={mapStyle}
          className="h-full w-full"
        >
          <MapZoomControl />
          <ListingMapContent pins={valid} activePinId={activePinId} onPinClick={onPinClick} />
        </Map>
      </APIProvider>
    </div>
  )
}

function ListingMapContent({
  pins,
  activePinId,
  onPinClick,
}: {
  pins: MapPin[]
  activePinId?: string | null
  onPinClick?: (id: string) => void
}) {
  const map = useMap()
  const [popup, setPopup] = useState<PopupState | null>(null)
  const fittedRef = useRef(false)
  // The popup link is the only anchor a map pin produces, so this one call
  // covers every listing that renders a map. See lib/from-listing.ts.
  const pathname = usePathname()

  const handlePinClick = useCallback(
    (pin: MapPin) => {
      onPinClick?.(pin.id)
      setPopup({ pin, lat: pin.lat, lng: pin.lng })
    },
    [onPinClick],
  )

  // Raw google.maps.Marker instances, not the declarative <Marker> component:
  // MarkerClusterer owns marker.setMap() to group/ungroup markers as the user
  // zooms, which would fight a declarative Marker also trying to control map
  // attachment on every render.
  useEffect(() => {
    if (!map) return

    const markers = pins.map((pin) => {
      const { url, size } = dotIcon(pin.id === activePinId)
      const marker = new google.maps.Marker({
        position: { lat: pin.lat, lng: pin.lng },
        title: pin.title,
        icon: {
          url,
          scaledSize: new google.maps.Size(size, size),
          anchor: new google.maps.Point(size / 2, size / 2),
        },
      })
      marker.addListener('click', () => handlePinClick(pin))
      return marker
    })

    // Cluster click zooms/pans to the cluster's bounds by default (library
    // behavior) -- matches the old getClusterExpansionZoom flow with no extra code.
    const clusterer = new MarkerClusterer({
      map,
      markers,
      renderer: {
        render: ({ count, position }) => {
          const { url, size } = clusterIcon(count)
          return new google.maps.Marker({
            position,
            icon: {
              url,
              scaledSize: new google.maps.Size(size, size),
              anchor: new google.maps.Point(size / 2, size / 2),
            },
            zIndex: 1000 + count,
          })
        },
      },
    })

    return () => {
      clusterer.clearMarkers()
      clusterer.setMap(null)
      markers.forEach((m) => m.setMap(null))
    }
  }, [map, pins, activePinId, handlePinClick])

  // Fit bounds only once on first load.
  useEffect(() => {
    if (!map || fittedRef.current || pins.length === 0) return
    fittedRef.current = true
    if (pins.length === 1) {
      map.panTo({ lat: pins[0].lat, lng: pins[0].lng })
      map.setZoom(13)
      return
    }
    const bounds = new google.maps.LatLngBounds()
    pins.forEach((p) => bounds.extend({ lat: p.lat, lng: p.lng }))
    map.fitBounds(bounds, 60)
    const listener = google.maps.event.addListenerOnce(map, 'bounds_changed', () => {
      if ((map.getZoom() ?? 0) > 13) map.setZoom(13)
    })
    return () => google.maps.event.removeListener(listener)
  }, [map, pins])

  if (!popup) return null

  return (
    <InfoWindow position={{ lat: popup.lat, lng: popup.lng }} headerDisabled onClose={() => setPopup(null)}>
      <a
        href={popup.pin.href}
        onClick={() => rememberListing(pathname)}
        style={{
          display: 'block',
          minWidth: 180,
          textDecoration: 'none',
          position: 'relative',
          paddingRight: 20,
        }}
      >
        <button
          type="button"
          aria-label="Close"
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            setPopup(null)
          }}
          style={{
            position: 'absolute',
            right: -4,
            top: -4,
            width: 24,
            height: 24,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: 9999,
            color: '#94A3B8',
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
          }}
        >
          &times;
        </button>
        <div style={{ fontWeight: 600, fontSize: 13, color: '#0B1B34', marginBottom: 2, lineHeight: 1.3 }}>
          {popup.pin.title}
        </div>
        {popup.pin.subtitle && (
          <div style={{ fontSize: 11, color: '#475569' }}>{popup.pin.subtitle}</div>
        )}
        {popup.pin.meta && (
          <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 2 }}>{popup.pin.meta}</div>
        )}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            marginTop: 8,
            paddingTop: 8,
            borderTop: '1px solid #EEF1F5',
          }}
        >
          {popup.pin.rating ? (
            <span style={{ fontSize: 11, fontWeight: 600, color: '#0B1B34' }}>
              &#9733; {popup.pin.rating.toFixed(1)}
            </span>
          ) : null}
          {popup.pin.price ? (
            <span style={{ fontSize: 11, color: '#475569' }}>from ${popup.pin.price}</span>
          ) : null}
          <span style={{ fontSize: 11, color: '#3FA68A', marginLeft: 'auto' }}>View &rarr;</span>
        </div>
      </a>
    </InfoWindow>
  )
}
