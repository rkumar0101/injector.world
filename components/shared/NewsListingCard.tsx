import Image from 'next/image'
import Link from 'next/link'
import type { NewsCard } from '@/lib/news-queries'
import { CoverFallback } from '@/components/shared/CoverFallback'

/**
 * The one news card. Used by the homepage "Latest News" section and by the
 * /news listing, so the two can never drift apart again.
 *
 * Client request 2026-08-06: the category chip ("INDUSTRY") is gone from the
 * card, leaving the date alone above the title, and the author /
 * medical-reviewer byline at the bottom went with it. Category still drives the
 * filter tabs on /news, and both bylines still run on the article page.
 */
function formatDate(iso?: string) {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

export function NewsListingCard({
  article,
  headingLevel = 3,
}: {
  article: NewsCard
  /** 3 under a section <h2> (homepage), 2 on a listing page that only has an <h1>. */
  headingLevel?: 2 | 3
}) {
  const Heading = headingLevel === 2 ? 'h2' : 'h3'

  return (
    <Link
      href={`/news/${article.slug}`}
      className="group flex flex-col rounded-2xl border border-border bg-surface overflow-hidden hover:shadow-hover transition-shadow"
    >
      {article.coverImageUrl ? (
        <div className="relative w-full aspect-[16/9] overflow-hidden bg-surface-warm">
          <Image
            src={article.coverImageUrl}
            alt={article.title}
            fill
            sizes="(min-width:1024px) 33vw, (min-width:640px) 50vw, 100vw"
            className="object-cover group-hover:scale-[1.02] transition-transform duration-300"
          />
        </div>
      ) : (
        <div className="relative w-full aspect-[16/9] overflow-hidden">
          <CoverFallback label="News" />
        </div>
      )}

      <div className="flex flex-col p-4 flex-1">
        {article.publishedAt && (
          <span className="text-caption text-ink-tertiary mb-2">{formatDate(article.publishedAt)}</span>
        )}

        <Heading className="font-serif text-[17px] leading-snug font-medium text-ink-primary group-hover:text-brand-accent transition-colors line-clamp-3">
          {article.title}
        </Heading>
        <p className="mt-2 text-body-sm text-ink-secondary leading-relaxed line-clamp-2 flex-1">
          {article.excerpt}
        </p>
      </div>
    </Link>
  )
}
