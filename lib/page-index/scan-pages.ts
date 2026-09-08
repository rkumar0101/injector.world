import type { Payload } from 'payload'
import { thresholdFor, type PageType } from '../markets'
import { STATIC_PAGES } from './static-pages'

/**
 * Page-index scan. Refreshes `page_index`, the registry of every url the site
 * publishes, and reconciles market liveness.
 *
 * What it owns and what it must never touch
 * -----------------------------------------
 * The scan owns FACTS: which urls exist, how much data each has, and whether
 * each one is `publishable` (is there anything real to show). It writes those on
 * every run.
 *
 * The scan does NOT own the DECISION. `index_mode`, `indexed_at`, `batch_label`
 * and `acknowledged` belong to the admin and the batch-index tool, and the upsert
 * below deliberately leaves them out of its ON CONFLICT SET list. A scan can
 * therefore never index or de-index a url by itself -- it can only re-resolve
 * `indexed` from the admin's existing decision plus the current facts.
 *
 * One useful consequence: if a page loses all its data, `publishable` goes false
 * and it drops out of the sitemap, but `index_mode` survives. When the data comes
 * back it resumes indexing, without anyone having to re-batch it.
 *
 * Also flips each location's `isLive`. Market liveness stayed AUTOMATIC (>=1
 * published clinic); only indexing became manual. Do not conflate the two.
 *
 * Performance: this used to issue one payload.create/update per row. At ~92k
 * rows that is tens of thousands of round trips plus full Payload hook overhead
 * each time. It is now a batched raw-SQL upsert, with the resolution logic
 * duplicated in SQL. Keep that SQL in step with PageIndex's beforeChange hook --
 * the hook still governs single-row edits from the admin UI.
 *
 * Shared by `scripts/scan-pages.ts` (CLI) and `/api/admin/scan-pages` (button).
 */

export type PageScanResult = {
  total: number
  created: number
  updated: number
  lostData: number
  failed: number
  baseline: boolean
  /** Row count contributed per source, so a missing source is obvious. */
  bySource: Record<string, number>
  /** Published clinics whose city+state matches no Location, so their url cannot be built. */
  unmappedClinics: number
  newPages: { path: string; dataCount: number }[]
  marketsFlippedLive: number
  marketsFlippedComingSoon: number
  indexedNow: number
  queuedNow: number
}

type DesiredPage = {
  pageKey: string
  path: string
  pageType: PageType
  serviceSlug?: string
  brandSlug?: string
  stateSlug?: string
  citySlug?: string
  sourceCollection?: string
  sourceId?: string
  dataCount: number
  /** Hard gate: is there something real to show here right now. */
  publishable: boolean
}

const UPSERT_BATCH = 500

/** Write progress every N upsert batches, not every batch. */
const PROGRESS_EVERY = 4

/**
 * Called as the scan moves through its stages. Optional so the CLI and tests can
 * ignore it; `lib/page-index/run-scan-job.ts` uses it to drive the job row that
 * the admin UI polls.
 *
 * Never awaited in a way that can fail the scan: a progress write is bookkeeping,
 * and losing one must never abort a run that is otherwise fine.
 */
export type ScanProgress = (update: {
  phase: string
  processed?: number
  total?: number
}) => void

export async function scanPages(
  payload: Payload,
  onProgress: ScanProgress = () => {},
): Promise<PageScanResult> {
  const pool = (payload.db as any).pool
  const scanStartedAt = new Date().toISOString()

  const report = (phase: string, processed?: number, total?: number) => {
    try { onProgress({ phase, processed, total }) } catch { /* bookkeeping only */ }
  }

  report('Loading services, brands and locations')

  // -- Reference data ---------------------------------------------------------
  const [treatments, brands, locations] = await Promise.all([
    payload.find({ collection: 'services', limit: 1000, depth: 0 }),
    payload.find({ collection: 'brands', limit: 1000, depth: 0 }),
    payload.find({ collection: 'locations', limit: 10000, depth: 0 }),
  ])

  const serviceSlugById = new Map<string, string>()
  for (const t of treatments.docs as any[]) serviceSlugById.set(String(t.id), t.slug)
  const brandSlugById = new Map<string, string>()
  for (const b of brands.docs as any[]) brandSlugById.set(String(b.id), b.slug)

  // state code -> { id, slug }; metro "lowername|CODE" -> { id, slug, stateSlug }
  const stateByCode = new Map<string, { id: string; slug: string }>()
  for (const l of locations.docs as any[]) {
    if (l.kind === 'state' && l.state) stateByCode.set(String(l.state).toUpperCase(), { id: String(l.id), slug: l.slug })
  }
  const metroByKey = new Map<string, { id: string; slug: string; stateSlug: string }>()
  for (const l of locations.docs as any[]) {
    if ((l.kind === 'metro' || l.kind === 'city') && l.name && l.state) {
      const code = String(l.state).toUpperCase()
      const st = stateByCode.get(code)
      metroByKey.set(`${String(l.name).toLowerCase()}|${code}`, {
        id: String(l.id), slug: l.slug, stateSlug: st?.slug ?? '',
      })
    }
  }

  // -- Clinic data aggregations (raw SQL for speed) ----------------------------
  report('Counting clinics per service, brand and location')
  const [relAgg, brandRelAgg, cityAgg, stateAgg] = await Promise.all([
    // Per service × city: counts clinics offering that service in that city.
    pool.query(
      `SELECT cr.services_id AS tid, lower(c.city) AS city, upper(c.state) AS code, count(*)::int AS n
         FROM clinics c
         JOIN clinics_rels cr ON cr.parent_id = c.id AND cr.services_id IS NOT NULL
        WHERE c.status = 'published' AND c.city IS NOT NULL AND c.city !~ '\\d'
        GROUP BY cr.services_id, lower(c.city), upper(c.state)`,
    ),
    // Per brand × city: counts clinics carrying that brand in that city.
    pool.query(
      `SELECT cr.brands_id AS tid, lower(c.city) AS city, upper(c.state) AS code, count(*)::int AS n
         FROM clinics c
         JOIN clinics_rels cr ON cr.parent_id = c.id AND cr.brands_id IS NOT NULL
        WHERE c.status = 'published' AND c.city IS NOT NULL AND c.city !~ '\\d'
        GROUP BY cr.brands_id, lower(c.city), upper(c.state)`,
    ),
    // Per city / per state: distinct published clinics (treatment-agnostic hubs).
    pool.query(
      `SELECT lower(city) AS city, upper(state) AS code, count(*)::int AS n
         FROM clinics WHERE status='published' AND city IS NOT NULL AND city !~ '\\d'
        GROUP BY lower(city), upper(state)`,
    ),
    pool.query(
      `SELECT upper(state) AS code, count(*)::int AS n
         FROM clinics WHERE status='published' AND state IS NOT NULL GROUP BY upper(state)`,
    ),
  ])

  // -- Build the desired page set ----------------------------------------------
  report('Building the list of listing pages')
  const desired = new Map<string, DesiredPage>()
  const bySource: Record<string, number> = {}

  const add = (p: DesiredPage) => {
    const ex = desired.get(p.pageKey)
    if (ex) {
      ex.dataCount += p.dataCount
      ex.publishable = ex.publishable || p.publishable
    } else {
      desired.set(p.pageKey, p)
    }
  }

  // ── Computed pages: they exist because clinic data exists. A computed page is
  // publishable exactly when at least one published clinic backs it.
  const computed = (p: Omit<DesiredPage, 'publishable'>) => add({ ...p, publishable: p.dataCount > 0 })

  const serviceStateCount = new Map<string, number>() // tid|CODE -> n
  const servicePillarCount = new Map<string, number>() // tid -> n
  const brandStateCount = new Map<string, number>()
  const brandPillarCount = new Map<string, number>()

  for (const r of relAgg.rows) {
    const serviceSlug = serviceSlugById.get(String(r.tid))
    if (!serviceSlug) continue
    const code = String(r.code)
    const metro = metroByKey.get(`${r.city}|${code}`)
    const state = stateByCode.get(code)

    if (metro && metro.stateSlug) {
      computed({
        pageKey: `service-city:${serviceSlug}:${metro.stateSlug}:${metro.slug}`,
        path: `/services/${serviceSlug}/${metro.stateSlug}/${metro.slug}`,
        pageType: 'service-city', serviceSlug, stateSlug: metro.stateSlug, citySlug: metro.slug,
        dataCount: r.n,
      })
    }
    if (state) {
      serviceStateCount.set(`${r.tid}|${code}`, (serviceStateCount.get(`${r.tid}|${code}`) ?? 0) + r.n)
      servicePillarCount.set(String(r.tid), (servicePillarCount.get(String(r.tid)) ?? 0) + r.n)
    }
  }
  for (const [key, n] of serviceStateCount) {
    const [tid, code] = key.split('|')
    const serviceSlug = serviceSlugById.get(tid)
    const state = stateByCode.get(code)
    if (!serviceSlug || !state) continue
    computed({
      pageKey: `service-state:${serviceSlug}:${state.slug}:-`,
      path: `/services/${serviceSlug}/${state.slug}`,
      pageType: 'service-state', serviceSlug, stateSlug: state.slug, dataCount: n,
    })
  }
  for (const [tid, n] of servicePillarCount) {
    const serviceSlug = serviceSlugById.get(tid)
    if (!serviceSlug) continue
    computed({
      pageKey: `service-pillar:${serviceSlug}:-:-`,
      path: `/services/${serviceSlug}`,
      pageType: 'service-pillar', serviceSlug, dataCount: n,
    })
  }

  for (const r of brandRelAgg.rows) {
    const brandSlug = brandSlugById.get(String(r.tid))
    if (!brandSlug) continue
    const code = String(r.code)
    const metro = metroByKey.get(`${r.city}|${code}`)
    const state = stateByCode.get(code)

    if (metro && metro.stateSlug) {
      computed({
        pageKey: `brand-city-directory:${brandSlug}:${metro.stateSlug}:${metro.slug}`,
        path: `/brands/${brandSlug}/${metro.stateSlug}/${metro.slug}`,
        pageType: 'brand-city-directory', brandSlug, stateSlug: metro.stateSlug, citySlug: metro.slug,
        dataCount: r.n,
      })
    }
    if (state) {
      brandStateCount.set(`${r.tid}|${code}`, (brandStateCount.get(`${r.tid}|${code}`) ?? 0) + r.n)
      brandPillarCount.set(String(r.tid), (brandPillarCount.get(String(r.tid)) ?? 0) + r.n)
    }
  }
  for (const [key, n] of brandStateCount) {
    const [tid, code] = key.split('|')
    const brandSlug = brandSlugById.get(tid)
    const state = stateByCode.get(code)
    if (!brandSlug || !state) continue
    computed({
      pageKey: `brand-state:${brandSlug}:${state.slug}:-`,
      path: `/brands/${brandSlug}/${state.slug}`,
      pageType: 'brand-state', brandSlug, stateSlug: state.slug, dataCount: n,
    })
  }
  for (const [tid, n] of brandPillarCount) {
    const brandSlug = brandSlugById.get(tid)
    if (!brandSlug) continue
    computed({
      pageKey: `brand-pillar:${brandSlug}:-:-`,
      path: `/brands/${brandSlug}`,
      pageType: 'brand-pillar', brandSlug, dataCount: n,
    })
  }

  // city hubs / state hubs -- every location with >=1 clinic, live or not.
  for (const r of cityAgg.rows) {
    const metro = metroByKey.get(`${r.city}|${String(r.code)}`)
    if (metro && metro.stateSlug) {
      computed({
        pageKey: `city-hub:-:${metro.stateSlug}:${metro.slug}`,
        // pageKey deliberately unchanged: it carries no path, it is the upsert
        // key, and renaming it would orphan every existing row rather than
        // update it. Only `path` moved under /clinics on 2026-09-09.
        path: `/clinics/${metro.stateSlug}/${metro.slug}`,
        pageType: 'city-hub', stateSlug: metro.stateSlug, citySlug: metro.slug, dataCount: r.n,
      })
    }
  }
  for (const r of stateAgg.rows) {
    const state = stateByCode.get(String(r.code))
    if (state) {
      computed({
        pageKey: `state-hub:-:${state.slug}:-`,
        path: `/clinics/${state.slug}`,
        pageType: 'state-hub', stateSlug: state.slug, dataCount: r.n,
      })
    }
  }
  bySource.computed = desired.size

  // ── Entity pages: one url per document. Gated by publish/approval status, not
  // by volume, so dataCount is a nominal 1.

  // Clinics. Only rows whose city+state resolves to a real Location get a url --
  // anything else would produce a path that 404s, and a registry full of dead
  // paths is worse than an honest skip count. The skip total is reported.
  let unmappedClinics = 0
  {
    report('Reading clinics')
    const res = await pool.query(
      `SELECT id, slug, city, state, status
         FROM clinics
        WHERE slug IS NOT NULL AND slug <> ''
          AND city IS NOT NULL AND city <> ''
          AND state IS NOT NULL AND state <> ''`,
    )
    let n = 0
    for (const c of res.rows as any[]) {
      const metro = metroByKey.get(`${String(c.city).toLowerCase()}|${String(c.state).toUpperCase()}`)
      if (!metro || !metro.stateSlug) {
        if (c.status === 'published') unmappedClinics++
        continue
      }
      add({
        pageKey: `clinic:${c.id}`,
        path: `/clinics/${metro.stateSlug}/${metro.slug}/${c.slug}`,
        pageType: 'clinic',
        stateSlug: metro.stateSlug,
        citySlug: metro.slug,
        sourceCollection: 'clinics',
        sourceId: String(c.id),
        dataCount: 1,
        publishable: c.status === 'published',
      })
      n++
    }
    bySource.clinics = n
  }

  // Guides and news. Both gate on published + approved, matching the existing
  // APPROVED filter their own queries use.
  report('Reading guides and news')
  for (const [table, type, prefix] of [
    ['guides', 'guide', '/guides'],
    ['news', 'news', '/news'],
  ] as const) {
    const res = await pool.query(
      `SELECT id, slug, status, review_status FROM ${table} WHERE slug IS NOT NULL AND slug <> ''`,
    )
    for (const d of res.rows as any[]) {
      add({
        pageKey: `${type}:${d.id}`,
        path: `${prefix}/${d.slug}`,
        pageType: type,
        sourceCollection: table,
        sourceId: String(d.id),
        dataCount: 1,
        publishable: d.status === 'published' && d.review_status === 'approved',
      })
    }
    bySource[table] = res.rows.length
  }

  // Questions. Table may be empty (it is today); guarded so a schema difference
  // cannot abort the whole scan.
  try {
    const res = await pool.query(`SELECT id, slug, status FROM qa WHERE slug IS NOT NULL AND slug <> ''`)
    for (const d of res.rows as any[]) {
      add({
        pageKey: `question:${d.id}`,
        path: `/questions/${d.slug}`,
        pageType: 'question',
        sourceCollection: 'qa',
        sourceId: String(d.id),
        dataCount: 1,
        /**
         * 'answered', not 'published'. The qa collection's status enum is
         * new | answered | rejected (collections/QA.ts) and has never had a
         * 'published' value, so this comparison was permanently false: every
         * question would have landed unpublishable, and `publishable` is the
         * HARD gate, so no admin batch could ever have pulled a /questions/*
         * url into the sitemap. It went unnoticed only because the table has
         * been empty since the collection shipped.
         */
        publishable: d.status === 'answered',
      })
    }
    bySource.qa = res.rows.length
  } catch {
    bySource.qa = 0
  }

  // Providers were removed entirely on 2026-08-24; the /injectors routes are
  // gone, so there is nothing to register here.
  bySource.providers = 0

  // Static routes, from the shared list so the sitemap and the registry cannot
  // disagree about which hand-written pages exist.
  report('Reading static routes')
  for (const sp of STATIC_PAGES) {
    add({
      pageKey: `static:${sp.path}`,
      path: sp.path,
      pageType: 'static',
      dataCount: 1,
      // Non-indexable statics are pinned unpublishable: that is the hard gate,
      // so no batch can ever pull /login or /search into the sitemap.
      publishable: sp.indexable,
    })
  }
  bySource.static = STATIC_PAGES.length

  // -- Was there anything here before? -----------------------------------------
  const { rows: countRows } = await pool.query(`SELECT count(*)::int AS n FROM page_index`)
  const baseline = (countRows[0]?.n ?? 0) === 0

  // -- Bulk upsert -------------------------------------------------------------
  // Per-row payload.create/update was the old approach; at ~92k rows it is not
  // viable. Batched multi-row upsert instead.
  //
  // `xmax = 0` on the RETURNING row is the standard way to tell an INSERT from an
  // ON CONFLICT UPDATE, which is where created/updated counts come from.
  const COLS = [
    'page_key', 'path', 'page_type', 'service_slug', 'brand_slug', 'state_slug', 'city_slug',
    'source_collection', 'source_id', 'data_count', 'has_data', 'publishable', 'meets_threshold',
    'indexed', 'index_mode', 'acknowledged', 'first_seen_with_data', 'last_scanned_at',
  ]
  const CASTS = [
    'varchar', 'varchar', 'enum_page_index_page_type', 'varchar', 'varchar', 'varchar', 'varchar',
    'varchar', 'varchar', 'numeric', 'boolean', 'boolean', 'boolean',
    'boolean', 'enum_page_index_index_mode', 'boolean', 'timestamptz', 'timestamptz',
  ]

  let created = 0, updated = 0, failed = 0
  const newPages: { path: string; dataCount: number }[] = []
  const failures: { path: string; error: string }[] = []

  const all = [...desired.values()]
  report(`Writing ${all.length.toLocaleString()} urls`, 0, all.length)

  let batchNo = 0
  for (let i = 0; i < all.length; i += UPSERT_BATCH) {
    const chunk = all.slice(i, i + UPSERT_BATCH)
    const params: any[] = []
    const tuples: string[] = []

    for (const p of chunk) {
      const meetsThreshold = p.dataCount >= thresholdFor(p.pageType)
      const values = [
        p.pageKey, p.path, p.pageType,
        p.serviceSlug ?? null, p.brandSlug ?? null, p.stateSlug ?? null, p.citySlug ?? null,
        p.sourceCollection ?? null, p.sourceId ?? null,
        p.dataCount, p.dataCount > 0, p.publishable, meetsThreshold,
        // A brand new row is always queued, so it can never arrive indexed.
        false, 'queued', false,
        p.publishable ? scanStartedAt : null, scanStartedAt,
      ]
      const base = params.length
      tuples.push(`(${values.map((_, k) => `$${base + k + 1}::${CASTS[k]}`).join(', ')})`)
      params.push(...values)
    }

    const sql = `
      INSERT INTO page_index (${COLS.join(', ')})
      VALUES ${tuples.join(', ')}
      ON CONFLICT (page_key) DO UPDATE SET
        path              = EXCLUDED.path,
        page_type         = EXCLUDED.page_type,
        service_slug      = EXCLUDED.service_slug,
        brand_slug        = EXCLUDED.brand_slug,
        state_slug        = EXCLUDED.state_slug,
        city_slug         = EXCLUDED.city_slug,
        source_collection = EXCLUDED.source_collection,
        source_id         = EXCLUDED.source_id,
        data_count        = EXCLUDED.data_count,
        has_data          = EXCLUDED.has_data,
        publishable       = EXCLUDED.publishable,
        meets_threshold   = EXCLUDED.meets_threshold,
        -- Re-resolve from the admin's EXISTING decision plus the new facts.
        -- index_mode / indexed_at / batch_label / acknowledged are absent from
        -- this list on purpose: a scan must never index or de-index anything.
        indexed           = (page_index.index_mode = 'indexed' AND EXCLUDED.publishable),
        first_seen_with_data = COALESCE(page_index.first_seen_with_data, EXCLUDED.first_seen_with_data),
        last_scanned_at   = EXCLUDED.last_scanned_at,
        updated_at        = NOW()
      RETURNING (xmax = 0) AS inserted, path, data_count`

    try {
      const res = await pool.query(sql, params)
      for (const r of res.rows as any[]) {
        if (r.inserted) {
          created++
          if (!baseline && newPages.length < 50) newPages.push({ path: r.path, dataCount: Number(r.data_count) })
        } else {
          updated++
        }
      }
    } catch (err: any) {
      // One bad batch must not lose the other ~90k rows of progress.
      failed += chunk.length
      failures.push({ path: `batch@${i}`, error: err?.message ?? String(err) })
    }

    batchNo++
    if (batchNo % PROGRESS_EVERY === 0) {
      report(`Writing ${all.length.toLocaleString()} urls`, Math.min(i + UPSERT_BATCH, all.length), all.length)
    }

    // Yield to the event loop between batches. Without this a ~186-batch run
    // holds the thread and starves HTTP traffic on the same instance, which
    // matters here because the DB pool is capped at 4 connections.
    await new Promise((r) => setImmediate(r))
  }
  report(`Writing ${all.length.toLocaleString()} urls`, all.length, all.length)

  // -- Urls that vanished ------------------------------------------------------
  // Anything not touched by this run keeps an older last_scanned_at. Zero it out
  // and force publishable false, which drops it from the sitemap immediately.
  // index_mode survives, so a url that comes back resumes without re-batching.
  //
  // SKIPPED ENTIRELY IF ANY BATCH FAILED. A failed batch leaves its rows with a
  // stale last_scanned_at, so they look identical to a url that genuinely
  // disappeared -- reconciling anyway would de-publish up to UPSERT_BATCH real,
  // healthy urls per failure. A stale row is harmless; a wrongly un-published one
  // drops out of the sitemap. Leave the data alone and let the next clean scan
  // reconcile.
  let lostData = 0
  if (failed === 0) {
    report('Retiring urls that no longer have anything to show')
    const lost = await pool.query(
      `UPDATE page_index
          SET data_count = 0, has_data = false, publishable = false, indexed = false,
              last_scanned_at = $1, updated_at = NOW()
        WHERE (last_scanned_at IS NULL OR last_scanned_at < $1)
          AND (data_count <> 0 OR publishable = true OR indexed = true)`,
      [scanStartedAt],
    )
    lostData = lost.rowCount ?? 0
  } else {
    console.error(
      `[scanPages] ${failed} row(s) failed to upsert, so the "lost data" reconcile was SKIPPED ` +
      `to avoid un-publishing healthy urls. Fix the failure and re-run.`,
    )
  }

  // -- isLive: automatic, purely a function of "does this location have data" --
  // Unchanged by the manual-indexing switch. Liveness is about showing a real
  // directory instead of a Coming Soon page; it is not an SEO decision.
  //
  // Deliberately still one payload.update per CHANGED location, not bulk SQL.
  // Two reasons: the `if (l.isLive === hasData) continue` guard means a steady
  // state writes almost nothing, and Locations carries `revalidateAfterChange`,
  // so going around Payload with raw SQL would flip a market live without ever
  // invalidating its cached page.
  report('Updating which markets are live')
  const citiesWithData = new Set(cityAgg.rows.map((r: any) => `${r.city}|${r.code}`))
  const statesWithData = new Set(stateAgg.rows.map((r: any) => String(r.code)))
  let marketsFlippedLive = 0
  let marketsFlippedComingSoon = 0

  for (const l of locations.docs as any[]) {
    if (l.kind !== 'state' && l.kind !== 'metro' && l.kind !== 'city') continue
    const code = String(l.state ?? '').toUpperCase()
    const hasData =
      l.kind === 'state'
        ? statesWithData.has(code)
        : citiesWithData.has(`${String(l.name ?? '').toLowerCase()}|${code}`)
    if (l.isLive === hasData) continue
    try {
      await payload.update({ collection: 'locations', id: l.id, overrideAccess: true, data: { isLive: hasData } })
      if (hasData) marketsFlippedLive++
      else marketsFlippedComingSoon++
    } catch (err: any) {
      failed++
      failures.push({ path: `location:${l.id}:${l.name}`, error: err?.message ?? String(err) })
    }
  }

  if (failures.length > 0) {
    console.error(`[scanPages] ${failed} row(s) failed and were skipped:`)
    for (const f of failures.slice(0, 20)) console.error(`  ${f.path}: ${f.error}`)
  }

  // -- Final tallies -----------------------------------------------------------
  report('Counting up')
  const { rows: tally } = await pool.query(
    `SELECT sum((indexed)::int)::int AS indexed,
            sum((index_mode = 'queued')::int)::int AS queued
       FROM page_index`,
  )
  const indexedNow = tally[0]?.indexed ?? 0
  const queuedNow = tally[0]?.queued ?? 0

  // -- ONE rollup DataAlert per run --------------------------------------------
  // This used to write one alert per newly discovered page. That produced 48,841
  // open alerts against 434 real ones, burying genuine problems (duplicate
  // clinics, content validation errors) in the Operations view. A scan is a
  // routine job; it gets a single summary line, and only when something changed.
  if (created > 0 || lostData > 0 || unmappedClinics > 0 || failed > 0) {
    const parts = [`${created} new url(s)`, `${lostData} lost data`]
    if (unmappedClinics > 0) parts.push(`${unmappedClinics} published clinic(s) have no matching Location, so no url was registered`)
    if (failed > 0) parts.push(`${failed} row(s) failed to write, so the lost-data reconcile was skipped`)

    // Only a real problem stays open and demands attention. A routine run is
    // logged as already-acknowledged so it never competes with genuine alerts.
    const needsAttention = unmappedClinics > 0 || failed > 0
    await payload.create({
      collection: 'data-alerts', overrideAccess: true,
      data: {
        // Stable key + timestamp: one row per run, not one per page.
        alertKey: `page-scan-${scanStartedAt}`,
        type: 'new_indexable_page',
        severity: failed > 0 ? 'error' : unmappedClinics > 0 ? 'warning' : 'info',
        source: 'scan',
        message:
          `Page scan: ${parts.join(', ')}. ${queuedNow} url(s) queued, ${indexedNow} indexed. ` +
          `Nothing indexes itself -- batch urls in from the Indexing screen.`,
        collectionSlug: 'page-index',
        status: needsAttention ? 'open' : 'acknowledged',
      },
    }).catch(() => {})
  }

  return {
    total: desired.size, created, updated, lostData, failed, baseline,
    bySource, unmappedClinics,
    newPages, marketsFlippedLive, marketsFlippedComingSoon,
    indexedNow, queuedNow,
  }
}
