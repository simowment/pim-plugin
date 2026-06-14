import { z } from '@medusajs/framework/zod'
import { MedusaError } from '@medusajs/framework/utils'

// ── Generic provider contract (matches any OpenAI-compatible gateway) ──────

/** Minimal contract returned by any shared AI gateway module. */
type ProviderConfig = {
  provider: string
  api_key: string
  base_url: string
  model: string
  headers?: Record<string, string>
}

// ── PIM-specific config (extends generic provider with generation params) ──

const DEFAULT_AI_PROVIDER = 'openrouter'
const DEFAULT_AI_BASE_URL = 'https://openrouter.ai/api/v1'
const DEFAULT_AI_MODEL = 'openai/gpt-4o-mini'
const DEFAULT_AI_TEMPERATURE = 0.4
const DEFAULT_AI_MAX_TOKENS = 1200
const DEFAULT_AI_REQUEST_TIMEOUT_MS = 30000
const DEFAULT_AI_GATEWAY_MODULE_NAMES = ['pimAi', 'aiGateway']

const AiHeadersSchema = z.record(z.string(), z.string())

const AiConfigSchema = z.object({
  provider: z.string().min(1).default(DEFAULT_AI_PROVIDER),
  api_key: z.string().min(1).optional(),
  base_url: z.string().url().default(DEFAULT_AI_BASE_URL),
  model: z.string().min(1).default(DEFAULT_AI_MODEL),
  temperature: z.number().min(0).max(2).default(DEFAULT_AI_TEMPERATURE),
  max_tokens: z.number().int().positive().default(DEFAULT_AI_MAX_TOKENS),
  request_timeout_ms: z.number().int().positive().default(DEFAULT_AI_REQUEST_TIMEOUT_MS),
  headers: AiHeadersSchema.default({}),
})

export type PimAiConfig = z.infer<typeof AiConfigSchema>

export type PimAiSettingsResponse = {
  provider: string
  model: string
  base_url: string
  temperature: number
  max_tokens: number
  request_timeout_ms: number
  has_api_key: boolean
  api_key_preview: string
  can_update: boolean
  source: 'gateway' | 'environment'
}

// ── Generic service interface (any module can implement this) ──────────────

type AiGatewayService = {
  getProviderConfig: () => Promise<ProviderConfig>
  setProviderConfig: (config: Partial<ProviderConfig>) => Promise<ProviderConfig>
}

type ConfigModule = {
  modules?: Record<string, unknown>
  plugins?: unknown[]
}

type ContainerLike = {
  resolve: <T = unknown>(key: string, options?: Record<string, unknown>) => T
}

// ── Helpers ────────────────────────────────────────────────────────────────

function parseNumber(value: string | undefined): number | undefined {
  if (!value) return undefined
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : undefined
}

function parseHeaders(value: string | undefined): Record<string, string> | undefined {
  if (!value) return undefined
  return AiHeadersSchema.parse(JSON.parse(value))
}

function resolveEnvApiKey(): string | undefined {
  return process.env.PIM_AI_API_KEY ?? process.env.OPENROUTER_API_KEY ?? process.env.KILOCODE_API_KEY
}

function resolveAiGatewayModuleNames(): string[] {
  const configuredName = process.env.PIM_AI_GATEWAY_MODULE?.trim()
  return configuredName
    ? [configuredName, ...DEFAULT_AI_GATEWAY_MODULE_NAMES.filter((name) => name !== configuredName)]
    : DEFAULT_AI_GATEWAY_MODULE_NAMES
}

function findConfiguredOptions(configModule: ConfigModule): Record<string, unknown> {
  const moduleDeclaration = configModule.modules?.pim
  const moduleOptions =
    typeof moduleDeclaration === 'object' && moduleDeclaration !== null && 'options' in moduleDeclaration
      ? moduleDeclaration.options
      : undefined
  if (typeof moduleOptions === 'object' && moduleOptions !== null) {
    return moduleOptions as Record<string, unknown>
  }

  const plugin = configModule.plugins?.find(
    (entry) =>
      typeof entry === 'object' &&
      entry !== null &&
      'resolve' in entry &&
      entry.resolve === '@medusastore/medusa-plugin-pim',
  )
  if (typeof plugin === 'object' && plugin !== null && 'options' in plugin) {
    const pluginOptions = plugin.options
    if (typeof pluginOptions === 'object' && pluginOptions !== null) {
      return pluginOptions as Record<string, unknown>
    }
  }
  return {}
}

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * Resolve AI config from static medusa-config module options + env vars.
 * Used at build/config time, not at runtime.
 */
export function resolvePimAiConfig(configModule: ConfigModule): PimAiConfig {
  const configuredOptions = findConfiguredOptions(configModule)
  const configuredAi =
    typeof configuredOptions.ai === 'object' && configuredOptions.ai !== null
      ? configuredOptions.ai
      : {}

  return AiConfigSchema.parse({
    provider: process.env.PIM_AI_PROVIDER,
    api_key: resolveEnvApiKey(),
    base_url: process.env.PIM_AI_BASE_URL ?? process.env.AI_GATEWAY_URL,
    model: process.env.PIM_AI_MODEL ?? process.env.AI_MODEL,
    temperature: parseNumber(process.env.PIM_AI_TEMPERATURE),
    max_tokens: parseNumber(process.env.PIM_AI_MAX_TOKENS),
    request_timeout_ms: parseNumber(process.env.PIM_AI_REQUEST_TIMEOUT_MS),
    headers: parseHeaders(process.env.PIM_AI_HEADERS_JSON),
    ...configuredAi,
  })
}

/**
 * Resolve AI config from the shared gateway module at runtime.
 * Gateway provides provider/key/url/headers; PIM env vars override generation params.
 */
export async function resolvePimAiConfigFromContainer(container: {
  resolve: <T = unknown>(key: string, options?: Record<string, unknown>) => T
}): Promise<PimAiConfig> {
  const gateway = resolveOptionalAiGateway(container)
  if (!gateway) {
    return resolvePimAiConfig({})
  }

  const providerConfig = await gateway.getProviderConfig()

  // Gateway headers (e.g. Portkey routing) merged with PIM-specific header overrides
  const mergedHeaders = {
    ...providerConfig.headers,
    ...parseHeaders(process.env.PIM_AI_HEADERS_JSON),
  }

  return AiConfigSchema.parse({
    provider: providerConfig.provider,
    api_key: providerConfig.api_key,
    base_url: providerConfig.base_url,
    model: providerConfig.model,
    temperature: parseNumber(process.env.PIM_AI_TEMPERATURE),
    max_tokens: parseNumber(process.env.PIM_AI_MAX_TOKENS),
    request_timeout_ms: parseNumber(process.env.PIM_AI_REQUEST_TIMEOUT_MS),
    headers: mergedHeaders,
  })
}

export async function updatePimAiProviderConfig(
  container: { resolve: <T = unknown>(key: string, options?: Record<string, unknown>) => T },
  config: Partial<ProviderConfig>,
): Promise<PimAiSettingsResponse> {
  const gateway = resolveOptionalAiGateway(container)
  if (!gateway) {
    throw new MedusaError(
      MedusaError.Types.NOT_ALLOWED,
      'Runtime AI settings are not available. Configure PIM_AI_* environment variables or register an AI gateway service.',
    )
  }

  await gateway.setProviderConfig(config)
  return getPimAiSettings(container)
}

export async function getPimAiSettings(container: {
  resolve: <T = unknown>(key: string, options?: Record<string, unknown>) => T
}): Promise<PimAiSettingsResponse> {
  const hasGateway = Boolean(resolveOptionalAiGateway(container))
  const config = await resolvePimAiConfigFromContainer(container)

  return {
    provider: config.provider,
    model: config.model,
    base_url: config.base_url,
    temperature: config.temperature,
    max_tokens: config.max_tokens,
    request_timeout_ms: config.request_timeout_ms,
    has_api_key: Boolean(config.api_key),
    api_key_preview: maskApiKey(config.api_key ?? ''),
    can_update: hasGateway,
    source: hasGateway ? 'gateway' : 'environment',
  }
}

function resolveOptionalAiGateway(container: ContainerLike): AiGatewayService | null {
  for (const moduleName of resolveAiGatewayModuleNames()) {
    try {
      const gateway = container.resolve<AiGatewayService>(moduleName, {
        allowUnregistered: true,
      })

      if (gateway) {
        return gateway
      }
    } catch {
      // Try the next optional gateway module name.
    }
  }

  return null
}

function maskApiKey(key: string): string {
  if (!key) return ''
  if (key.length <= 8) return '••••••••'
  return `${key.slice(0, 4)}••••••••${key.slice(-4)}`
}
