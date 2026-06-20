import { Sparkles } from '@medusajs/icons'
import { Button, Select, Text, toast } from '@medusajs/ui'
import { useEffect, useMemo, useState } from 'react'
import { getErrorMessage } from '../../../lib/error-messages'

type LocaleStatus = 'idle' | 'running' | 'completed' | 'failed'
type FlowStep = 'configure' | 'save_source' | 'translate' | 'review'

const STEP_LABELS: Array<{ step: FlowStep; label: string }> = [
  { step: 'configure', label: 'Configure' },
  { step: 'save_source', label: 'Save source' },
  { step: 'translate', label: 'Translate' },
  { step: 'review', label: 'Review drafts' },
]

const STATUS_LABELS: Record<LocaleStatus, string> = {
  idle: 'Ready',
  running: 'Running',
  completed: 'Done',
  failed: 'Failed',
}

const STATUS_CLASSES: Record<LocaleStatus, string> = {
  idle: 'border-ui-border-base text-ui-fg-subtle',
  running: 'border-ui-tag-orange-border text-ui-tag-orange-text bg-ui-tag-orange-bg',
  completed: 'border-ui-tag-green-border text-ui-tag-green-text bg-ui-tag-green-bg',
  failed: 'border-ui-tag-red-border text-ui-tag-red-text bg-ui-tag-red-bg',
}

interface AutoTranslatePanelProps {
  locales: string[]
  currentLocale: string
  selectedProductId: string
  isDirty: boolean
  isBusy: boolean
  onSaveSource: () => Promise<void>
  onTranslateLocale: (sourceLocale: string, targetLocale: string) => Promise<void>
  onComplete: () => void
}

export function AutoTranslatePanel({
  locales,
  currentLocale,
  selectedProductId,
  isDirty,
  isBusy,
  onSaveSource,
  onTranslateLocale,
  onComplete,
}: AutoTranslatePanelProps) {
  const [sourceLocale, setSourceLocale] = useState(currentLocale)
  const [targetLocales, setTargetLocales] = useState<string[]>([])
  const [step, setStep] = useState<FlowStep>('configure')
  const [statuses, setStatuses] = useState<Record<string, LocaleStatus>>({})
  const [errors, setErrors] = useState<Record<string, string>>({})

  const targetOptions = useMemo(
    () => locales.filter((item) => item !== sourceLocale),
    [locales, sourceLocale],
  )
  const failedLocales = targetLocales.filter((item) => statuses[item] === 'failed')
  const completedCount = targetLocales.filter((item) => statuses[item] === 'completed').length
  const visibleErrors = Object.entries(errors).filter(([locale]) => targetLocales.includes(locale))
  const isRunning = step === 'save_source' || step === 'translate'
  const canContinue = Boolean(selectedProductId && targetLocales.length && !isBusy && !isRunning)
  const disableTargetChanges = isBusy || isRunning
  const progressLabel =
    targetLocales.length === 0
      ? 'No target locales selected'
      : `${completedCount}/${targetLocales.length} locales complete${
          failedLocales.length ? ` - ${failedLocales.length} failed` : ''
        }`

  useEffect(() => {
    setSourceLocale(currentLocale)
  }, [currentLocale])

  useEffect(() => {
    setStep('configure')
    setStatuses({})
    setErrors({})
  }, [selectedProductId, sourceLocale])

  useEffect(() => {
    setTargetLocales((current) => {
      const valid = current.filter((item) => targetOptions.includes(item))
      return valid.length ? valid : targetOptions.slice(0, 1)
    })
  }, [targetOptions])

  const toggleTarget = (targetLocale: string) => {
    if (disableTargetChanges) {
      return
    }

    setTargetLocales((current) =>
      current.includes(targetLocale)
        ? current.filter((item) => item !== targetLocale)
        : [...current, targetLocale],
    )
    setStep('configure')
  }

  const selectAllTargets = () => {
    if (disableTargetChanges) {
      return
    }

    setTargetLocales(targetOptions)
    setStep('configure')
  }

  const clearErrors = () => {
    setErrors({})
  }

  const continueFlow = async () => {
    if (!canContinue) {
      return
    }

    setErrors({})
    const localesToProcess = targetLocales.filter((item) => statuses[item] !== 'completed')
    if (!localesToProcess.length) {
      toast.success('All selected locales already have translation drafts.')
      setStep('review')
      return
    }

    setStep('save_source')

    try {
      if (isDirty && sourceLocale === currentLocale) {
        await onSaveSource()
      }

      setStep('translate')
      setStatuses((current) => ({
        ...current,
        ...Object.fromEntries(localesToProcess.map((item) => [item, 'running'])),
      }))

      const results = await Promise.allSettled(
        localesToProcess.map(async (targetLocale) => {
          await onTranslateLocale(sourceLocale, targetLocale)
          return targetLocale
        }),
      )
      const nextStatuses: Record<string, LocaleStatus> = {}
      const nextErrors: Record<string, string> = {}

      results.forEach((result, index) => {
        const targetLocale = localesToProcess[index]
        if (result.status === 'fulfilled') {
          nextStatuses[targetLocale] = 'completed'
          return
        }

        nextStatuses[targetLocale] = 'failed'
        nextErrors[targetLocale] = errorMessage(result.reason)
      })

      setStatuses((current) => ({ ...current, ...nextStatuses }))
      setErrors(nextErrors)
      setStep('review')
      onComplete()

      if (Object.keys(nextErrors).length) {
        toast.error('Some locales failed. Open the failed locale row for details.', { duration: 8000 })
      } else {
        const plural = localesToProcess.length === 1 ? '' : 's'
        toast.success(`Translation drafts created for ${localesToProcess.length} locale${plural}`)
      }
    } catch (error) {
      setStep('configure')
      toast.error(errorMessage(error), { duration: 8000 })
    }
  }

  return (
    <div className="rounded-lg border border-ui-border-base bg-ui-bg-component shadow-elevation-card-rest lg:col-span-2">
      <div className="space-y-4 p-4">
        <div className="space-y-3">
          <div className="flex items-start gap-3">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-md border border-ui-border-base bg-ui-bg-base text-ui-fg-interactive">
              <Sparkles />
            </div>
            <div className="min-w-0">
              <Text size="small" weight="plus">
                Translation flow
              </Text>
              <Text size="small" leading="compact" className="text-ui-fg-subtle">
                Translate copy, bullets, and specifications from one locale into selected draft locales.
              </Text>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {STEP_LABELS.map((item) => (
              <Text
                key={item.step}
                size="xsmall"
                leading="compact"
                className={`rounded-full border px-2 py-1 ${
                  item.step === step
                    ? 'border-ui-border-interactive text-ui-fg-interactive'
                    : 'border-ui-border-base text-ui-fg-subtle'
                }`}
              >
                {item.label}
              </Text>
            ))}
          </div>

          <Text size="xsmall" leading="compact" className="text-ui-fg-subtle">
            {progressLabel}
            {' / Continue skips completed locales'}
          </Text>
        </div>

        <div className="grid grid-cols-1 gap-3">
          <div className="space-y-1">
            <Text size="xsmall" className="text-ui-fg-subtle">
              From
            </Text>
            <Select
              size="small"
              value={sourceLocale}
              onValueChange={(value) => {
                setSourceLocale(value)
                setStep('configure')
              }}
            >
              <Select.Trigger aria-label="Source locale">
                <Select.Value />
              </Select.Trigger>
              <Select.Content>
                {locales.map((item) => (
                  <Select.Item key={item} value={item}>
                    {item.toUpperCase()}
                  </Select.Item>
                ))}
              </Select.Content>
            </Select>
          </div>

          <div className="min-w-0 space-y-2">
            <div className="flex flex-wrap items-end justify-between gap-2">
              <div className="space-y-1">
                <Text size="xsmall" className="text-ui-fg-subtle">
                  To locales
                </Text>
                <Text size="xsmall" leading="compact" className="text-ui-fg-subtle">
                  {progressLabel}
                </Text>
              </div>

              <div className="flex gap-2">
                <Button
                  size="small"
                  variant="secondary"
                  disabled={disableTargetChanges}
                  onClick={selectAllTargets}
                >
                  Select all
                </Button>
                <Button
                  size="small"
                  variant="secondary"
                  disabled={!visibleErrors.length}
                  onClick={clearErrors}
                >
                  Clear errors
                </Button>
              </div>
            </div>

            <div className="grid max-h-36 grid-cols-1 gap-2 overflow-y-auto rounded-md border border-ui-border-base bg-ui-bg-subtle p-2 sm:grid-cols-2 xl:grid-cols-3">
              {targetOptions.map((targetLocale) => {
                const selected = targetLocales.includes(targetLocale)
                const status = statuses[targetLocale] ?? 'idle'
                return (
                  <button
                    key={targetLocale}
                    type="button"
                    aria-pressed={selected}
                    disabled={disableTargetChanges}
                    className={`inline-flex min-w-0 items-center justify-between gap-2 rounded-md border px-2.5 py-1 text-left text-xs transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
                      selected
                        ? STATUS_CLASSES[status]
                        : 'border-ui-border-base text-ui-fg-muted hover:bg-ui-bg-component-hover'
                    }`}
                    onClick={() => toggleTarget(targetLocale)}
                  >
                    <span className="font-medium">{targetLocale.toUpperCase()}</span>
                    <span className="opacity-75">{STATUS_LABELS[status]}</span>
                  </button>
                )
              })}
            </div>
          </div>

          <Button size="small" isLoading={isRunning} disabled={!canContinue} onClick={continueFlow}>
            Continue
          </Button>
        </div>

        {visibleErrors.length ? (
          <div className="space-y-1">
            {visibleErrors.map(([targetLocale, message]) => (
              <Text key={targetLocale} size="xsmall" className="text-ui-fg-error">
                {targetLocale.toUpperCase()}: {message}
              </Text>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  )
}

function errorMessage(error: unknown) {
  return getErrorMessage(error)
}
