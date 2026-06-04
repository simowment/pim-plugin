/**
 * content-resolution.test.ts
 *
 * Unit tests for content fallback resolution logic.
 * Tests the selection order: locale+channel → locale+default → default_locale+channel → default_locale+default
 */

import { describe, it, expect } from 'vitest'

// ─── Inline the resolution logic for isolated unit testing ─────────────────

type ContentRecord = {
  id: string
  product_id: string
  locale: string
  channel: string
  status: string
  title: string | null
}

function resolveContent(
  records: ContentRecord[],
  productId: string,
  requestedLocale: string,
  requestedChannel: string,
  defaultLocale = 'en',
  defaultChannel = 'storefront',
): ContentRecord | null {
  const published = records.filter(
    (r) => r.product_id === productId && r.status === 'published',
  )

  const candidates = [
    { locale: requestedLocale, channel: requestedChannel },
    { locale: requestedLocale, channel: defaultChannel },
    { locale: defaultLocale, channel: requestedChannel },
    { locale: defaultLocale, channel: defaultChannel },
  ]

  for (const candidate of candidates) {
    const match = published.find(
      (r) => r.locale === candidate.locale && r.channel === candidate.channel,
    )
    if (match) return match
  }

  return null
}

// ─── Tests ─────────────────────────────────────────────────────────────────

describe('Content fallback resolution', () => {
  const base: ContentRecord = {
    id: 'cnt_1',
    product_id: 'prod_1',
    locale: 'en',
    channel: 'storefront',
    status: 'published',
    title: 'English storefront title',
  }

  it('resolves exact locale + channel match first', () => {
    const records = [
      { ...base, id: 'cnt_1', locale: 'fr', channel: 'storefront', title: 'French storefront' },
      { ...base, id: 'cnt_2', locale: 'en', channel: 'storefront', title: 'English storefront' },
    ]
    const result = resolveContent(records, 'prod_1', 'fr', 'storefront')
    expect(result?.title).toBe('French storefront')
  })

  it('falls back to requested locale + default channel', () => {
    const records = [
      { ...base, id: 'cnt_1', locale: 'fr', channel: 'default', title: 'French default' },
      { ...base, id: 'cnt_2', locale: 'en', channel: 'storefront', title: 'English storefront' },
    ]
    const result = resolveContent(records, 'prod_1', 'fr', 'storefront', 'en', 'default')
    expect(result?.title).toBe('French default')
  })

  it('falls back to default locale + requested channel', () => {
    const records = [
      { ...base, id: 'cnt_1', locale: 'en', channel: 'storefront', title: 'English storefront' },
    ]
    const result = resolveContent(records, 'prod_1', 'fr', 'storefront')
    expect(result?.title).toBe('English storefront')
  })

  it('falls back to default locale + default channel as last resort', () => {
    const records = [
      { ...base, id: 'cnt_1', locale: 'en', channel: 'default', title: 'English default' },
    ]
    const result = resolveContent(records, 'prod_1', 'fr', 'google', 'en', 'default')
    expect(result?.title).toBe('English default')
  })

  it('returns null when no published content exists', () => {
    const records = [
      { ...base, id: 'cnt_1', status: 'draft', title: 'Draft content' },
    ]
    const result = resolveContent(records, 'prod_1', 'en', 'storefront')
    expect(result).toBeNull()
  })

  it('ignores draft and ai_generated content', () => {
    const records = [
      { ...base, id: 'cnt_1', status: 'draft', locale: 'en', channel: 'storefront' },
      { ...base, id: 'cnt_2', status: 'ai_generated', locale: 'en', channel: 'storefront' },
      { ...base, id: 'cnt_3', status: 'reviewed', locale: 'en', channel: 'storefront' },
    ]
    const result = resolveContent(records, 'prod_1', 'en', 'storefront')
    expect(result).toBeNull() // reviewed is not published
  })

  it('does not cross product boundaries', () => {
    const records = [
      { ...base, id: 'cnt_1', product_id: 'prod_2', locale: 'en', channel: 'storefront', title: 'Other product' },
    ]
    const result = resolveContent(records, 'prod_1', 'en', 'storefront')
    expect(result).toBeNull()
  })
})
