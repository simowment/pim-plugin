/**
 * Single place where PIM plugin configuration is resolved.
 *
 * Precedence for every setting: plugin/module option -> environment variable
 * (backward-compatible fallback) -> documented default.
 *
 * Options reach this file in two ways:
 * - the PIM module service constructor stores the options Medusa passes to it
 *   (plugin options or `modules[].options`) through `setPimPluginOptions`;
 * - `resolvePimAiConfig(configModule)` can read them from a medusa-config object.
 */

export const PIM_PACKAGE_NAME = '@medusastore/medusa-plugin-pim'

export const DEFAULT_PIM_CHANNEL = 'storefront'
/** Channel name that is always treated as a generic fallback channel. */
export const GENERIC_PIM_CHANNEL = 'default'
export const DEFAULT_PIM_CHANNELS = ['storefront', 'default', 'google', 'meta']
export const DEFAULT_PIM_LOCALES = ['en-US', 'fr-FR', 'es-ES']
export const DEFAULT_PIM_LOCALE = 'en-US'

export interface PimAiOptions {
  /** `openrouter` | `openai` | `kilo` | `kilocode`. Env: PIM_AI_PROVIDER. */
  provider?: string
  /** Provider API key. Env: PIM_AI_API_KEY. */
  api_key?: string
  /** Must match the provider's built-in URL. Env: PIM_AI_BASE_URL. */
  base_url?: string
  /** Model identifier. Env: PIM_AI_MODEL. */
  model?: string
  /** Env: PIM_AI_TEMPERATURE. */
  temperature?: number
  /** Env: PIM_AI_MAX_TOKENS. */
  max_tokens?: number
  /** Env: PIM_AI_REQUEST_TIMEOUT_MS. */
  request_timeout_ms?: number
  /** Extra request headers. Env: PIM_AI_HEADERS_JSON (JSON object). */
  headers?: Record<string, string>
  /** Registered Medusa module name implementing the AI gateway contract. Env: PIM_AI_GATEWAY_MODULE. */
  gateway_module?: string
  /** Secret used to encrypt admin-saved API keys at rest. Env: PIM_AI_KEY_ENCRYPTION_KEY. */
  key_encryption_key?: string
}

export interface PimPluginOptions {
  /** Channel used when a request does not name one. Env: PIM_DEFAULT_CHANNEL. */
  default_channel?: string
  /** Channels offered in the admin UI and searched by the store batch route. */
  channels?: string[]
  /** Locales offered in the admin editor (canonical BCP 47 with region). */
  locales?: string[]
  /** Locale selected when the admin editor opens. Env: PIM_DEFAULT_LOCALE. */
  default_locale?: string
  /**
   * Channels whose published content is mirrored into Medusa's Translation Module.
   * Defaults to the default channel plus `default`.
   */
  translation_channels?: string[]
  /** AI generation settings. AI is only used on explicit admin requests and needs an API key. */
  ai?: PimAiOptions
}

let storedOptions: PimPluginOptions = {}

export function setPimPluginOptions(options: unknown): void {
  storedOptions = isRecord(options) ? (options as PimPluginOptions) : {}
}

export function getPimPluginOptions(): PimPluginOptions {
  return storedOptions
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function readEnv(name: string): string | undefined {
  const value = process.env[name]?.trim()
  return value ? value : undefined
}

function optionString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

function optionStringList(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined
  const list = value
    .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    .map((item) => item.trim())
  return list.length ? list : undefined
}

// ── Channels & locales ─────────────────────────────────────────────────────

export function resolveDefaultChannelOption(): string {
  return optionString(storedOptions.default_channel) ?? readEnv('PIM_DEFAULT_CHANNEL') ?? DEFAULT_PIM_CHANNEL
}

export function resolveChannelsOption(): string[] {
  return optionStringList(storedOptions.channels) ?? DEFAULT_PIM_CHANNELS
}

export function resolveTranslationChannelsOption(): string[] {
  return (
    optionStringList(storedOptions.translation_channels) ?? [
      resolveDefaultChannelOption(),
      GENERIC_PIM_CHANNEL,
    ]
  )
}

export function resolveLocalesOption(): string[] {
  return optionStringList(storedOptions.locales) ?? DEFAULT_PIM_LOCALES
}

export function resolveDefaultLocaleOption(): string {
  return optionString(storedOptions.default_locale) ?? readEnv('PIM_DEFAULT_LOCALE') ?? DEFAULT_PIM_LOCALE
}

// ── AI ─────────────────────────────────────────────────────────────────────

/** Raw (unvalidated) AI settings from env vars only. Numbers stay strings here. */
export interface PimAiEnvConfig {
  provider?: string
  api_key?: string
  base_url?: string
  model?: string
  temperature?: string
  max_tokens?: string
  request_timeout_ms?: string
  headers_json?: string
}

export function readAiEnv(): PimAiEnvConfig {
  return {
    provider: readEnv('PIM_AI_PROVIDER'),
    api_key: readEnv('PIM_AI_API_KEY'),
    base_url: readEnv('PIM_AI_BASE_URL'),
    model: readEnv('PIM_AI_MODEL'),
    temperature: process.env.PIM_AI_TEMPERATURE,
    max_tokens: process.env.PIM_AI_MAX_TOKENS,
    request_timeout_ms: process.env.PIM_AI_REQUEST_TIMEOUT_MS,
    headers_json: process.env.PIM_AI_HEADERS_JSON,
  }
}

/** AI options from the stored plugin options or from a medusa-config object. */
export function resolveAiOptions(configModule?: {
  modules?: Record<string, unknown>
  plugins?: unknown[]
}): Record<string, unknown> {
  const fromConfig = configModule ? findConfiguredOptions(configModule) : {}
  const configuredAi = isRecord(fromConfig.ai) ? fromConfig.ai : undefined
  const storedAi = isRecord(storedOptions.ai) ? (storedOptions.ai as Record<string, unknown>) : {}
  return configuredAi ?? storedAi
}

export function resolveAiGatewayModuleOption(): string | undefined {
  return optionString(storedOptions.ai?.gateway_module) ?? readEnv('PIM_AI_GATEWAY_MODULE')
}

export function resolveAiKeyEncryptionSecret(): string | undefined {
  return optionString(storedOptions.ai?.key_encryption_key) ?? readEnv('PIM_AI_KEY_ENCRYPTION_KEY')
}

function findConfiguredOptions(configModule: {
  modules?: Record<string, unknown>
  plugins?: unknown[]
}): Record<string, unknown> {
  const moduleDeclaration = configModule.modules?.pim
  if (isRecord(moduleDeclaration) && isRecord(moduleDeclaration.options)) {
    return moduleDeclaration.options
  }

  const plugin = configModule.plugins?.find(
    (entry) => isRecord(entry) && entry.resolve === PIM_PACKAGE_NAME,
  )
  if (isRecord(plugin) && isRecord(plugin.options)) {
    return plugin.options
  }
  return {}
}
