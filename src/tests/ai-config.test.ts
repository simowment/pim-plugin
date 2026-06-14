import { afterEach, describe, expect, it } from 'vitest'
import {
  getPimAiSettings,
  resolvePimAiConfigFromContainer,
  updatePimAiProviderConfig,
} from '../lib/ai-config'
import { PIM_MODULE } from '../modules/pim'

type PimAiSettingRecord = {
  id: string
  key: string
  provider: string
  encrypted_api_key: string | null
  base_url: string
  model: string
  headers_json: Record<string, string> | null
}

const ENCRYPTION_KEY = 'test-pim-ai-key-encryption-secret'
const SECRET_API_KEY = 'sk-test-secret-value'

function createContainer() {
  const settings: PimAiSettingRecord[] = []

  const store = {
    settings,
    async listAndCountPimAiSettings() {
      return [settings, settings.length] as [PimAiSettingRecord[], number]
    },
    async createPimAiSettings(input: Record<string, unknown>) {
      const record = {
        id: 'pim_ai_setting_1',
        key: String(input.key),
        provider: String(input.provider),
        encrypted_api_key: input.encrypted_api_key as string | null,
        base_url: String(input.base_url),
        model: String(input.model),
        headers_json: input.headers_json as Record<string, string> | null,
      }
      settings.push(record)
      return record
    },
    async updatePimAiSettings(input: Record<string, unknown>) {
      const record = settings.find((setting) => setting.id === input.id)
      if (!record) throw new Error('Missing setting')
      Object.assign(record, input)
      return record
    },
  }

  return {
    store,
    container: {
      resolve<T = unknown>(key: string) {
        if (key === PIM_MODULE) return store as T
        throw new Error(`Unregistered module: ${key}`)
      },
    },
  }
}

describe('PIM AI config persistence', () => {
  afterEach(() => {
    delete process.env.PIM_AI_KEY_ENCRYPTION_KEY
    delete process.env.PIM_AI_API_KEY
  })

  it('encrypts persisted API keys and decrypts them for provider calls', async () => {
    process.env.PIM_AI_KEY_ENCRYPTION_KEY = ENCRYPTION_KEY
    const { container, store } = createContainer()

    await updatePimAiProviderConfig(container, {
      provider: 'openrouter',
      api_key: SECRET_API_KEY,
      base_url: 'https://openrouter.ai/api/v1',
      model: 'openai/gpt-4o-mini',
    })

    const encryptedApiKey = store.settings[0].encrypted_api_key
    expect(encryptedApiKey).toMatch(/^enc:v1:/)
    expect(encryptedApiKey).not.toContain(SECRET_API_KEY)

    const resolved = await resolvePimAiConfigFromContainer(container)
    expect(resolved.api_key).toBe(SECRET_API_KEY)

    const publicSettings = await getPimAiSettings(container)
    expect(publicSettings.has_api_key).toBe(true)
    expect(publicSettings.api_key_preview).toBe('sk-t••••••••alue')
  })

  it('requires an encryption key before storing API keys', async () => {
    const { container } = createContainer()

    await expect(
      updatePimAiProviderConfig(container, {
        provider: 'openrouter',
        api_key: SECRET_API_KEY,
        base_url: 'https://openrouter.ai/api/v1',
        model: 'openai/gpt-4o-mini',
      }),
    ).rejects.toThrow('PIM_AI_KEY_ENCRYPTION_KEY is required')
  })
})
