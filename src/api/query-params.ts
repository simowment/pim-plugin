import type { MedusaRequest } from '@medusajs/framework/http'

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function firstQueryString(value: unknown): string | undefined {
  if (typeof value === 'string') {
    const trimmed = value.trim()
    return trimmed ? trimmed : undefined
  }

  if (Array.isArray(value)) {
    const [first] = value
    return firstQueryString(first)
  }

  return undefined
}

function urlQueryString(req: MedusaRequest, key: string): string | undefined {
  const request = req as MedusaRequest & {
    originalUrl?: unknown
    url?: unknown
  }
  const rawUrl = firstQueryString(request.originalUrl) ?? firstQueryString(request.url)
  if (!rawUrl) {
    return undefined
  }

  const queryStart = rawUrl.indexOf('?')
  if (queryStart < 0) {
    return undefined
  }

  return new URLSearchParams(rawUrl.slice(queryStart + 1)).get(key) ?? undefined
}

export function getOptionalQueryString(req: MedusaRequest, key: string): string | undefined {
  const validatedValue = isRecord(req.validatedQuery) ? req.validatedQuery[key] : undefined
  const rawValue = isRecord(req.query) ? req.query[key] : undefined

  return firstQueryString(validatedValue) ?? firstQueryString(rawValue) ?? urlQueryString(req, key)
}
