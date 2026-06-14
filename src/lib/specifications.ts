export interface PimSpecification {
  key: string
  label: string
  value: string
  unit?: string
  group?: string
}

export const PIM_ACTIVE_STATUSES = ['draft', 'ai_generated', 'reviewed', 'published'] as const
export const PIM_MUTABLE_STATUSES = ['draft', 'ai_generated', 'reviewed'] as const

interface ProductSource {
  title?: unknown
  description?: unknown
  metadata?: unknown
}

interface ContentRecord extends Record<string, unknown> {}

function specificationKey(label: string): string {
  return label
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

function specificationValue(value: unknown): string {
  if (typeof value === 'string') {
    return value.trim()
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value)
  }
  if (Array.isArray(value)) {
    return value.map(specificationValue).filter(Boolean).join(', ')
  }
  if (value && typeof value === 'object') {
    return Object.entries(value)
      .map(([key, nestedValue]) => {
        const formatted = specificationValue(nestedValue)
        return formatted ? `${key}: ${formatted}` : ''
      })
      .filter(Boolean)
      .join(', ')
  }
  return ''
}

export function normalizePimLocale(locale: unknown): string {
  if (typeof locale !== 'string') {
    return ''
  }

  return locale.trim().toLowerCase().replace(/_/g, '-')
}

export function normalizePimLanguage(locale: unknown): string {
  return normalizePimLocale(locale).split('-')[0] ?? ''
}

export function localeMatches(recordLocale: unknown, requestedLocale: unknown): boolean {
  const record = normalizePimLocale(recordLocale)
  const requested = normalizePimLocale(requestedLocale)

  if (!record || !requested) {
    return false
  }

  return record === requested || normalizePimLanguage(record) === normalizePimLanguage(requested)
}

export function hasUsableSpecifications(
  specifications: unknown,
): specifications is PimSpecification[] {
  return Array.isArray(specifications) && specifications.length > 0
}

function channelScore(
  recordChannel: unknown,
  requestedChannel: string,
  defaultChannel: string,
): number {
  if (recordChannel === requestedChannel) {
    return 0
  }

  if (recordChannel === defaultChannel) {
    return 1
  }

  if (recordChannel === 'default') {
    return 2
  }

  return 3
}

function localeScore(recordLocale: unknown, requestedLocale: string): number {
  if (normalizePimLocale(recordLocale) === normalizePimLocale(requestedLocale)) {
    return 0
  }

  if (localeMatches(recordLocale, requestedLocale)) {
    return 1
  }

  return 2
}

export function filterPimContentRecords(
  records: ContentRecord[],
  filters: {
    locale?: string
    channel?: string
    statuses?: readonly string[]
  },
): ContentRecord[] {
  return records.filter((record) => {
    if (filters.locale && !localeMatches(record.locale, filters.locale)) {
      return false
    }

    if (filters.channel && record.channel !== filters.channel) {
      return false
    }

    if (filters.statuses?.length && !filters.statuses.includes(String(record.status ?? ''))) {
      return false
    }

    return true
  })
}

export function resolveBestPimContentRecord(
  records: ContentRecord[],
  options: {
    locale: string
    channel?: string
    defaultChannel?: string
    statuses?: readonly string[]
    preferSpecifications?: boolean
  },
): ContentRecord | null {
  const channel = options.channel ?? options.defaultChannel ?? 'storefront'
  const defaultChannel = options.defaultChannel ?? 'storefront'
  const matches = filterPimContentRecords(records, {
    locale: options.locale,
    statuses: options.statuses,
  }).filter((record) => channelScore(record.channel, channel, defaultChannel) < 3)

  matches.sort((a, b) => {
    if (options.preferSpecifications) {
      const specDelta =
        Number(hasUsableSpecifications(b.specifications_json)) -
        Number(hasUsableSpecifications(a.specifications_json))

      if (specDelta !== 0) {
        return specDelta
      }
    }

    const localeDelta =
      localeScore(a.locale, options.locale) - localeScore(b.locale, options.locale)
    if (localeDelta !== 0) {
      return localeDelta
    }

    const channelDelta =
      channelScore(a.channel, channel, defaultChannel) -
      channelScore(b.channel, channel, defaultChannel)
    if (channelDelta !== 0) {
      return channelDelta
    }

    return String(b.updated_at ?? b.published_at ?? '').localeCompare(
      String(a.updated_at ?? a.published_at ?? ''),
    )
  })

  return matches[0] ?? null
}

export function normalizeSupplierSpecifications(attributes: unknown): PimSpecification[] {
  if (!attributes || typeof attributes !== 'object' || Array.isArray(attributes)) {
    return []
  }

  const seen = new Set<string>()
  const specifications: PimSpecification[] = []

  for (const [label, rawValue] of Object.entries(attributes)) {
    const cleanLabel = label.trim()
    const key = specificationKey(cleanLabel)
    const value = specificationValue(rawValue)

    if (!key || !value || seen.has(key)) {
      continue
    }

    seen.add(key)
    specifications.push({
      key,
      label: cleanLabel,
      value,
      group: 'supplier',
    })
  }

  return specifications
}

export function buildPimGenerationSource(
  product: ProductSource,
  storedContent?: Record<string, unknown>,
): Record<string, unknown> {
  const metadata =
    product.metadata && typeof product.metadata === 'object'
      ? (product.metadata as Record<string, unknown>)
      : {}
  const storedSpecifications = Array.isArray(storedContent?.specifications_json)
    ? storedContent.specifications_json
    : []
  const storedRawSource = storedContent?.raw_source_json
  const rawSource =
    storedRawSource && typeof storedRawSource === 'object'
      ? (storedRawSource as Record<string, unknown>)
      : {}
  const nativeContent = storedContent
    ? {}
    : {
        title: product.title ?? null,
        description: product.description ?? null,
      }

  return {
    ...(storedContent ?? {}),
    ...nativeContent,
    specifications_json:
      storedSpecifications.length > 0
        ? storedSpecifications
        : normalizeSupplierSpecifications(metadata.attributes),
    raw_source_json: {
      ...rawSource,
      supplier: metadata.supplier ?? null,
      supplier_product_id: metadata.supplier_product_id ?? null,
      attributes: metadata.attributes ?? null,
    },
  }
}
