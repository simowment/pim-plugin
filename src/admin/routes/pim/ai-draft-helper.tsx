import { Sparkles } from '@medusajs/icons'
import { Button, Select, Text } from '@medusajs/ui'
import { AiNotReadyNotice, type PimAiStatus } from './ai-status'
import { isAiMode, isAiTone, type AiMode, type AiTone } from './shared'

interface AiDraftHelperProps {
  mode: AiMode
  tone: AiTone
  targetLocale: string
  isGenerating: boolean
  aiStatus: PimAiStatus
  onOpenAiSetup?: () => void
  onModeChange: (value: AiMode) => void
  onToneChange: (value: AiTone) => void
  onGenerate: () => void
}

const MODE_HELP: Partial<Record<AiMode, string>> = {
  rewrite: 'Rewrites the current title and descriptions in the chosen tone.',
  extract_specs: 'Reads the description and lists product facts as specifications.',
  seo: 'Writes the search-engine title and description.',
  full: 'Writes every part: copy, highlights, specifications and SEO.',
}

/** AI drafting for the language being edited. Translation has its own panel. */
export function AiDraftHelper({
  mode,
  tone,
  targetLocale,
  isGenerating,
  aiStatus,
  onOpenAiSetup,
  onModeChange,
  onToneChange,
  onGenerate,
}: AiDraftHelperProps) {
  return (
    <div className="rounded-lg border border-ui-border-base bg-ui-bg-component p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-ui-fg-interactive">
            <Sparkles />
            <Text size="small" weight="plus">
              Write with AI ({targetLocale.toUpperCase()})
            </Text>
          </div>
          <Text size="small" leading="compact" className="text-ui-fg-subtle">
            Creates a draft in the AI review queue. Nothing changes on the storefront until you
            accept it there and publish.
          </Text>
        </div>
        <Button
          size="small"
          isLoading={isGenerating}
          disabled={isGenerating || !aiStatus.ready}
          onClick={onGenerate}
          className="w-full shrink-0 lg:w-auto"
        >
          Create AI draft
        </Button>
      </div>

      <div className="mt-3">
        <AiNotReadyNotice status={aiStatus} onOpenAiSetup={onOpenAiSetup} />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Text size="xsmall" className="text-ui-fg-subtle">
            What to write
          </Text>
          <Select
            size="small"
            value={mode}
            disabled={!aiStatus.ready}
            onValueChange={(value) => {
              if (isAiMode(value)) {
                onModeChange(value)
              }
            }}
          >
            <Select.Trigger aria-label="What to write">
              <Select.Value />
            </Select.Trigger>
            <Select.Content>
              <Select.Item value="rewrite">Rewrite the current copy</Select.Item>
              <Select.Item value="extract_specs">Find specifications</Select.Item>
              <Select.Item value="seo">SEO title and description</Select.Item>
              <Select.Item value="full">Everything</Select.Item>
            </Select.Content>
          </Select>
        </div>

        <div className="flex flex-col gap-1.5">
          <Text size="xsmall" className="text-ui-fg-subtle">
            Tone
          </Text>
          <Select
            size="small"
            value={tone}
            disabled={!aiStatus.ready}
            onValueChange={(value) => {
              if (isAiTone(value)) {
                onToneChange(value)
              }
            }}
          >
            <Select.Trigger aria-label="Tone">
              <Select.Value />
            </Select.Trigger>
            <Select.Content>
              <Select.Item value="neutral">Clean and neutral</Select.Item>
              <Select.Item value="luxury">Premium and expressive</Select.Item>
              <Select.Item value="technical">Technical and factual</Select.Item>
              <Select.Item value="seo">Search optimized</Select.Item>
            </Select.Content>
          </Select>
        </div>
      </div>

      {MODE_HELP[mode] && (
        <Text size="xsmall" leading="compact" className="text-ui-fg-subtle mt-3">
          {MODE_HELP[mode]}
        </Text>
      )}
    </div>
  )
}
