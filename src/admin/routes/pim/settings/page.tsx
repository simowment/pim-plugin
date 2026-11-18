import { Button, Input, Text, toast } from '@medusajs/ui'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { ErrorState, errorMessage } from '../../../components/ui/error-state'
import { InstallerCode } from '../../../components/ui/installer-hint'
import { SaveBar } from '../../../components/ui/save-bar'
import {
  HostSettingRow,
  SettingRow,
  SettingsPage,
  SettingsSection,
  type SettingSourceKind,
} from '../../../components/ui/settings-page'
import { useUnsavedGuard } from '../../../components/ui/use-unsaved-guard'
import { sdk } from '../../../lib/sdk'
import { AiSettingsTab } from '../ai-settings-tab'
import { MetadataFieldsTab } from '../metadata-fields-tab'
import type { PimAiSettings } from '../shared'

/**
 * S12. Product content > Settings: every option the plugin reads. Generation limits are
 * saved here (table pim_setting) and win over PIM_AI_* on the host; the AI service is
 * set where it is stored (this page, or Support inbox settings when shared); languages,
 * channels and secrets are shown with where to change them on the host.
 *
 * The page has no sidebar item of its own: Product content sits under Products, and Medusa
 * does not show sub-items of a nested entry. It is reached from the Product content header
 * and from Settings > Apps.
 */

type EditableKey = 'temperature' | 'max_tokens' | 'request_timeout_ms'

interface EditableSetting {
  value: number
  source: SettingSourceKind
  fallback: number
  fallback_source: 'host' | 'default'
  variable: string
}

interface PimSettingsView {
  shop_slug: string | null
  generation: Record<EditableKey, EditableSetting>
  ai: {
    ready: boolean
    unavailable_reason: string | null
    provider_source: PimAiSettings['source']
    gateway_module: string | null
    gateway_module_source: SettingSourceKind
    key_encryption_set: boolean
    key_encryption_source: SettingSourceKind
    extra_header_names: string[]
    extra_headers_source: SettingSourceKind
  }
  languages: {
    locales: string[]
    locales_source: SettingSourceKind
    default_locale: string
    default_locale_source: SettingSourceKind
  }
  channels: {
    default_channel: string
    default_channel_source: SettingSourceKind
    channels: string[]
    channels_source: SettingSourceKind
    translation_channels: string[]
    translation_channels_source: SettingSourceKind
  }
}

const SETTINGS_KEY = ['pim-settings']

const FIELDS: Array<{
  key: EditableKey
  label: string
  help: string
  unit: string
  step: string
  min: number
  max: number
  /** Shown value -> stored value. */
  toStored: (value: number) => number
  fromStored: (value: number) => number
}> = [
  {
    key: 'temperature',
    label: 'Writing variety (temperature)',
    help: 'How freely the AI words its drafts. 0 gives the most predictable text, 2 the most varied. 0.4 suits product copy.',
    unit: '0 to 2',
    step: '0.1',
    min: 0,
    max: 2,
    toStored: (value) => value,
    fromStored: (value) => value,
  },
  {
    key: 'max_tokens',
    label: 'Longest AI answer',
    help: 'The most text one AI request may return, in tokens (about 4 characters each). A full product page in one language needs about 2,000.',
    unit: 'tokens',
    step: '256',
    min: 256,
    max: 200000,
    toStored: (value) => Math.round(value),
    fromStored: (value) => value,
  },
  {
    key: 'request_timeout_ms',
    label: 'Time limit per AI request',
    help: 'A request that takes longer is stopped and reported as failed in the AI review queue.',
    unit: 'seconds',
    step: '5',
    min: 5,
    max: 600,
    toStored: (value) => Math.round(value * 1000),
    fromStored: (value) => Math.round(value / 1000),
  },
]

function igm(slug: string | null, command: string) {
  return `node cli/bin/igm.mjs shop ${command} --shop ${slug ?? '<slug>'}`
}

/** Scrolls to #section once the page has rendered (links from status strips). */
function useScrollToHash(ready: boolean) {
  const { hash } = useLocation()
  useEffect(() => {
    if (!ready || !hash) return
    const target = document.getElementById(decodeURIComponent(hash.slice(1)))
    target?.scrollIntoView({ block: 'start' })
  }, [ready, hash])
}

function GenerationSection({ view }: { view: PimSettingsView }) {
  const queryClient = useQueryClient()
  const initial = useMemo(
    () =>
      Object.fromEntries(
        FIELDS.map((field) => [field.key, String(field.fromStored(view.generation[field.key].value))]),
      ) as Record<EditableKey, string>,
    [view],
  )
  const [form, setForm] = useState(initial)
  useEffect(() => setForm(initial), [initial])

  const changed = FIELDS.filter((field) => form[field.key].trim() !== initial[field.key])
  const dirty = changed.length > 0
  useUnsavedGuard(dirty)

  const invalid = FIELDS.find((field) => {
    const raw = form[field.key].trim()
    const value = Number(raw)
    return !raw || !Number.isFinite(value) || value < field.min || value > field.max
  })

  const save = useMutation({
    mutationFn: (body: Partial<Record<EditableKey, number | null>>) =>
      sdk.client.fetch<{ settings: PimSettingsView }>('/admin/pim/settings', { method: 'POST', body }),
    onSuccess: (response) => {
      queryClient.setQueryData(SETTINGS_KEY, response)
      void queryClient.invalidateQueries({ queryKey: ['pim-ai-settings'] })
      toast.success('Settings saved')
    },
    onError: (error) => toast.error(errorMessage(error) ?? 'Could not save the settings'),
  })

  const onSave = () => {
    const body: Partial<Record<EditableKey, number>> = {}
    for (const field of changed) body[field.key] = field.toStored(Number(form[field.key]))
    save.mutate(body)
  }

  return (
    <SettingsSection
      id="generation"
      title="AI drafting limits"
      description="Used for every AI draft and translation. Saved values apply to the next AI request."
    >
      {FIELDS.map((field) => {
        const setting = view.generation[field.key]
        const id = `pim-setting-${field.key}`
        const fallbackText = `${field.fromStored(setting.fallback)}${field.key === 'request_timeout_ms' ? ' seconds' : ''}`
        return (
          <SettingRow
            key={field.key}
            label={field.label}
            htmlFor={id}
            source={setting.source}
            help={
              <>
                {field.help}{' '}
                {setting.source === 'admin'
                  ? `Without the value saved here: ${fallbackText} (${setting.fallback_source === 'host' ? 'set on the host' : 'default'}).`
                  : null}
              </>
            }
            control={
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <Input
                    id={id}
                    size="small"
                    type="number"
                    inputMode="decimal"
                    step={field.step}
                    min={field.min}
                    max={field.max}
                    value={form[field.key]}
                    onChange={(event) => setForm({ ...form, [field.key]: event.target.value })}
                    className="max-w-[10rem]"
                  />
                  <Text size="small" className="text-ui-fg-subtle">
                    {field.unit}
                  </Text>
                </div>
                {invalid?.key === field.key ? (
                  <Text size="xsmall" className="text-ui-fg-error">
                    Enter a number from {field.min} to {field.max}.
                  </Text>
                ) : null}
                {setting.source === 'admin' && !dirty ? (
                  <Button
                    size="small"
                    variant="transparent"
                    className="w-fit px-0"
                    isLoading={save.isPending}
                    onClick={() => save.mutate({ [field.key]: null })}
                  >
                    Use {fallbackText} instead
                  </Button>
                ) : null}
              </div>
            }
            technical={
              <div className="flex flex-col gap-1">
                <Text size="xsmall" className="text-ui-fg-subtle">
                  Saved in table pim_setting; wins over the variable{' '}
                  <code className="font-mono">{setting.variable}</code> (plugin option{' '}
                  <code className="font-mono">ai.{field.key}</code>) in shops/
                  {view.shop_slug ?? '<slug>'}/.env.
                </Text>
              </div>
            }
          />
        )
      })}
      {dirty ? (
        <div className="px-6 py-4">
          <SaveBar
            dirty={dirty}
            saving={save.isPending}
            disabled={Boolean(invalid)}
            onSave={onSave}
            onDiscard={() => setForm(initial)}
          />
        </div>
      ) : null}
    </SettingsSection>
  )
}

function SharedAiSection({ view, ai }: { view: PimSettingsView; ai: PimAiSettings | undefined }) {
  return (
    <SettingsSection
      id="ai"
      title="AI service"
      description="The AI service that drafts and translates product content. AI never publishes: every result is a draft you review first."
    >
      <SettingRow
        label="Shared with the Support inbox"
        help="Product content uses the AI service and key set in Support inbox settings, so one key serves both."
        control={
          <Link
            to="/tickets/settings#ai"
            className="txt-compact-small-plus text-ui-fg-interactive hover:text-ui-fg-interactive-hover"
          >
            Change in Support inbox settings
          </Link>
        }
        technical={
          <Text size="xsmall" className="text-ui-fg-subtle">
            Gateway module: <code className="font-mono">{view.ai.gateway_module}</code> (plugin option{' '}
            <code className="font-mono">ai.gateway_module</code> in backend/medusa-config.ts).
          </Text>
        }
      />
      <SettingRow label="Provider and model" control={<Text size="small">{ai ? `${ai.provider} · ${ai.model}` : 'Checking…'}</Text>} />
      <SettingRow
        label="API key"
        technical={
          view.ai.unavailable_reason ? (
            <Text size="xsmall" className="text-ui-fg-subtle break-words">
              {view.ai.unavailable_reason}
            </Text>
          ) : undefined
        }
        control={
          <Text size="small" className={view.ai.ready ? 'text-ui-fg-base' : 'text-ui-fg-error'}>
            {view.ai.ready
              ? `Saved (${ai?.api_key_preview ?? ''})`
              : view.ai.unavailable_reason
                ? 'AI is off: the shared AI settings cannot be used by Product content. Check them in Support inbox settings; the reason is under Technical details.'
                : 'Not saved: AI drafting and translation are off until a key is added in Support inbox settings.'}
          </Text>
        }
      />
    </SettingsSection>
  )
}

function list(values: string[]) {
  return values.join(', ')
}

const PimSettingsPage = () => {
  const query = useQuery({
    queryKey: SETTINGS_KEY,
    queryFn: () => sdk.client.fetch<{ settings: PimSettingsView }>('/admin/pim/settings'),
  })
  const aiQuery = useQuery({
    queryKey: ['pim-ai-settings'],
    queryFn: () => sdk.client.fetch<{ settings: PimAiSettings }>('/admin/pim/ai-settings'),
  })
  const view = query.data?.settings
  const ai = aiQuery.data?.settings
  useScrollToHash(Boolean(view))
  const slug = view?.shop_slug ?? null

  return (
    <SettingsPage
      title="Product content settings"
      subtitle="The AI used for drafts and translations, its limits, the languages you write in, and the field templates."
      back={{ to: '/pim', label: 'Product content' }}
    >
      {query.isLoading ? (
        <Text size="small" className="text-ui-fg-subtle px-1">
          Checking…
        </Text>
      ) : null}
      {query.isError ? (
        <ErrorState
          what="the product content settings"
          error={query.error}
          onRetry={() => query.refetch()}
          retrying={query.isFetching}
        />
      ) : null}
      {view ? (
        <>
          {view.ai.provider_source === 'gateway' ? (
            <SharedAiSection view={view} ai={ai} />
          ) : (
            <div id="ai" className="[&>div]:mt-0">
              <AiSettingsTab />
            </div>
          )}

          <GenerationSection view={view} />

          <SettingsSection
            id="languages"
            title="Languages"
            description="The languages offered in the content editor. They follow the store's languages."
          >
            <HostSettingRow
              label="Languages"
              help="The store's languages, set by your installer."
              state={list(view.languages.locales)}
              ok
              variable={`PIM_LOCALES (plugin option locales), from shops/${slug ?? '<slug>'}/store.json "locales"`}
              command={igm(slug, 'up')}
            />
            <HostSettingRow
              label="Language the editor opens in"
              help="The first of the store's languages."
              state={view.languages.default_locale}
              ok
              variable="PIM_DEFAULT_LOCALE (plugin option default_locale)"
              command={igm(slug, 'up')}
            />
          </SettingsSection>

          <SettingsSection
            id="channels"
            title="Channels"
            description="Content can differ per sales channel: the storefront, Google Shopping or Meta. These are fixed by the store setup."
          >
            <SettingRow
              label="Main channel"
              help="Content the storefront shows. New content is written for it unless you pick another."
              source={view.channels.default_channel_source}
              control={<Text size="small">{view.channels.default_channel}</Text>}
              technical={
                <Text size="xsmall" className="text-ui-fg-subtle">
                  Variable <code className="font-mono">PIM_DEFAULT_CHANNEL</code> or plugin option{' '}
                  <code className="font-mono">default_channel</code>. The storefront reads this channel.
                </Text>
              }
            />
            <SettingRow
              label="Channels offered"
              source={view.channels.channels_source}
              control={<Text size="small">{list(view.channels.channels)}</Text>}
              technical={
                <Text size="xsmall" className="text-ui-fg-subtle">
                  Plugin option <code className="font-mono">channels</code> in backend/medusa-config.ts.
                </Text>
              }
            />
            <SettingRow
              label="Copied to Medusa translations"
              help="Published content in these channels is also saved as Medusa product translations, so other parts of the store see it."
              source={view.channels.translation_channels_source}
              control={<Text size="small">{list(view.channels.translation_channels)}</Text>}
              technical={
                <Text size="xsmall" className="text-ui-fg-subtle">
                  Plugin option <code className="font-mono">translation_channels</code> (default: the
                  main channel plus <code className="font-mono">default</code>).
                </Text>
              }
            />
          </SettingsSection>

          <SettingsSection
            id="host"
            title="Set on the host"
            description="Connection details your installer sets. They are not secrets you need day to day."
          >
            <HostSettingRow
              label="Key that encrypts saved AI keys"
              help={
                view.ai.provider_source === 'gateway'
                  ? 'Not used while the AI service is shared with the Support inbox.'
                  : 'Needed before an AI key can be saved on this page. It is generated when the shop is created.'
              }
              state={view.ai.key_encryption_set ? 'Set' : 'Not set'}
              ok={view.ai.provider_source === 'gateway' ? undefined : view.ai.key_encryption_set}
              variable="PIM_AI_KEY_ENCRYPTION_KEY (plugin option ai.key_encryption_key)"
              command={igm(slug, 'up')}
            />
            <SettingRow
              label="Extra request headers"
              help="Sent with every AI request, for providers that need them."
              source={view.ai.extra_headers_source}
              control={
                <Text size="small" className="text-ui-fg-subtle">
                  {view.ai.extra_header_names.length
                    ? `Set: ${list(view.ai.extra_header_names)}`
                    : 'None'}
                </Text>
              }
              technical={
                <div className="flex flex-col gap-2">
                  <Text size="xsmall" className="text-ui-fg-subtle">
                    Variable: <code className="font-mono">PIM_AI_HEADERS_JSON</code> (plugin option
                    ai.headers) in shops/{slug ?? '<slug>'}/.env, applied with:
                  </Text>
                  <InstallerCode>{igm(slug, 'up')}</InstallerCode>
                </div>
              }
            />
          </SettingsSection>

          <div id="fields" className="flex flex-col">
            <MetadataFieldsTab />
          </div>

        </>
      ) : null}
    </SettingsPage>
  )
}

export default PimSettingsPage
