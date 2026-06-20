import { canonicalPimLocaleOrEmpty } from './locales'

export interface PimSpecification {
  key: string
  label: string
  value: string
  unit?: string
  group?: string
}

export interface StorefrontMetadataField {
  key: string
  label: string
  group?: string | null
  visible_in_storefront?: boolean
}

export const PIM_ACTIVE_STATUSES = ['draft', 'ai_generated', 'reviewed', 'published'] as const
export const PIM_MUTABLE_STATUSES = ['draft', 'ai_generated', 'reviewed'] as const
const STOREFRONT_METADATA_GROUP = 'pim'

interface ProductSource {
  title?: unknown
  description?: unknown
  metadata?: unknown
  variants?: unknown
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
    return value.map(specificationValue).filter((item) => Boolean(item)).join(', ')
  }
  if (value && typeof value === 'object') {
    return Object.entries(value)
      .map(([key, nestedValue]) => {
        const formatted = specificationValue(nestedValue)
        return formatted ? `${key}: ${formatted}` : ''
      })
      .filter((item) => Boolean(item))
      .join(', ')
  }
  return ''
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function isPimSpecification(value: unknown): value is PimSpecification {
  if (!isRecord(value)) {
    return false
  }

  return (
    typeof value.key === 'string' &&
    typeof value.label === 'string' &&
    typeof value.value === 'string'
  )
}

function visibleMetadataFields(
  fields: readonly StorefrontMetadataField[],
): StorefrontMetadataField[] {
  return fields.filter((field) => field.visible_in_storefront === true)
}

export function normalizePimLocale(locale: unknown): string {
  return canonicalPimLocaleOrEmpty(locale)
}

export function localeMatches(recordLocale: unknown, requestedLocale: unknown): boolean {
  const record = normalizePimLocale(recordLocale)
  const requested = normalizePimLocale(requestedLocale)

  if (!record || !requested) {
    return false
  }

  return record === requested
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

  return 1
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

    if (options.preferSpecifications) {
      const specDelta =
        Number(hasUsableSpecifications(b.specifications_json)) -
        Number(hasUsableSpecifications(a.specifications_json))

      if (specDelta !== 0) {
        return specDelta
      }
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

export function normalizeStorefrontMetadata(
  metadata: unknown,
  fields: readonly StorefrontMetadataField[],
): Record<string, unknown> {
  if (!isRecord(metadata)) {
    return {}
  }

  const entries = visibleMetadataFields(fields)
    .map((field) => [field.key, metadata[field.key]] as const)
    .filter(([, value]) => specificationValue(value))

  return Object.fromEntries(entries)
}

export function normalizeStorefrontMetadataSpecifications(
  metadata: unknown,
  fields: readonly StorefrontMetadataField[],
): PimSpecification[] {
  if (!isRecord(metadata)) {
    return []
  }

  const specifications: PimSpecification[] = []
  const seen = new Set<string>()

  for (const field of visibleMetadataFields(fields)) {
    const key = field.key.trim()
    const label = field.label.trim()
    const value = specificationValue(metadata[field.key])

    if (!key || !label || !value || seen.has(key)) {
      continue
    }

    seen.add(key)
    specifications.push({
      key,
      label,
      value,
      group: field.group ?? STOREFRONT_METADATA_GROUP,
    })
  }

  return specifications
}

export function mergeStorefrontSpecifications(
  specifications: unknown,
  metadataSpecifications: PimSpecification[],
): PimSpecification[] {
  const baseSpecifications = Array.isArray(specifications)
    ? specifications.filter(isPimSpecification)
    : []
  const seen = new Set(baseSpecifications.map((specification) => specification.key))
  const additions = metadataSpecifications.filter((specification) => {
    if (seen.has(specification.key)) {
      return false
    }

    seen.add(specification.key)
    return true
  })

  return [...baseSpecifications, ...additions]
}

export function serializeStorefrontPimContent(
  record: ContentRecord,
  metadataFields: readonly StorefrontMetadataField[],
): Record<string, unknown> {
  const metadataSpecifications = normalizeStorefrontMetadataSpecifications(
    record.custom_metadata_json,
    metadataFields,
  )
  const specifications = mergeStorefrontSpecifications(
    record.specifications_json,
    metadataSpecifications,
  )
  const storefrontMetadata = normalizeStorefrontMetadata(record.custom_metadata_json, metadataFields)

  return {
    product_id: record.product_id,
    locale: record.locale,
    channel: record.channel,
    title: record.title ?? null,
    description: record.description ?? null,
    short_description: record.short_description ?? null,
    variant_titles: record.variant_titles_json ?? null,
    bullets: record.bullets_json ?? null,
    specifications: specifications.length > 0 ? specifications : null,
    seo: record.seo_json ?? null,
    metadata: Object.keys(storefrontMetadata).length > 0 ? storefrontMetadata : null,
    source: 'pim',
  }
}

export function serializeMedusaProductFallback(
  product: Record<string, unknown>,
  options: {
    productId: string
    locale: string
    channel: string
  },
): Record<string, unknown> {
  const metadata = isRecord(product.metadata) ? product.metadata : {}
  const supplierSpecifications = normalizeSupplierSpecifications(metadata.attributes)
  const variants = Array.isArray(product.variants) ? product.variants : []

  return {
    product_id: options.productId,
    locale: options.locale,
    channel: options.channel,
    title: product.title ?? null,
    description: product.description ?? null,
    short_description: null,
    bullets: null,
    variant_titles: variants
      .filter((variant): variant is Record<string, unknown> => {
        return isRecord(variant) && typeof variant.id === 'string'
      })
      .map((variant) => ({
        variant_id: variant.id,
        title: typeof variant.title === 'string' ? variant.title : '',
      })),
    specifications: supplierSpecifications.length > 0 ? supplierSpecifications : null,
    seo: null,
    metadata: null,
    source: 'medusa_fallback',
  }
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
  const nativeProduct = {
    title: product.title ?? null,
    description: product.description ?? null,
    variants: Array.isArray(product.variants)
      ? product.variants.flatMap((variant) => {
          if (!isRecord(variant) || typeof variant.id !== 'string') {
            return []
          }

          return [
            {
              id: variant.id,
              title: typeof variant.title === 'string' ? variant.title : null,
              sku: typeof variant.sku === 'string' ? variant.sku : null,
            },
          ]
        })
      : [],
  }

  return {
    ...(storedContent ?? {
      title: nativeProduct.title,
      description: nativeProduct.description,
    }),
    native_product_json: nativeProduct,
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
