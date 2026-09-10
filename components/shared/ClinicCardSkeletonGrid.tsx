/**
 * Placeholder cards shown while the visitor's ZIP is being resolved on the
 * three pillar listings (2026-09-10).
 *
 * The point is that the list appears ONCE. Before this, the national list
 * rendered, geo arrived a moment later, and the whole grid was replaced in
 * place -- the visible swap the founder reported. Holding the space for the
 * one real render is what removes it.
 *
 * Client-only by construction: it is rendered from a state the server never
 * reaches, so the served HTML still carries the real fallback list.
 *
 * Shape matches DirectoryClinicCard: 16/9 photo block, then a title, a
 * location line and a rating line, at the same padding and gaps, so nothing
 * moves when the real cards land.
 */
export function ClinicCardSkeletonGrid({ count = 12 }: { count?: number }) {
  return (
    <div
      className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5"
      aria-hidden="true"
    >
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="rounded-2xl border border-border bg-surface-canvas overflow-hidden flex flex-col"
        >
          <div className="w-full aspect-[16/9] bg-surface animate-pulse" />
          <div className="flex flex-col flex-1 p-4 gap-2">
            <div className="h-4 w-3/4 rounded-control bg-surface animate-pulse" />
            <div className="h-3 w-1/2 rounded-control bg-surface animate-pulse" />
            <div className="h-3 w-2/5 rounded-control bg-surface animate-pulse" />
          </div>
        </div>
      ))}
    </div>
  )
}
