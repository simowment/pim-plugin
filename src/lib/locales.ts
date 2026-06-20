import { MedusaError } from '@medusajs/framework/utils'
import type { MedusaRequest } from '@medusajs/framework/http'

const LOCALE_EXAMPLE = 'fr-FR'
const LOCALE_HEADER = 'x-medusa-locale'
const LOCALE_WITH_REGION_PATTERN = /^[A-Za-z]{2,3}(?:-[A-Za-z]{4})?-(?:[A-Za-z]{2}|[0-9]{3})$/

type LocalizedMedusaRequest = MedusaRequest & {
  locale?: unknown
}

function firstHeaderValue(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) {
    return value[0]
  }

  return value
}

export function parseCanonicalPimLocale(locale: unknown): string | null {
  if (typeof locale !== 'string') {
    return null
  }

  const trimmed = locale.trim()
  if (!trimmed || trimmed.includes('_')) {
    return null
  }

  if (!LOCALE_WITH_REGION_PATTERN.test(trimmed)) {
    return null
  }

  const [canonical] = Intl.getCanonicalLocales(trimmed)
  if (!canonical) {
    return null
  }

  const parsed = new Intl.Locale(canonical)
  return parsed.region ? canonical : null
}

export function assertCanonicalPimLocale(locale: unknown, fieldName = 'locale'): string {
  const canonical = parseCanonicalPimLocale(locale)
  if (canonical) {
    return canonical
  }

  throw new MedusaError(
    MedusaError.Types.INVALID_DATA,
    `${fieldName} must be a canonical BCP 47 locale with a region, for example ${LOCALE_EXAMPLE}.`,
  )
}

export function canonicalPimLocaleOrEmpty(locale: unknown): string {
  return parseCanonicalPimLocale(locale) ?? ''
}

export function resolveRequestPimLocale(
  req: MedusaRequest,
  queryLocale?: string | null,
): string {
  const localizedRequest = req as LocalizedMedusaRequest
  const headerLocale = firstHeaderValue(req.headers[LOCALE_HEADER])
  return assertCanonicalPimLocale(
    queryLocale ?? headerLocale ?? localizedRequest.locale,
    'locale',
  )
}
