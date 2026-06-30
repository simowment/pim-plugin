import { z } from '@medusajs/framework/zod'
import { MedusaError } from '@medusajs/framework/utils'
import { createCipheriv, createDecipheriv, createHash, createSecretKey, randomBytes } from 'crypto'
import { getErrorMessage } from './error-messages'
import { PIM_MODULE } from '../modules/pim'

// ── Generic provider contract (matches any OpenAI-compatible gateway) ──────

/** Minimal contract returned by any shared AI gateway module. */
interface ProviderConfig {
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
const OPENAI_BASE_URL = 'https://api.openai.com/v1'
const OPENAI_MODEL = 'gpt-4o-mini'
export const KILO_BASE_URL = 'https://api.kilo.ai/api/gateway'
export const KILO_MODEL = 'kilo-auto/balanced'
const DEFAULT_AI_TEMPERATURE = 0.4
const DEFAULT_AI_MAX_TOKENS = 2400
const DEFAULT_AI_REQUEST_TIMEOUT_MS = 30000
const PIM_AI_SETTING_KEY = 'default'
const ENCRYPTED_SECRET_PREFIX = 'enc:v1'
const ENCRYPTED_SECRET_SEPARATOR = ':'
const ENCRYPTED_SECRET_PARTS = 5
const ENCRYPTION_ALGORITHM = 'aes-256-gcm'
const ENCRYPTION_IV_BYTES = 12
const ENCRYPTION_AUTH_TAG_BYTES = 16

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

export interface PimAiConfig extends z.infer<typeof AiConfigSchema> {}

export interface PimAiSettingsResponse {
  provider: string
  model: string
  base_url: string
  temperature: number
  max_tokens: number
  request_timeout_ms: number
  has_api_key: boolean
  api_key_preview: string
  can_update: boolean
  source: 'gateway' | 'pim_settings' | 'environment'
}

export interface PimAiProviderConfigSnapshot extends Partial<ProviderConfig> {
  provider: string
  base_url: string
  model: string
}

// ── Generic service interface (any module can implement this) ──────────────

interface AiGatewayService {
  getProviderConfig: () => Promise<ProviderConfig>
  setProviderConfig: (config: Partial<ProviderConfig>) => Promise<ProviderConfig>
}

interface ConfigModule {
  modules?: Record<string, unknown>
  plugins?: unknown[]
}

interface AiConfigInput {
  provider?: unknown
  api_key?: unknown
  base_url?: unknown
  model?: unknown
  temperature?: unknown
  max_tokens?: unknown
  request_timeout_ms?: unknown
  headers?: unknown
}

interface PimAiSettingRecord {
  id: string
  key: string
  provider: string
  encrypted_api_key?: string | null
  base_url: string
  model: string
  headers_json?: Record<string, string> | null
}

interface PimAiSettingsStore {
  listAndCountPimAiSettings: (
    filters: Record<string, unknown>,
    config?: Record<string, unknown>,
  ) => Promise<[PimAiSettingRecord[], number]>
  createPimAiSettings: (input: Record<string, unknown>) => Promise<PimAiSettingRecord>
  updatePimAiSettings: (input: Record<string, unknown>) => Promise<PimAiSettingRecord>
}

// ── Helpers ────────────────────────────────────────────────────────────────

function parseNumber(value: string | undefined): number | undefined {
  if (!value) return undefined
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, `Invalid numeric PIM AI config value: ${value}`)
  }
  return parsed
}

function parseHeaders(value: string | undefined): Record<string, string> | undefined {
  if (!value) return undefined
  return AiHeadersSchema.parse(JSON.parse(value))
}

function readOptionalEnv(name: string): string | undefined {
  const value = process.env[name]?.trim()
  return value ? value : undefined
}

function normalizeProviderName(provider: unknown): string {
  return typeof provider === 'string' ? provider.trim().toLowerCase() : ''
}

function resolveEnvAiConfig(): AiConfigInput {
  return {
    provider: readOptionalEnv('PIM_AI_PROVIDER'),
    api_key: readOptionalEnv('PIM_AI_API_KEY'),
    base_url: readOptionalEnv('PIM_AI_BASE_URL'),
    model: readOptionalEnv('PIM_AI_MODEL'),
    headers: parseHeaders(process.env.PIM_AI_HEADERS_JSON),
  }
}

function resolveEncryptionKey() {
  const secret = process.env.PIM_AI_KEY_ENCRYPTION_KEY?.trim()
  if (!secret) return null
  return createSecretKey(Uint8Array.from(createHash('sha256').update(secret).digest()))
}

function encryptApiKey(apiKey: string): string {
  const key = resolveEncryptionKey()
  if (!key) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      'PIM_AI_KEY_ENCRYPTION_KEY is required before storing PIM AI API keys in the database.',
    )
  }

  const iv = randomBytes(ENCRYPTION_IV_BYTES)
  const cipher = createCipheriv(ENCRYPTION_ALGORITHM, key, Uint8Array.from(iv), {
    authTagLength: ENCRYPTION_AUTH_TAG_BYTES,
  })
  const encrypted = cipher.update(apiKey, 'utf8', 'base64') + cipher.final('base64')
  const tag = cipher.getAuthTag()

  return [
    ENCRYPTED_SECRET_PREFIX,
    iv.toString('base64'),
    tag.toString('base64'),
    encrypted,
  ].join(ENCRYPTED_SECRET_SEPARATOR)
}

function decryptApiKey(storedValue?: string | null): string | undefined {
  if (!storedValue) return undefined
  if (!storedValue.startsWith(`${ENCRYPTED_SECRET_PREFIX}${ENCRYPTED_SECRET_SEPARATOR}`)) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      'Persisted PIM AI API key is not encrypted. Re-save the PIM AI settings before using AI generation.',
    )
  }

  const key = resolveEncryptionKey()
  if (!key) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      'PIM_AI_KEY_ENCRYPTION_KEY is required to read persisted PIM AI settings.',
    )
  }

  const parts = storedValue.split(ENCRYPTED_SECRET_SEPARATOR)
  if (parts.length !== ENCRYPTED_SECRET_PARTS || parts.some((part) => !part)) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      'Persisted PIM AI API key is not a valid encrypted secret.',
    )
  }

  const [, , ivValue, tagValue, encryptedValue] = parts
  const decipher = createDecipheriv(
    ENCRYPTION_ALGORITHM,
    key,
    Uint8Array.from(Buffer.from(ivValue, 'base64')),
    {
      authTagLength: ENCRYPTION_AUTH_TAG_BYTES,
    },
  )
  decipher.setAuthTag(Uint8Array.from(Buffer.from(tagValue, 'base64')))
  try {
    return decipher.update(encryptedValue, 'base64', 'utf8') + decipher.final('utf8')
  } catch (error) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      `Persisted PIM AI API key could not be decrypted: ${getErrorMessage(error)}. Re-save the PIM AI settings with a new API key.`,
    )
  }
}

function defaultBaseUrlForProvider(provider: unknown): string {
  const normalized = normalizeProviderName(provider)
  if (normalized === 'openai') return OPENAI_BASE_URL
  if (normalized === 'kilo' || normalized === 'kilocode') return KILO_BASE_URL
  return DEFAULT_AI_BASE_URL
}

function defaultModelForProvider(provider: unknown): string {
  const normalized = normalizeProviderName(provider)
  if (normalized === 'openai') return OPENAI_MODEL
  if (normalized === 'kilo' || normalized === 'kilocode') return KILO_MODEL
  return DEFAULT_AI_MODEL
}

function assertKnownProviderBaseUrl(provider: string, baseUrl: string): void {
  const normalized = normalizeProviderName(provider)
  const allowedProvider =
    normalized === 'openrouter' ||
    normalized === 'openai' ||
    normalized === 'kilo' ||
    normalized === 'kilocode'

  if (!allowedProvider) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      `Unsupported PIM AI provider "${provider}". Use openrouter, openai, or kilo.`,
    )
  }

  const expectedBaseUrl = defaultBaseUrlForProvider(provider)
  if (baseUrl !== expectedBaseUrl) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      `PIM AI base_url for provider "${provider}" must be ${expectedBaseUrl}. Custom AI base URLs are disabled to avoid leaking API keys to untrusted hosts.`,
    )
  }
}

function normalizeAiConfig(input: AiConfigInput): PimAiConfig {
  const provider =
    typeof input.provider === 'string' && input.provider.trim()
      ? input.provider.trim()
      : DEFAULT_AI_PROVIDER
  const baseUrl =
    typeof input.base_url === 'string' && input.base_url.trim()
      ? input.base_url.trim()
      : defaultBaseUrlForProvider(provider)
  const model =
    typeof input.model === 'string' && input.model.trim()
      ? input.model.trim()
      : defaultModelForProvider(provider)
  assertKnownProviderBaseUrl(provider, baseUrl)
  const headers = AiHeadersSchema.parse(input.headers ?? {})

  return AiConfigSchema.parse({
    ...input,
    provider,
    base_url: baseUrl,
    model,
    headers,
  })
}

function resolveAiGatewayModuleNames(): string[] {
  const configuredName = readOptionalEnv('PIM_AI_GATEWAY_MODULE')
  return configuredName ? [configuredName] : []
}

function findConfiguredOptions(configModule: ConfigModule): Record<string, unknown> {
  const moduleDeclaration = configModule.modules?.pim
  const moduleOptions =
    typeof moduleDeclaration === 'object' &&
    moduleDeclaration !== null &&
    'options' in moduleDeclaration
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
  const envAi = resolveEnvAiConfig()

  return normalizeAiConfig({
    provider: envAi.provider,
    api_key: envAi.api_key,
    base_url: envAi.base_url,
    model: envAi.model,
    temperature: parseNumber(process.env.PIM_AI_TEMPERATURE),
    max_tokens: parseNumber(process.env.PIM_AI_MAX_TOKENS),
    request_timeout_ms: parseNumber(process.env.PIM_AI_REQUEST_TIMEOUT_MS),
    headers: envAi.headers,
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
    const envAi = resolveEnvAiConfig()
    const persistedSettings = await resolvePersistedPimAiSettings(container)
    if (!persistedSettings) {
      return resolvePimAiConfig({})
    }

    return normalizeAiConfig({
      provider: persistedSettings.provider,
      api_key: decryptApiKey(persistedSettings.encrypted_api_key),
      base_url: persistedSettings.base_url,
      model: persistedSettings.model,
      temperature: parseNumber(process.env.PIM_AI_TEMPERATURE),
      max_tokens: parseNumber(process.env.PIM_AI_MAX_TOKENS),
      request_timeout_ms: parseNumber(process.env.PIM_AI_REQUEST_TIMEOUT_MS),
      headers: {
        ...AiHeadersSchema.parse(envAi.headers ?? {}),
        ...(persistedSettings.headers_json ?? {}),
        ...parseHeaders(process.env.PIM_AI_HEADERS_JSON),
      },
    })
  }

  const providerConfig = await gateway.getProviderConfig()

  // Gateway headers (e.g. Portkey routing) merged with PIM-specific header overrides
  const mergedHeaders = {
    ...providerConfig.headers,
    ...parseHeaders(process.env.PIM_AI_HEADERS_JSON),
  }

  return normalizeAiConfig({
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
  if (gateway) {
    const current = await gateway.getProviderConfig()
    const provider = config.provider ?? current.provider
    const normalized = normalizeAiConfig({
      provider,
      api_key: config.api_key ?? current.api_key,
      base_url: config.base_url ?? current.base_url,
      model: config.model ?? current.model,
      headers: config.headers ?? current.headers ?? {},
    })
    const nextConfig: Partial<ProviderConfig> = {
      provider: normalized.provider,
      base_url: normalized.base_url,
      model: normalized.model,
      headers: normalized.headers,
    }

    if (typeof config.api_key === 'string') {
      nextConfig.api_key = normalized.api_key
    }

    await gateway.setProviderConfig(nextConfig)
    return getPimAiSettings(container)
  }

  await upsertPersistedPimAiSettings(container, config)
  return getPimAiSettings(container)
}

export async function getPimAiProviderConfigSnapshot(container: {
  resolve: <T = unknown>(key: string, options?: Record<string, unknown>) => T
}, options: { includeApiKey?: boolean } = {}): Promise<PimAiProviderConfigSnapshot | null> {
  const includeApiKey = options.includeApiKey ?? true
  const gateway = resolveOptionalAiGateway(container)
  if (gateway) {
    const current = await gateway.getProviderConfig()

    return {
      provider: current.provider,
      api_key: includeApiKey ? current.api_key : undefined,
      base_url: current.base_url,
      model: current.model,
      headers: current.headers,
    }
  }

  const persistedSettings = await resolvePersistedPimAiSettings(container)
  if (!persistedSettings) {
    return null
  }

  return {
    provider: persistedSettings.provider,
    api_key: includeApiKey ? decryptApiKey(persistedSettings.encrypted_api_key) : undefined,
    base_url: persistedSettings.base_url,
    model: persistedSettings.model,
    headers: persistedSettings.headers_json ?? {},
  }
}

export async function getPimAiSettings(container: {
  resolve: <T = unknown>(key: string, options?: Record<string, unknown>) => T
}): Promise<PimAiSettingsResponse> {
  const hasGateway = Boolean(resolveOptionalAiGateway(container))
  const persistedSettings = hasGateway ? null : await resolvePersistedPimAiSettings(container)
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
    can_update: true,
    source: hasGateway ? 'gateway' : persistedSettings ? 'pim_settings' : 'environment',
  }
}

async function resolvePersistedPimAiSettings(container: {
  resolve: <T = unknown>(key: string, options?: Record<string, unknown>) => T
}): Promise<PimAiSettingRecord | null> {
  const pim = resolvePimAiSettingsStore(container)
  if (!pim) {
    return null
  }

  const [settings] = await pim.listAndCountPimAiSettings({ key: PIM_AI_SETTING_KEY }, { take: 1 })

  return settings[0] ?? null
}

async function upsertPersistedPimAiSettings(
  container: { resolve: <T = unknown>(key: string, options?: Record<string, unknown>) => T },
  config: Partial<ProviderConfig>,
): Promise<PimAiSettingRecord> {
  const pim = resolvePimAiSettingsStore(container)
  if (!pim) {
    throw new MedusaError(
      MedusaError.Types.NOT_ALLOWED,
      'Runtime AI settings are not available because the PIM module is not registered.',
    )
  }

  const existing = await resolvePersistedPimAiSettings(container)
  const replacingApiKey = typeof config.api_key === 'string'
  const fallbackConfig = existing
    ? normalizeAiConfig({
        provider: existing.provider,
        api_key: replacingApiKey ? config.api_key : decryptApiKey(existing.encrypted_api_key),
        base_url: existing.base_url,
        model: existing.model,
        headers: existing.headers_json ?? {},
      })
    : resolvePimAiConfig({})
  const selectedProvider = config.provider ?? fallbackConfig.provider
  const submittedApiKey = replacingApiKey ? config.api_key : undefined
  const normalized = normalizeAiConfig({
    provider: selectedProvider,
    api_key: submittedApiKey ?? decryptApiKey(existing?.encrypted_api_key),
    base_url: config.base_url ?? fallbackConfig.base_url,
    model: config.model ?? fallbackConfig.model,
    headers: config.headers ?? existing?.headers_json ?? {},
  })
  const payload = {
    key: PIM_AI_SETTING_KEY,
    provider: normalized.provider,
    encrypted_api_key: submittedApiKey
      ? encryptApiKey(submittedApiKey)
      : (existing?.encrypted_api_key ?? null),
    base_url: normalized.base_url,
    model: normalized.model,
    headers_json: normalized.headers,
  }

  if (existing) {
    return pim.updatePimAiSettings({
      id: existing.id,
      ...payload,
    })
  }

  return pim.createPimAiSettings(payload)
}

function resolvePimAiSettingsStore(container: {
  resolve: <T = unknown>(key: string, options?: Record<string, unknown>) => T
}): PimAiSettingsStore | null {
  try {
    return container.resolve<PimAiSettingsStore>(PIM_MODULE, {
      allowUnregistered: true,
    })
  } catch {
    return null
  }
}

function resolveOptionalAiGateway(container: {
  resolve: <T = unknown>(key: string, options?: Record<string, unknown>) => T
}): AiGatewayService | null {
  for (const moduleName of resolveAiGatewayModuleNames()) {
    try {
      const gateway = container.resolve<AiGatewayService>(moduleName, {
        allowUnregistered: true,
      })

      if (gateway) {
        return gateway
      }
    } catch (error) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        `Configured PIM AI gateway module "${moduleName}" could not be resolved: ${getErrorMessage(error)}`,
      )
    }
  }

  return null
}

function maskApiKey(key: string): string {
  if (!key) return ''
  if (key.length <= 8) return '••••••••'
  return `${key.slice(0, 4)}••••••••${key.slice(-4)}`
}
