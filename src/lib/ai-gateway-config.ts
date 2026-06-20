const DEFAULT_AI_GATEWAY_PROVIDER = 'openrouter'
const PORTKEY_PROVIDER_HEADER = 'x-portkey-provider'
const PORTKEY_CONFIG_HEADER = 'x-portkey-config'
const AI_GATEWAY_API_KEY_ENV_KEYS = [
  'AI_GATEWAY_API_KEY',
  'OPENROUTER_API_KEY',
  'KILO_API_KEY',
  'KILOCODE_API_KEY',
  'OPENAI_API_KEY',
] as const
const AI_GATEWAY_BASE_URL_ENV_KEYS = ['AI_GATEWAY_URL', 'OPENAI_BASE_URL'] as const
const AI_GATEWAY_MODEL_ENV_KEYS = ['OPENAI_MODEL', 'AI_MODEL'] as const
const AI_GATEWAY_PROVIDER_ENV_KEYS = ['AI_GATEWAY_PROVIDER'] as const
const PORTKEY_GATEWAY_MARKERS = [
  'api.portkey.ai',
] as const

type AiGatewayHeaders = Record<string, string>

type ResolvePortkeyGatewayHeadersInput = {
  baseUrl?: string
  headers?: AiGatewayHeaders
  provider?: string
}

type ResolveAiGatewayConfigInput = {
  env?: Record<string, string | undefined>
  apiKey?: string
  baseUrl?: string
  model?: string
  provider?: string
  headers?: AiGatewayHeaders
  apiKeyEnvKeys?: readonly string[]
  baseUrlEnvKeys?: readonly string[]
  modelEnvKeys?: readonly string[]
  providerEnvKeys?: readonly string[]
}

function normalizeHeaderName(name: string): string {
  return name.trim().toLowerCase()
}

function hasPortkeyRoutingHeader(headers: AiGatewayHeaders): boolean {
  const headerNames = new Set(Object.keys(headers).map(normalizeHeaderName))
  return headerNames.has(PORTKEY_PROVIDER_HEADER) || headerNames.has(PORTKEY_CONFIG_HEADER)
}

function isPortkeyGatewayUrl(baseUrl: string): boolean {
  const normalizedUrl = baseUrl.trim().toLowerCase()
  return PORTKEY_GATEWAY_MARKERS.some((marker) => normalizedUrl.includes(marker))
}

function readOptionalEnv(env: Record<string, string | undefined>, key: string): string | undefined {
  const value = env[key]
  if (typeof value !== 'string') {
    return undefined
  }

  const trimmedValue = value.trim()
  return trimmedValue ? trimmedValue : undefined
}

function readFirstEnv(
  env: Record<string, string | undefined>,
  keys: readonly string[],
): string | undefined {
  for (const key of keys) {
    const value = readOptionalEnv(env, key)
    if (value) {
      return value
    }
  }

  return undefined
}

function getDefaultEnv(): Record<string, string | undefined> {
  return process.env
}

function normalizeOptionalString(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined
  }

  const trimmedValue = value.trim()
  return trimmedValue ? trimmedValue : undefined
}

function resolveGatewayProvider(provider: unknown, baseUrl?: string): string | undefined {
  const normalizedProvider = normalizeOptionalString(provider)
  if (normalizedProvider) {
    return normalizedProvider
  }

  return baseUrl && isPortkeyGatewayUrl(baseUrl) ? DEFAULT_AI_GATEWAY_PROVIDER : undefined
}

export function resolvePortkeyGatewayHeaders(
  input: ResolvePortkeyGatewayHeadersInput,
): AiGatewayHeaders {
  const headers = input.headers ?? {}
  const baseUrl = input.baseUrl?.trim()

  if (!baseUrl || !isPortkeyGatewayUrl(baseUrl) || hasPortkeyRoutingHeader(headers)) {
    return headers
  }

  const provider = resolveGatewayProvider(input.provider, baseUrl)
  return {
    ...headers,
    [PORTKEY_PROVIDER_HEADER]: provider ?? DEFAULT_AI_GATEWAY_PROVIDER,
  }
}

export function resolveAiGatewayConfig(input: ResolveAiGatewayConfigInput = {}) {
  const env = input.env ?? getDefaultEnv()
  const baseUrl =
    normalizeOptionalString(input.baseUrl) ??
    readFirstEnv(env, input.baseUrlEnvKeys ?? AI_GATEWAY_BASE_URL_ENV_KEYS)
  const provider = resolveGatewayProvider(
    normalizeOptionalString(input.provider) ??
      readFirstEnv(env, input.providerEnvKeys ?? AI_GATEWAY_PROVIDER_ENV_KEYS),
    baseUrl,
  )

  return {
    provider,
    api_key:
      normalizeOptionalString(input.apiKey) ??
      readFirstEnv(env, input.apiKeyEnvKeys ?? AI_GATEWAY_API_KEY_ENV_KEYS),
    base_url: baseUrl,
    model:
      normalizeOptionalString(input.model) ??
      readFirstEnv(env, input.modelEnvKeys ?? AI_GATEWAY_MODEL_ENV_KEYS),
    headers: resolvePortkeyGatewayHeaders({
      baseUrl,
      headers: input.headers,
      provider,
    }),
  }
}
