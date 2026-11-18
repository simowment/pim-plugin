import { AuthenticatedMedusaRequest, MedusaResponse } from '@medusajs/framework/http'
import { MedusaError } from '@medusajs/framework/utils'
import { getPimAiSettings } from '../../../../lib/ai-config'
import { resolveDefaultPimChannel, resolvePimChannels, resolveTranslationMirrorChannels } from '../../../../lib/channels'
import {
  getPimPluginOptions,
  resolveAiGatewayModuleOption,
  resolveAiKeyEncryptionSecret,
  resolveDefaultLocaleOption,
  resolveLocalesOption,
} from '../../../../lib/config'
import { getErrorMessage } from '../../../../lib/error-messages'
import { describeEditableSettings, type PimEditableSettingsInput } from '../../../../lib/pim-settings'
import { updatePimSettingsWorkflow } from '../../../../workflows/update-pim-settings'

type Source = 'admin' | 'host' | 'default'

function hasEnv(name: string): boolean {
  return Boolean(process.env[name]?.trim())
}

/** Everything Product content reads, for Product content > Settings. Never a secret value. */
async function buildSettingsView(container: AuthenticatedMedusaRequest['scope']) {
  const options = getPimPluginOptions()
  const ai = options.ai ?? {}
  const localesFromHost = Boolean(options.locales?.length) || hasEnv('PIM_LOCALES')
  const defaultLocaleFromHost = Boolean(options.default_locale) || hasEnv('PIM_DEFAULT_LOCALE')
  const channelFromHost = Boolean(options.default_channel) || hasEnv('PIM_DEFAULT_CHANNEL')
  const source = (fromHost: boolean): Source => (fromHost ? 'host' : 'default')

  const [generation, aiSettings] = await Promise.all([
    describeEditableSettings(container),
    getPimAiSettings(container),
  ])

  return {
    shop_slug: process.env.SHOP_SLUG?.trim() || null,
    generation,
    ai: {
      ready: aiSettings.has_api_key,
      unavailable_reason: aiSettings.unavailable_reason ?? null,
      provider_source: aiSettings.source,
      gateway_module: resolveAiGatewayModuleOption() ?? null,
      gateway_module_source: source(Boolean(ai.gateway_module) || hasEnv('PIM_AI_GATEWAY_MODULE')),
      key_encryption_set: Boolean(resolveAiKeyEncryptionSecret()),
      key_encryption_source: source(Boolean(ai.key_encryption_key) || hasEnv('PIM_AI_KEY_ENCRYPTION_KEY')),
      // Header names only: values can carry tokens.
      extra_header_names: Object.keys(
        (ai.headers as Record<string, string> | undefined) ?? safeHeaderNames(process.env.PIM_AI_HEADERS_JSON),
      ),
      extra_headers_source: source(Boolean(ai.headers) || hasEnv('PIM_AI_HEADERS_JSON')),
    },
    languages: {
      locales: resolveLocalesOption(),
      locales_source: source(localesFromHost),
      default_locale: resolveDefaultLocaleOption(),
      default_locale_source: source(defaultLocaleFromHost),
    },
    channels: {
      default_channel: resolveDefaultPimChannel(),
      default_channel_source: source(channelFromHost),
      channels: resolvePimChannels(),
      channels_source: source(Boolean(options.channels?.length)),
      translation_channels: resolveTranslationMirrorChannels(),
      translation_channels_source: source(Boolean(options.translation_channels?.length)),
    },
  }
}

function safeHeaderNames(json: string | undefined): Record<string, unknown> {
  if (!json?.trim()) return {}
  try {
    const parsed = JSON.parse(json) as unknown
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {}
  } catch {
    return {}
  }
}

// GET /admin/pim/settings
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  res.json({ settings: await buildSettingsView(req.scope) })
}

// POST /admin/pim/settings  { temperature?, max_tokens?, request_timeout_ms? } (null = back to default)
export async function POST(req: AuthenticatedMedusaRequest<PimEditableSettingsInput>, res: MedusaResponse) {
  try {
    await updatePimSettingsWorkflow(req.scope).run({ input: req.validatedBody })
  } catch (error) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, `Could not save the settings: ${getErrorMessage(error)}`)
  }
  res.json({ settings: await buildSettingsView(req.scope) })
}
