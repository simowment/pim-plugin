import { z } from '@medusajs/framework/zod'
import { MedusaError } from '@medusajs/framework/utils'
import { createCipheriv, createDecipheriv, createHash, createSecretKey, randomBytes } from 'crypto'
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
const KILO_BASE_URL = 'https://api.kilo.ai/api/gateway'
const KILO_MODEL = 'kilo/kilo-auto/free'
const DEFAULT_AI_TEMPERATURE = 0.4
const DEFAULT_AI_MAX_TOKENS = 1200
const DEFAULT_AI_REQUEST_TIMEOUT_MS = 30000
const DEFAULT_AI_GATEWAY_MODULE_NAMES = ['pimAi', 'aiGateway']
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
  return Number.isFinite(parsed) ? parsed : undefined
}

function parseHeaders(value: string | undefined): Record<string, string> | undefined {
  if (!value) return undefined
  return AiHeadersSchema.parse(JSON.parse(value))
}

function readOptionalEnv(name: string): string | undefined {
  const value = process.env[name]?.trim()
  return value ? value : undefined
}

function resolveEnvApiKey(): string | undefined {
  return readOptionalEnv('PIM_AI_API_KEY')
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
  return decipher.update(encryptedValue, 'base64', 'utf8') + decipher.final('utf8')
}

function defaultBaseUrlForProvider(provider: unknown): string {
  const normalized = typeof provider === 'string' ? provider.trim().toLowerCase() : ''
  if (normalized === 'openai') return OPENAI_BASE_URL
  if (normalized === 'kilo' || normalized === 'kilocode') return KILO_BASE_URL
  return DEFAULT_AI_BASE_URL
}

function defaultModelForProvider(provider: unknown): string {
  const normalized = typeof provider === 'string' ? provider.trim().toLowerCase() : ''
  if (normalized === 'openai') return OPENAI_MODEL
  if (normalized === 'kilo' || normalized === 'kilocode') return KILO_MODEL
  return DEFAULT_AI_MODEL
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

  return AiConfigSchema.parse({
    ...input,
    provider,
    base_url: baseUrl,
    model,
  })
}

function resolveAiGatewayModuleNames(): string[] {
  const configuredName = readOptionalEnv('PIM_AI_GATEWAY_MODULE')
  return configuredName
    ? [configuredName, ...DEFAULT_AI_GATEWAY_MODULE_NAMES.filter((name) => name !== configuredName)]
    : DEFAULT_AI_GATEWAY_MODULE_NAMES
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

  return normalizeAiConfig({
    provider: readOptionalEnv('PIM_AI_PROVIDER'),
    api_key: resolveEnvApiKey(),
    base_url: readOptionalEnv('PIM_AI_BASE_URL'),
    model: readOptionalEnv('PIM_AI_MODEL'),
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
    const persistedSettings = await resolvePersistedPimAiSettings(container)
    if (!persistedSettings) {
      return resolvePimAiConfig({})
    }

    return normalizeAiConfig({
      provider: persistedSettings.provider,
      api_key: decryptApiKey(persistedSettings.encrypted_api_key) ?? resolveEnvApiKey(),
      base_url: persistedSettings.base_url,
      model: persistedSettings.model,
      temperature: parseNumber(process.env.PIM_AI_TEMPERATURE),
      max_tokens: parseNumber(process.env.PIM_AI_MAX_TOKENS),
      request_timeout_ms: parseNumber(process.env.PIM_AI_REQUEST_TIMEOUT_MS),
      headers: {
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
    const normalized = normalizeAiConfig(config)
    await gateway.setProviderConfig({
      provider: normalized.provider,
      api_key: normalized.api_key,
      base_url: normalized.base_url,
      model: normalized.model,
      headers: normalized.headers,
    })
    return getPimAiSettings(container)
  }

  await upsertPersistedPimAiSettings(container, config)
  return getPimAiSettings(container)
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
  const fallbackConfig = existing
    ? normalizeAiConfig({
        provider: existing.provider,
        api_key: decryptApiKey(existing.encrypted_api_key) ?? resolveEnvApiKey(),
        base_url: existing.base_url,
        model: existing.model,
        headers: existing.headers_json ?? {},
      })
    : resolvePimAiConfig({})
  const normalized = normalizeAiConfig({
    provider: config.provider ?? fallbackConfig.provider,
    api_key: config.api_key ?? decryptApiKey(existing?.encrypted_api_key) ?? undefined,
    base_url: config.base_url ?? fallbackConfig.base_url,
    model: config.model ?? fallbackConfig.model,
    headers: config.headers ?? existing?.headers_json ?? {},
  })
  const payload = {
    key: PIM_AI_SETTING_KEY,
    provider: normalized.provider,
    encrypted_api_key: normalized.api_key
      ? encryptApiKey(normalized.api_key)
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
