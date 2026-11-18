import { z } from '@medusajs/framework/zod'
import { PIM_MODULE } from '../modules/pim'
import { readAiEnv, resolveAiOptions } from './config'

/**
 * Settings saved on Product content > Settings (table `pim_setting`, one row per key).
 *
 * Precedence for each value: saved here -> plugin `ai` option -> PIM_AI_* environment
 * variable -> built-in default. Secrets are never stored here.
 */

export const DEFAULT_AI_TEMPERATURE = 0.4
export const DEFAULT_AI_MAX_TOKENS = 8192
export const DEFAULT_AI_REQUEST_TIMEOUT_MS = 120000

export const PimEditableSettingsSchema = z.object({
  /** How freely the AI writes: 0 = predictable, 2 = most varied. */
  temperature: z.number().min(0).max(2).nullable().optional(),
  /** Longest AI answer, in tokens. */
  max_tokens: z.number().int().min(256).max(200000).nullable().optional(),
  /** How long one AI request may run before it is stopped, in milliseconds. */
  request_timeout_ms: z.number().int().min(5000).max(600000).nullable().optional(),
})
export type PimEditableSettingsInput = z.infer<typeof PimEditableSettingsSchema>

export type PimEditableKey = 'temperature' | 'max_tokens' | 'request_timeout_ms'
export const PIM_EDITABLE_KEYS: PimEditableKey[] = ['temperature', 'max_tokens', 'request_timeout_ms']

const STORAGE_KEY: Record<PimEditableKey, string> = {
  temperature: 'ai.temperature',
  max_tokens: 'ai.max_tokens',
  request_timeout_ms: 'ai.request_timeout_ms',
}

const ENV_NAME: Record<PimEditableKey, string> = {
  temperature: 'PIM_AI_TEMPERATURE',
  max_tokens: 'PIM_AI_MAX_TOKENS',
  request_timeout_ms: 'PIM_AI_REQUEST_TIMEOUT_MS',
}

const BUILT_IN: Record<PimEditableKey, number> = {
  temperature: DEFAULT_AI_TEMPERATURE,
  max_tokens: DEFAULT_AI_MAX_TOKENS,
  request_timeout_ms: DEFAULT_AI_REQUEST_TIMEOUT_MS,
}

export type PimStoredSettings = Partial<Record<PimEditableKey, number>>

interface PimSettingRecord {
  id: string
  key: string
  value: unknown
}

interface PimSettingsStore {
  listPimSettings: (filters: Record<string, unknown>, config?: Record<string, unknown>) => Promise<PimSettingRecord[]>
  createPimSettings: (input: Record<string, unknown>) => Promise<PimSettingRecord>
  updatePimSettings: (input: Record<string, unknown>) => Promise<PimSettingRecord>
  deletePimSettings: (ids: string[]) => Promise<void>
}

type Container = { resolve: <T = unknown>(key: string, options?: Record<string, unknown>) => T }

const CACHE_TTL_MS = 30_000
let cache: { at: number; value: PimStoredSettings } | null = null

function store(container: Container): PimSettingsStore | null {
  try {
    const service = container.resolve<Partial<PimSettingsStore>>(PIM_MODULE, { allowUnregistered: true })
    return service && typeof service.listPimSettings === 'function' ? (service as PimSettingsStore) : null
  } catch {
    return null
  }
}

function toNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim() && Number.isFinite(Number(value))) return Number(value)
  return undefined
}

/** Values saved on the settings page (cached for 30 seconds; a save clears the cache). */
export async function readStoredPimSettings(container: Container): Promise<PimStoredSettings> {
  if (cache && Date.now() - cache.at < CACHE_TTL_MS) return cache.value
  const pim = store(container)
  const value: PimStoredSettings = {}
  if (pim) {
    try {
      const rows = await pim.listPimSettings({ key: Object.values(STORAGE_KEY) })
      for (const key of PIM_EDITABLE_KEYS) {
        const row = rows.find((item) => item.key === STORAGE_KEY[key])
        const parsed = toNumber(row?.value)
        if (parsed !== undefined) value[key] = parsed
      }
    } catch {
      // Table missing (migration not run yet): fall back to the host values.
      return {}
    }
  }
  cache = { at: Date.now(), value }
  return value
}

export function clearPimSettingsCache(): void {
  cache = null
}

/** Writes the given keys; null removes the saved value (back to the host value or default). */
export async function writeStoredPimSettings(
  container: Container,
  input: PimEditableSettingsInput,
): Promise<PimStoredSettings> {
  const pim = store(container)
  if (!pim) throw new Error('The PIM module is not registered, so settings cannot be saved.')
  const keys = PIM_EDITABLE_KEYS.filter((key) => input[key] !== undefined)
  const rows = await pim.listPimSettings({ key: keys.map((key) => STORAGE_KEY[key]) })
  for (const key of keys) {
    const existing = rows.find((row) => row.key === STORAGE_KEY[key])
    const next = input[key]
    if (next === null) {
      if (existing) await pim.deletePimSettings([existing.id])
    } else if (existing) {
      await pim.updatePimSettings({ id: existing.id, value: next })
    } else {
      await pim.createPimSettings({ key: STORAGE_KEY[key], value: next })
    }
  }
  clearPimSettingsCache()
  return readStoredPimSettings(container)
}

export type SettingSource = 'admin' | 'host' | 'default'

/** Value from the plugin option or the environment (what applies when nothing is saved). */
function hostValue(key: PimEditableKey): number | undefined {
  const options = resolveAiOptions()
  const fromOption = toNumber(options[key])
  if (fromOption !== undefined) return fromOption
  const env = readAiEnv()
  return toNumber(env[key])
}

/** Generation parameters with the saved values on top. */
export async function resolveGenerationParamsWithStored(
  container: Container,
): Promise<Record<PimEditableKey, number | undefined>> {
  const stored = await readStoredPimSettings(container)
  return {
    temperature: stored.temperature ?? hostValue('temperature'),
    max_tokens: stored.max_tokens ?? hostValue('max_tokens'),
    request_timeout_ms: stored.request_timeout_ms ?? hostValue('request_timeout_ms'),
  }
}

export interface EditableSettingView {
  value: number
  source: SettingSource
  /** What applies when the saved value is removed. */
  fallback: number
  fallback_source: Exclude<SettingSource, 'admin'>
  variable: string
}

export async function describeEditableSettings(
  container: Container,
): Promise<Record<PimEditableKey, EditableSettingView>> {
  const stored = await readStoredPimSettings(container)
  const result = {} as Record<PimEditableKey, EditableSettingView>
  for (const key of PIM_EDITABLE_KEYS) {
    const host = hostValue(key)
    const fallback = host ?? BUILT_IN[key]
    const fallbackSource = host !== undefined ? 'host' : 'default'
    result[key] = {
      value: stored[key] ?? fallback,
      source: stored[key] !== undefined ? 'admin' : fallbackSource,
      fallback,
      fallback_source: fallbackSource,
      variable: ENV_NAME[key],
    }
  }
  return result
}
