import { useQuery } from '@tanstack/react-query'
import { Button, Text } from '@medusajs/ui'
import { sdk } from '../../lib/sdk'
import type { PimAiSettings } from './shared'

export interface PimAiStatus {
  /** True when an AI provider key is saved, so drafting and translation can run. */
  ready: boolean
  isLoading: boolean
  /** True when the settings come from the shared module (managed in Support tickets). */
  shared: boolean
  error: string | null
}

/** Reads GET /admin/pim/ai-settings once (same cache as the AI setup tab). */
export function usePimAiStatus(): PimAiStatus {
  const query = useQuery({
    queryKey: ['pim-ai-settings'],
    queryFn: () => sdk.client.fetch<{ settings: PimAiSettings }>('/admin/pim/ai-settings'),
  })
  const settings = query.data?.settings
  return {
    ready: Boolean(settings?.has_api_key),
    isLoading: query.isLoading,
    shared: settings?.source === 'gateway',
    error: query.isError
      ? ((query.error as Error | null)?.message ?? 'unknown error')
      : (settings?.unavailable_reason ?? null),
  }
}

interface AiNotReadyNoticeProps {
  status: PimAiStatus
  onOpenAiSetup?: () => void
}

/** Shown in place of AI actions while no AI key is configured. */
export function AiNotReadyNotice({ status, onOpenAiSetup }: AiNotReadyNoticeProps) {
  if (status.ready || status.isLoading) {
    return null
  }

  return (
    <div className="flex flex-col gap-2 rounded-md border border-ui-border-base bg-ui-bg-subtle p-3 sm:flex-row sm:items-center sm:justify-between">
      <Text size="small" leading="compact" className="text-ui-fg-subtle">
        {status.error
          ? `AI is off: ${status.error}`
          : status.shared
            ? 'AI is not set up. Add an AI key in Support tickets, AI settings (shared with this page).'
            : 'AI is not set up. Add an AI key on the AI setup tab to draft and translate with AI.'}
      </Text>
      {onOpenAiSetup && !status.error && (
        <Button size="small" variant="secondary" className="shrink-0" onClick={onOpenAiSetup}>
          Open AI setup
        </Button>
      )}
    </div>
  )
}
