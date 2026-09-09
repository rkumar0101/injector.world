/** Coercion + normalization helpers for CSV import. */
import { lookupZip } from '../zip-lookup'

export type Row = Record<string, string>

export function str(v: string | undefined): string | undefined {
  if (v == null) return undefined
  const t = String(v).trim()
  return t === '' ? undefined : t
}

export function num(v: string | undefined): number | undefined {
  const s = str(v)
  if (s === undefined) return undefined
  const n = Number(s)
  return Number.isFinite(n) ? n : undefined
}

export function int(v: string | undefined): number | undefined {
  const n = num(v)
  return n === undefined ? undefined : Math.trunc(n)
}

export function bool(v: string | undefined, fallback = false): boolean {
  const s = str(v)?.toLowerCase()
  if (s === undefined) return fallback
  return s === 'true' || s === '1' || s === 'yes' || s === 'y'
}

export function isoDate(v: string | undefined): string | undefined {
  const s = str(v)
  if (s === undefined) return undefined
  const d = new Date(s)
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString()
}

/** Split a semicolon list into trimmed non-empty parts. */
export function list(v: string | undefined): string[] {
  const s = str(v)
  if (s === undefined) return []
  return s
    .split(';')
    .map((x) => x.trim())
    .filter(Boolean)
}

/** Semicolon list -> array of { [key]: value } (Payload array field shape). */
export function listOfObj(v: string | undefined, key: string): Array<Record<string, string>> {
  return list(v).map((value) => ({ [key]: value }))
}

/** A US ZIP is 5 digits, optionally + 4 (ZIP+4). */
export function isValidZip(v: string | undefined): boolean {
  const s = str(v)
  if (s === undefined) return true // missing is handled elsewhere; only flag present-but-malformed
  return /^\d{5}(-\d{4})?$/.test(s)
}

/**
 * Cross-validate a ZIP against the offline `zip_codes` table (GeoNames): does the
 * ZIP exist, and if so does its real city/state match what the row claims? Catches
 * "Houston, TX" with a Newark ZIP, which the format-only `isValidZip()` cannot.
 * Returns null when the ZIP is missing/malformed (nothing to cross-check) or when
 * it matches; otherwise a short reason string for the alert message.
 */
export async function validateZipLocation(
  zip: string | undefined,
  city: string | undefined,
  state: string | undefined,
  pool: any,
): Promise<string | null> {
  const z = str(zip)
  if (!z || !/^\d{5}$/.test(z)) return null
  const hit = await lookupZip(z, pool)
  if (!hit) return `ZIP ${z} was not found in the zip_codes reference table`
  if (!city || !state) return null
  const cityMatches = normalizeCity(hit.city) === normalizeCity(city)
  const stateMatches = hit.state.toUpperCase() === state.toUpperCase()
  if (cityMatches && stateMatches) return null
  return `ZIP ${z} resolves to ${hit.city}, ${hit.state} but the row says ${city}, ${state}`
}

/** Latitude must be -90..90, longitude -180..180. */
export function isValidLat(n: number | undefined): boolean {
  return n === undefined || (n >= -90 && n <= 90)
}
export function isValidLng(n: number | undefined): boolean {
  return n === undefined || (n >= -180 && n <= 180)
}

/**
 * Normalize a US phone to E.164 ("+1XXXXXXXXXX") when confidently a 10-digit
 * (or 1 + 10) US number. Returns { value, valid }: `value` is the normalized
 * string (or the trimmed original when it can't be normalized) and `valid` is
 * whether it is already a clean E.164-looking US number or was normalizable.
 */
export function normalizePhone(v: string | undefined): { value: string | undefined; valid: boolean } {
  const s = str(v)
  if (s === undefined) return { value: undefined, valid: true }
  const digits = s.replace(/\D/g, '')
  if (digits.length === 10) return { value: `+1${digits}`, valid: true }
  if (digits.length === 11 && digits.startsWith('1')) return { value: `+${digits}`, valid: true }
  // Not a clean US number — keep the original text, flag as invalid.
  return { value: s, valid: false }
}

export function kebab(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

export function providerSlug(fullName: string, credentials: string, city: string | undefined): string {
  const parts = [kebab(fullName), credentials.toLowerCase()]
  if (city) parts.push(kebab(city))
  return parts.filter(Boolean).join('-')
}

/**
 * Canonical clinic slug: `name-zip`.
 *
 * LOCKED 2026-08-04 (founder-mandated). Never fold city/state into this —
 * they're already path segments (`/clinics/[state]/[city]/[slug]`), so
 * repeating them here is redundant and was reverted after founder pushback.
 * Callers must still resolve collisions (same name + same zip) by appending
 * -2, -3, … — see lib/clinic-slug-hook.ts / the slug migration script.
 */
export function clinicSlug(clinicName: string, zip: string | undefined): string {
  const z = String(zip ?? '').match(/\d{5}/)?.[0] ?? String(zip ?? '').trim()
  return [kebab(clinicName), z].filter(Boolean).join('-').slice(0, 180)
}

/** Comma or semicolon list -> trimmed non-empty parts. Handles both separators (URLs never contain , or ;). */
export function commaOrSemiList(v: string | undefined): string[] {
  const s = str(v)
  if (s === undefined) return []
  return s.split(/[,;]/).map((x) => x.trim()).filter(Boolean)
}

/** commaOrSemiList -> array of { [key]: value } (Payload array field shape). */
export function commaOrSemiListOfObj(v: string | undefined, key: string): Array<Record<string, string>> {
  return commaOrSemiList(v).map((value) => ({ [key]: value }))
}

/** Title-case a string: "lip filler" → "Lip Filler". */
export function titleCase(s: string): string {
  return (
    s
      .replace(/\b\w/g, (c) => c.toUpperCase())
      // \b treats an apostrophe as a word boundary, so the naive pass above turned
      // "crow's feet" into "Crow'S Feet". That is exactly what reached the DB and
      // the public /services page (service #11, found 2026-09-10). A LONE letter
      // after an apostrophe is a possessive or contraction and stays lowercase.
      // Two or more letters is a real name ("O'Fallon", "D'Angelo") and keeps its
      // capital, which matters because import-data.ts also title-cases ALL-CAPS
      // city names through here.
      .replace(/'([A-Za-z])(?![A-Za-z])/g, (_m, c: string) => `'${c.toLowerCase()}`)
  )
}

/**
 * Guards against a CSV column shift dumping review prose into a short field.
 *
 * Real case (found 2026-08-17): two clinic rows had a Google review split across
 * `address_line_1` and `city`, because the review text carried commas and
 * newlines and that row's quoting broke. One of them reached production as a
 * 223-character "city", which then auto-created a metro Location with a
 * 218-character slug and put a full sentence in the public city filter list.
 *
 * Deliberately two tiers. `prose` is only for values no legitimate city or
 * street address can have, and the caller drops those. `suspicious` is for
 * values that are merely odd (an address with no digits, say) and the caller
 * keeps them but raises an alert, because a false positive there would delete
 * real data.
 *
 * Note what is NOT treated as prose: a period. "St. Louis", "Mt. Juliet" and
 * "Sault Ste. Marie" are real cities, and 167 clinics use that form.
 */
export type ProseVerdict = 'clean' | 'suspicious' | 'prose'

const WORD_SPLIT = /\s+/

export function classifyCityValue(value: string | undefined): ProseVerdict {
  const v = (value ?? '').trim()
  if (!v) return 'clean'
  // "\\n" (literal backslash-n) shows up when a scraper JSON-escapes before the
  // CSV is written, which is exactly how the 2026-08-17 row arrived.
  if (/[\n\r]/.test(v) || v.includes('\\n')) return 'prose'
  if (v.length > 40) return 'prose'
  if (/[!?;]/.test(v)) return 'prose'
  if (v.split(WORD_SPLIT).length > 6) return 'prose'
  return 'clean'
}

export function classifyAddressValue(value: string | undefined): ProseVerdict {
  const v = (value ?? '').trim()
  if (!v) return 'clean'
  if (/[\n\r]/.test(v) || v.includes('\\n')) return 'prose'
  // A URL is never an address. Five staging rows carry a Google review link or a
  // googleusercontent photo URL here, from the same class of column shift.
  if (/^https?:\/\//i.test(v) || /googleusercontent\.com|google\.com\/(maps|local)/i.test(v)) return 'prose'
  if (/[!?]/.test(v)) return 'prose'
  // Length alone is not enough. A row starting with a street number is a real
  // address that someone appended directions to ("2300 Wilson Blvd Suite 115
  // Entrance is street access across from ..."), and dropping it would throw
  // away the address. Only a long value that does not begin with a number is
  // treated as misplaced text.
  if (v.length > 120) return /^\d/.test(v) ? 'suspicious' : 'prose'
  // A street address without a single digit is not impossible, but combined
  // with sentence length it is almost always misplaced text. Flag, do not drop:
  // "Located on the second floor of the building" is a real note some rows carry.
  if (!/\d/.test(v) && v.split(WORD_SPLIT).length > 6) return 'suspicious'
  return 'clean'
}

/** Normalize a city name for matching against Location records ("New York City" ~ "New York"). */
export function normalizeCity(s: string): string {
  return s
    .toLowerCase()
    .replace(/\bcity\b/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * CSV label -> canonical brand slug (product names: Botox, Juvederm, etc.)
 */
const BRAND_ALIASES: Record<string, string> = {
  botox: 'botox',
  dysport: 'dysport',
  xeomin: 'xeomin',
  jeuveau: 'jeuveau',
  daxxify: 'daxxify',
  juvederm: 'juvederm',
  restylane: 'restylane',
  sculptra: 'sculptra',
  radiesse: 'radiesse',
  kybella: 'kybella',
}

/** Set of canonical brand slugs for fast membership checks. */
export const BRAND_SLUGS = new Set(Object.values(BRAND_ALIASES))

/**
 * CSV label -> canonical service slug (body-area treatments: Lip Filler, Masseter Botox, etc.)
 */
const SERVICE_ALIASES: Record<string, string> = {
  'lip filler': 'lip-filler',
  lips: 'lip-filler',
  'cheek filler': 'cheek-filler',
  cheeks: 'cheek-filler',
  'jawline filler': 'jawline-filler',
  jawline: 'jawline-filler',
  'tear trough': 'tear-trough',
  'tear trough filler': 'tear-trough',
  'under eye': 'tear-trough',
  masseter: 'masseter-botox',
  'masseter botox': 'masseter-botox',
  'forehead botox': 'forehead-botox',
  forehead: 'forehead-botox',
  'brow lift': 'brow-lift',
  prp: 'prp',
  'prp therapy': 'prp',
  microneedling: 'microneedling',
  'thread lift': 'thread-lift',
}

/** Set of canonical service slugs for fast membership checks. */
export const SERVICE_SLUGS = new Set(Object.values(SERVICE_ALIASES))

/** Returns canonical brand slug for a CSV label, or null. */
export function brandSlugFor(label: string): string | null {
  const norm = label.toLowerCase().trim()
  return BRAND_ALIASES[norm] ?? (BRAND_SLUGS.has(norm) ? norm : null)
}

/** Returns canonical service slug for a CSV label, or null. */
export function serviceSlugFor(label: string): string | null {
  const norm = label.toLowerCase().trim()
  return SERVICE_ALIASES[norm] ?? (SERVICE_SLUGS.has(norm) ? norm : null)
}

/** Returns canonical slug for any CSV treatment label (brand or service), or null. */
export function treatmentSlugFor(label: string): string | null {
  return brandSlugFor(label) ?? serviceSlugFor(label) ?? kebab(label) ?? null
}
