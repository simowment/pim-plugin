const ERROR_MESSAGE_KEYS = ['message', 'error', 'details', 'cause'] as const
const DEFAULT_MAX_ERROR_MESSAGE_LENGTH = 1000

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function asNonEmptyString(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null
  }

  const trimmed = value.trim()
  return trimmed && trimmed !== '[object Object]' ? trimmed : null
}

function extractNestedMessage(value: unknown, visited = new Set<unknown>()): string | null {
  const directString = asNonEmptyString(value)
  if (directString) {
    return directString
  }

  if ((!isRecord(value) && !Array.isArray(value)) || visited.has(value)) {
    return null
  }

  visited.add(value)

  if (Array.isArray(value)) {
    for (const item of value) {
      const message = extractNestedMessage(item, visited)
      if (message) {
        return message
      }
    }

    return null
  }

  for (const key of ERROR_MESSAGE_KEYS) {
    const message = extractNestedMessage(value[key], visited)
    if (message) {
      return message
    }
  }

  return null
}

export function truncateErrorMessage(
  message: string,
  maxLength = DEFAULT_MAX_ERROR_MESSAGE_LENGTH,
): string {
  return message.length > maxLength ? `${message.slice(0, maxLength)}...` : message
}

export function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim()) {
    return truncateErrorMessage(error.message)
  }

  const nestedMessage = extractNestedMessage(error)
  if (nestedMessage) {
    return truncateErrorMessage(nestedMessage)
  }

  return 'Unknown error'
}
