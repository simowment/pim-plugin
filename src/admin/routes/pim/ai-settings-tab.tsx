import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo, useState } from 'react'
import { Badge, Button, Container, Input, Select, Text, toast } from '@medusajs/ui'
import { sdk } from '../../lib/sdk'
import {
  AI_PROVIDER_DEFAULTS,
  DEFAULT_AI_PROVIDER,
  Field,
  LoadingState,
  type PimAiModelOption,
  type PimAiSettings,
} from './shared'

const KILO_PROVIDER = 'kilo'
const KILOCODE_PROVIDER = 'kilocode'
const MODEL_OPTION_LIMIT = 25
const MODEL_LIST_STALE_TIME_MS = 5 * 60 * 1000

function aiProviderDefaults(provider: string) {
  return (
    AI_PROVIDER_DEFAULTS.find((option) => option.value === provider) ??
    AI_PROVIDER_DEFAULTS.find((option) => option.value === DEFAULT_AI_PROVIDER)!
  )
}

function aiSettingsSourceLabel(source?: PimAiSettings['source']) {
  if (source === 'gateway') return 'Gateway service'
  if (source === 'pim_settings') return 'PIM settings'
  return 'Environment variables'
}

function isKiloProvider(provider: string) {
  return provider === KILO_PROVIDER || provider === KILOCODE_PROVIDER
}

function modelMatchesSearch(model: PimAiModelOption, searchTerm: string) {
  if (!searchTerm) {
    return true
  }

  return [model.id, model.name, model.owned_by]
    .filter((value): value is string => Boolean(value))
    .some((value) => value.toLowerCase().includes(searchTerm))
}

function contextLengthLabel(contextLength: number | null) {
  return contextLength === null ? null : `${contextLength.toLocaleString()} context`
}

function fetchErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Unable to load Kilo models.'
}

export function AiSettingsTab() {
  const queryClient = useQueryClient()
  const [form, setForm] = useState({
    provider: 'openrouter',
    model: '',
    base_url: '',
    api_key: '',
  })
  const [modelSearch, setModelSearch] = useState('')
  const [hasHydratedSettings, setHasHydratedSettings] = useState(false)

  const settingsQuery = useQuery({
    queryKey: ['pim-ai-settings'],
    queryFn: () => sdk.client.fetch<{ settings: PimAiSettings }>('/admin/pim/ai-settings'),
  })

  useEffect(() => {
    const settings = settingsQuery.data?.settings
    if (!settings || hasHydratedSettings) return
    setForm({
      provider: settings.provider,
      model: settings.model,
      base_url: settings.base_url,
      api_key: '',
    })
    setHasHydratedSettings(true)
  }, [hasHydratedSettings, settingsQuery.data?.settings])

  const saveMutation = useMutation({
    mutationFn: () => {
      const providerDefaults = aiProviderDefaults(form.provider)
      const body: Record<string, string> = {
        provider: form.provider,
        model: form.model.trim() || providerDefaults.model,
        base_url: providerDefaults.base_url,
      }
      if (form.api_key.trim()) {
        body.api_key = form.api_key.trim()
      }
      return sdk.client.fetch<{ settings: PimAiSettings }>('/admin/pim/ai-settings', {
        method: 'POST',
        body,
      })
    },
    onSuccess: (response) => {
      toast.success('PIM AI settings saved')
      setForm({
        provider: response.settings.provider,
        model: response.settings.model,
        base_url: response.settings.base_url,
        api_key: '',
      })
      setHasHydratedSettings(true)
      queryClient.invalidateQueries({ queryKey: ['pim-ai-settings'] })
    },
    onError: (error: Error) => toast.error(error.message),
  })

  const settings = settingsQuery.data?.settings
  const canUpdateSettings = Boolean(settings?.can_update)
  const providerDefaults = aiProviderDefaults(form.provider)
  const effectiveBaseUrl = providerDefaults.base_url
  const shouldShowKiloModels = isKiloProvider(form.provider) && Boolean(effectiveBaseUrl)
  const kiloModelsQuery = useQuery({
    queryKey: ['pim-ai-models', form.provider, effectiveBaseUrl],
    queryFn: () => {
      const query = new URLSearchParams({
        provider: form.provider,
        base_url: effectiveBaseUrl,
      })
      return sdk.client.fetch<{ models: PimAiModelOption[] }>(
        `/admin/pim/ai-settings/models?${query.toString()}`,
      )
    },
    enabled: shouldShowKiloModels,
    staleTime: MODEL_LIST_STALE_TIME_MS,
  })
  const kiloModels = kiloModelsQuery.data?.models ?? []
  const modelSearchTerm = modelSearch.trim().toLowerCase()
  const matchingKiloModels = useMemo(
    () => kiloModels.filter((model) => modelMatchesSearch(model, modelSearchTerm)),
    [kiloModels, modelSearchTerm],
  )
  const visibleKiloModels = matchingKiloModels.slice(0, MODEL_OPTION_LIMIT)
  const selectedKiloModel = shouldShowKiloModels
    ? kiloModels.find((model) => model.id === form.model)
    : undefined
  const canSaveSettings =
    canUpdateSettings &&
    !saveMutation.isPending &&
    Boolean(form.provider) &&
    Boolean(form.model.trim() || providerDefaults.model)

  return (
    <Container className="mt-4 overflow-hidden">
      <div className="border-b border-ui-border-base px-6 py-4">
        <Text size="small" weight="plus">
          PIM AI Gateway
        </Text>
        <Text size="small" leading="compact" className="text-ui-fg-subtle">
          Configure the LLM gateway used by PIM generation. OpenAI, OpenRouter, and Kilo Code use their default compatible API URLs automatically.
        </Text>
      </div>

      {settingsQuery.isLoading ? (
        <LoadingState />
      ) : (
        <div className="grid grid-cols-1 gap-6 px-6 py-4 lg:grid-cols-[minmax(0,1fr)_18rem]">
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Field label="Provider">
                <Select
                  size="small"
                  value={form.provider}
                  onValueChange={(value) => {
                    const currentDefaults = aiProviderDefaults(form.provider)
                    const nextDefaults = aiProviderDefaults(value)
                    setForm({
                      ...form,
                      provider: value,
                      model:
                        !form.model.trim() || form.model === currentDefaults.model
                          ? nextDefaults.model
                          : form.model,
                      base_url: nextDefaults.base_url,
                    })
                    if (!isKiloProvider(value)) {
                      setModelSearch('')
                    }
                  }}
                >
                  <Select.Trigger aria-label="Provider">
                    <Select.Value />
                  </Select.Trigger>
                  <Select.Content>
                    {AI_PROVIDER_DEFAULTS.map((option) => (
                      <Select.Item key={option.value} value={option.value}>
                        {option.label}
                      </Select.Item>
                    ))}
                  </Select.Content>
                </Select>
              </Field>
              <Field label="Model">
                <Input
                  value={form.model}
                  onChange={(event) => setForm({ ...form, model: event.target.value })}
                  placeholder={providerDefaults.model ? providerDefaults.model : 'openai/gpt-4o-mini'}
                />
              </Field>
            </div>

            {shouldShowKiloModels && (
              <div className="rounded-md border border-ui-border-base bg-ui-bg-component">
                <div className="flex flex-col gap-2 border-b border-ui-border-base px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <Text size="small" weight="plus">
                      Available Kilo models
                    </Text>
                    <Text size="xsmall" className="text-ui-fg-subtle">
                      Pick from Kilo's live model list or keep the typed model ID.
                    </Text>
                  </div>
                  <Badge size="2xsmall" color="blue">
                    {kiloModelsQuery.isLoading ? 'Loading' : `${kiloModels.length} models`}
                  </Badge>
                </div>

                <div className="space-y-2 p-3">
                  <Input
                    size="small"
                    value={modelSearch}
                    onChange={(event) => setModelSearch(event.target.value)}
                    placeholder="Search model id, name, or provider"
                  />

                  {kiloModelsQuery.isLoading ? (
                    <Text size="small" className="text-ui-fg-subtle">
                      Loading Kilo models...
                    </Text>
                  ) : kiloModelsQuery.error ? (
                    <div className="space-y-2">
                      <Text size="small" className="text-ui-fg-error">
                        {fetchErrorMessage(kiloModelsQuery.error)}
                      </Text>
                      <Button
                        size="small"
                        variant="secondary"
                        onClick={() => {
                          kiloModelsQuery.refetch()
                        }}
                      >
                        Retry
                      </Button>
                    </div>
                  ) : visibleKiloModels.length ? (
                    <>
                      <div className="max-h-56 overflow-y-auto rounded-md border border-ui-border-base">
                        {visibleKiloModels.map((model) => {
                          const isSelected = model.id === form.model
                          const contextLabel = contextLengthLabel(model.context_length)

                          return (
                            <button
                              key={model.id}
                              type="button"
                              className={`flex w-full items-start justify-between gap-3 border-b border-ui-border-base px-3 py-2 text-left last:border-b-0 hover:bg-ui-bg-component-hover ${
                                isSelected ? 'bg-ui-bg-component-hover' : 'bg-ui-bg-component'
                              }`}
                              onClick={() => setForm({ ...form, model: model.id })}
                            >
                              <span className="min-w-0">
                                <Text size="small" weight="plus" className="break-all">
                                  {model.name ?? model.id}
                                </Text>
                                <Text size="xsmall" className="break-all text-ui-fg-subtle">
                                  {model.id}
                                </Text>
                              </span>
                              <span className="shrink-0 text-right">
                                <Badge
                                  size="2xsmall"
                                  color={model.supports_response_format ? 'green' : 'orange'}
                                >
                                  {model.supports_response_format ? 'JSON' : 'No JSON'}
                                </Badge>
                                {model.owned_by && (
                                  <Text size="xsmall" className="text-ui-fg-subtle">
                                    {model.owned_by}
                                  </Text>
                                )}
                                {contextLabel && (
                                  <Text size="xsmall" className="text-ui-fg-subtle">
                                    {contextLabel}
                                  </Text>
                                )}
                              </span>
                            </button>
                          )
                        })}
                      </div>
                      <Text size="xsmall" className="text-ui-fg-subtle">
                        Showing {visibleKiloModels.length} of {matchingKiloModels.length} matches.
                      </Text>
                      {selectedKiloModel && !selectedKiloModel.supports_response_format && (
                        <Text size="xsmall" className="text-ui-fg-error">
                          This model does not advertise JSON mode. PIM generation needs a model
                          marked JSON.
                        </Text>
                      )}
                    </>
                  ) : (
                    <Text size="small" className="text-ui-fg-subtle">
                      No Kilo models match this search.
                    </Text>
                  )}
                </div>
              </div>
            )}

            <Field label="Resolved Base URL">
              <Input
                value={effectiveBaseUrl}
                disabled
              />
            </Field>

            <Field label="API Key">
              <Input
                type="password"
                value={form.api_key}
                onChange={(event) => setForm({ ...form, api_key: event.target.value })}
                placeholder="Enter new key or leave blank to keep current"
              />
              {settings?.has_api_key && settings.api_key_preview ? (
                <div className="flex items-center gap-1.5 mt-1.5">
                  <Badge size="2xsmall" rounded="full" className="bg-ui-tag-green-icon text-ui-tag-green-icon">
                    OK
                  </Badge>
                  <Text size="xsmall" className="text-ui-fg-subtle font-mono">
                    {settings.api_key_preview}
                  </Text>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 mt-1.5">
                  <Badge size="2xsmall" rounded="full" className="bg-ui-tag-red-icon text-ui-tag-red-icon">
                    No
                  </Badge>
                  <Text size="xsmall" className="text-ui-fg-subtle">
                    No API key saved
                  </Text>
                </div>
              )}
            </Field>

            <div className="flex justify-end">
              <Button
                size="small"
                isLoading={saveMutation.isPending}
                disabled={!canSaveSettings}
                onClick={() => saveMutation.mutate()}
              >
                Save AI Settings
              </Button>
            </div>
          </div>

          <div className="rounded-lg border border-ui-border-base bg-ui-bg-subtle px-4 py-3 space-y-3">
            <Text size="small" weight="plus">
              Current gateway
            </Text>
            <SettingsRow label="Provider" value={settings?.provider} />
            <SettingsRow label="Source" value={aiSettingsSourceLabel(settings?.source)} />
            <SettingsRow label="Model" value={settings?.model} />
            <SettingsRow label="Base URL" value={settings?.base_url} />
            <SettingsRow label="API key" value={settings?.has_api_key ? `Configured ${settings.api_key_preview}` : 'Not configured'} />
            <SettingsRow label="Temperature" value={String(settings?.temperature ?? '')} />
            <SettingsRow label="Max tokens" value={String(settings?.max_tokens ?? '')} />
          </div>
        </div>
      )}
    </Container>
  )
}

interface SettingsRowProps {
  label: string
  value?: string
}

function SettingsRow({ label, value }: SettingsRowProps) {
  return (
    <div className="space-y-1">
      <Text size="xsmall" leading="compact" weight="plus" className="text-ui-fg-subtle">
        {label}
      </Text>
      <Text size="small" leading="compact" className="break-all">
        {value || '-'}
      </Text>
    </div>
  )
}
