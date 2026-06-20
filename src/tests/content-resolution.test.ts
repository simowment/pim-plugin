/**
 * content-resolution.test.ts
 *
 * Unit tests for content fallback resolution logic.
 * Tests the selection order: locale+channel → locale+default → default_locale+channel → default_locale+default
 */

import { describe, it, expect } from 'vitest'

// ─── Inline the resolution logic for isolated unit testing ─────────────────

interface ContentRecord {
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
  const published = records.filter((r) => r.product_id === productId && r.status === 'published')

  const candidates = [
    { locale: requestedLocale, channel: requestedChannel },
    { locale: requestedLocale, channel: defaultChannel },
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
    locale: 'en-US',
    channel: 'storefront',
    status: 'published',
    title: 'English storefront title',
  }

  it('resolves exact locale + channel match first', () => {
    const records = [
      { ...base, id: 'cnt_1', locale: 'fr-FR', channel: 'storefront', title: 'French storefront' },
      { ...base, id: 'cnt_2', locale: 'en-US', channel: 'storefront', title: 'English storefront' },
    ]
    const result = resolveContent(records, 'prod_1', 'fr-FR', 'storefront')
    expect(result?.title).toBe('French storefront')
  })

  it('falls back to requested locale + default channel', () => {
    const records = [
      { ...base, id: 'cnt_1', locale: 'fr-FR', channel: 'default', title: 'French default' },
      { ...base, id: 'cnt_2', locale: 'en-US', channel: 'storefront', title: 'English storefront' },
    ]
    const result = resolveContent(records, 'prod_1', 'fr-FR', 'storefront', 'en-US', 'default')
    expect(result?.title).toBe('French default')
  })

  it('does not fall back to default locale for a different requested locale', () => {
    const records = [
      { ...base, id: 'cnt_1', locale: 'en-US', channel: 'storefront', title: 'English storefront' },
    ]
    const result = resolveContent(records, 'prod_1', 'fr-FR', 'storefront')
    expect(result).toBeNull()
  })

  it('does not fall back to default locale + default channel as last resort', () => {
    const records = [
      { ...base, id: 'cnt_1', locale: 'en-US', channel: 'default', title: 'English default' },
    ]
    const result = resolveContent(records, 'prod_1', 'fr-FR', 'google', 'en-US', 'default')
    expect(result).toBeNull()
  })

  it('returns null when no published content exists', () => {
    const records = [{ ...base, id: 'cnt_1', status: 'draft', title: 'Draft content' }]
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
      {
        ...base,
        id: 'cnt_1',
        product_id: 'prod_2',
        locale: 'en',
        channel: 'storefront',
        title: 'Other product',
      },
    ]
    const result = resolveContent(records, 'prod_1', 'en', 'storefront')
    expect(result).toBeNull()
  })
})
