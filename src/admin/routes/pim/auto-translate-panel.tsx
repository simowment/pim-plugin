import { Sparkles } from '@medusajs/icons'
import { Button, Text, toast } from '@medusajs/ui'
import { useEffect, useMemo, useState } from 'react'
import { getErrorMessage } from '../../../lib/error-messages'
import { AiNotReadyNotice, type PimAiStatus } from './ai-status'
import { DEFAULT_TRANSLATE_FIELDS, type TranslateField } from './shared'

type LocaleStatus = 'idle' | 'running' | 'completed' | 'failed'

const STATUS_LABELS: Record<LocaleStatus, string> = {
  idle: '',
  running: 'Translating…',
  completed: 'Draft ready',
  failed: 'Failed',
}

interface AutoTranslatePanelProps {
  baseLocale: string
  locales: string[]
  selectedProductId: string
  /** True when the editor shows unsaved base-language changes (they are saved first). */
  saveBaseFirst: boolean
  isBusy: boolean
  aiStatus: PimAiStatus
  onOpenAiSetup?: () => void
  onSaveSource: () => Promise<void>
  onTranslateLocale: (
    sourceLocale: string,
    targetLocale: string,
    fields: TranslateField[],
  ) => Promise<void>
  onComplete: () => void
}

/**
 * One action: translate the base-language text (title, descriptions and
 * specifications) into the chosen languages. Each result is a draft in the
 * AI review queue; nothing is published.
 */
export function AutoTranslatePanel({
  baseLocale,
  locales,
  selectedProductId,
  saveBaseFirst,
  isBusy,
  aiStatus,
  onOpenAiSetup,
  onSaveSource,
  onTranslateLocale,
  onComplete,
}: AutoTranslatePanelProps) {
  const targetOptions = useMemo(
    () => locales.filter((item) => item !== baseLocale),
    [locales, baseLocale],
  )
  const [targetLocales, setTargetLocales] = useState<string[]>(targetOptions)
  const [statuses, setStatuses] = useState<Record<string, LocaleStatus>>({})
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [isRunning, setIsRunning] = useState(false)

  useEffect(() => {
    setTargetLocales(targetOptions)
  }, [targetOptions])

  useEffect(() => {
    setStatuses({})
    setErrors({})
  }, [selectedProductId])

  if (!targetOptions.length) {
    return null
  }

  const canRun = Boolean(
    selectedProductId && targetLocales.length && aiStatus.ready && !isBusy && !isRunning,
  )

  const toggleTarget = (targetLocale: string) => {
    if (isRunning) return
    setTargetLocales((current) =>
      current.includes(targetLocale)
        ? current.filter((item) => item !== targetLocale)
        : [...current, targetLocale],
    )
  }

  const run = async () => {
    if (!canRun) return
    setIsRunning(true)
    setErrors({})
    try {
      if (saveBaseFirst) {
        await onSaveSource()
      }
      setStatuses(Object.fromEntries(targetLocales.map((item) => [item, 'running'])))
      const results = await Promise.allSettled(
        targetLocales.map((target) =>
          onTranslateLocale(baseLocale, target, DEFAULT_TRANSLATE_FIELDS),
        ),
      )
      const nextStatuses: Record<string, LocaleStatus> = {}
      const nextErrors: Record<string, string> = {}
      results.forEach((result, index) => {
        const target = targetLocales[index]
        if (result.status === 'fulfilled') {
          nextStatuses[target] = 'completed'
        } else {
          nextStatuses[target] = 'failed'
          nextErrors[target] = getErrorMessage(result.reason)
        }
      })
      setStatuses(nextStatuses)
      setErrors(nextErrors)
      onComplete()
      if (Object.keys(nextErrors).length) {
        toast.error('Some translations failed. See the reason under each language.', {
          duration: 8000,
        })
      } else {
        toast.success('Translation drafts are in the AI review queue.')
      }
    } catch (error) {
      setStatuses({})
      toast.error(getErrorMessage(error), { duration: 8000 })
    } finally {
      setIsRunning(false)
    }
  }

  return (
    <div className="rounded-lg border border-ui-border-base bg-ui-bg-component p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-md border border-ui-border-base bg-ui-bg-base text-ui-fg-interactive">
            <Sparkles />
          </div>
          <div className="min-w-0">
            <Text size="small" weight="plus">
              Translate with AI from {baseLocale.toUpperCase()}
            </Text>
            <Text size="small" leading="compact" className="text-ui-fg-subtle">
              Translates the title, descriptions and specifications into the selected languages.
              Each result is a draft in the AI review queue; nothing is published.
              {saveBaseFirst ? ' Your unsaved changes are saved as a draft first.' : ''}
            </Text>
          </div>
        </div>
        <Button
          size="small"
          className="w-full shrink-0 lg:w-auto"
          isLoading={isRunning}
          disabled={!canRun}
          onClick={run}
        >
          Translate
        </Button>
      </div>

      <div className="mt-3">
        <AiNotReadyNotice status={aiStatus} onOpenAiSetup={onOpenAiSetup} />
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {targetOptions.map((targetLocale) => {
          const selected = targetLocales.includes(targetLocale)
          const status = statuses[targetLocale] ?? 'idle'
          return (
            <button
              key={targetLocale}
              type="button"
              aria-pressed={selected}
              disabled={isRunning || !aiStatus.ready}
              className={`inline-flex items-center gap-2 rounded-md border px-2.5 py-1 text-xs transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
                selected
                  ? 'border-ui-border-interactive text-ui-fg-base'
                  : 'border-ui-border-base text-ui-fg-muted'
              }`}
              onClick={() => toggleTarget(targetLocale)}
            >
              <span className="font-medium">{targetLocale.toUpperCase()}</span>
              {STATUS_LABELS[status] && <span className="opacity-75">{STATUS_LABELS[status]}</span>}
            </button>
          )
        })}
      </div>

      {Object.entries(errors).map(([targetLocale, message]) => (
        <Text key={targetLocale} size="xsmall" className="text-ui-fg-error mt-2">
          {targetLocale.toUpperCase()}: {message}
        </Text>
      ))}
    </div>
  )
}
