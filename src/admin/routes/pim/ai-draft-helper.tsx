import { Sparkles } from '@medusajs/icons'
import { Button, Checkbox, Label, Select, Text } from '@medusajs/ui'
import { TRANSLATE_FIELDS, isAiMode, isAiTone, type AiMode, type AiTone, type TranslateField } from './shared'

interface AiDraftHelperProps {
  mode: AiMode
  tone: AiTone
  sourceLocale: string
  targetLocale: string
  locales: string[]
  translateFields: TranslateField[]
  isGenerating: boolean
  onModeChange: (value: AiMode) => void
  onToneChange: (value: AiTone) => void
  onSourceLocaleChange: (value: string) => void
  onTranslateFieldsChange: (value: TranslateField[]) => void
  onGenerate: () => void
}

const TRANSLATE_FIELD_LABELS: Record<TranslateField, string> = {
  title: 'Title',
  description: 'Description',
  short_description: 'Short description',
  specifications: 'Specifications',
}

export function AiDraftHelper({
  mode,
  tone,
  sourceLocale,
  targetLocale,
  locales,
  translateFields,
  isGenerating,
  onModeChange,
  onToneChange,
  onSourceLocaleChange,
  onTranslateFieldsChange,
  onGenerate,
}: AiDraftHelperProps) {
  const sourceLocales = locales.filter((item) => item !== targetLocale)
  const isTranslateMode = mode === 'translate'
  const isSourceLocaleInvalid = isTranslateMode && sourceLocale === targetLocale
  const hasTranslateFields = !isTranslateMode || translateFields.length > 0
  const setTranslateField = (field: TranslateField, checked: boolean) => {
    onTranslateFieldsChange(
      checked ? [...new Set([...translateFields, field])] : translateFields.filter((item) => item !== field),
    )
  }

  return (
    <div className="rounded-lg border border-ui-border-base bg-ui-bg-component p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-ui-fg-interactive">
            <Sparkles />
            <Text size="small" weight="plus">
              AI Draft Helper
            </Text>
          </div>
          <Text size="small" leading="compact" className="text-ui-fg-subtle">
            Create an editable draft for the selected product. Completed drafts appear in the AI Review Queue before you save them.
          </Text>
        </div>
        <Button
          size="small"
          isLoading={isGenerating}
          disabled={isGenerating || isSourceLocaleInvalid || !hasTranslateFields}
          onClick={onGenerate}
          className="w-full shrink-0 lg:w-auto"
        >
          Generate draft
        </Button>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div className="flex flex-col gap-1.5">
          <Text size="xsmall" className="text-ui-fg-subtle">Task</Text>
          <Select
            size="small"
            value={mode}
            onValueChange={(value) => {
              if (isAiMode(value)) {
                onModeChange(value)
              }
            }}
          >
            <Select.Trigger aria-label="Task">
              <Select.Value />
            </Select.Trigger>
            <Select.Content>
              <Select.Item value="translate">Translate copy</Select.Item>
              <Select.Item value="rewrite">Rewrite current copy</Select.Item>
              <Select.Item value="extract_specs">Extract specifications</Select.Item>
              <Select.Item value="seo">Generate SEO copy</Select.Item>
              <Select.Item value="full">Generate full draft</Select.Item>
            </Select.Content>
          </Select>
        </div>

        <div className="flex flex-col gap-1.5">
          <Text size="xsmall" className="text-ui-fg-subtle">Tone</Text>
          <Select
            size="small"
            value={tone}
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

        {isTranslateMode && (
          <div className="flex flex-col gap-1.5 sm:col-span-2 lg:col-span-1">
            <Text size="xsmall" className="text-ui-fg-subtle">Source locale</Text>
            <Select size="small" value={sourceLocale} onValueChange={onSourceLocaleChange}>
              <Select.Trigger aria-label="Source locale">
                <Select.Value />
              </Select.Trigger>
              <Select.Content>
                {sourceLocales.map((item) => (
                  <Select.Item key={item} value={item}>
                    {item.toUpperCase()}
                  </Select.Item>
                ))}
              </Select.Content>
            </Select>
          </div>
        )}
      </div>

      {isTranslateMode && (
        <div className="mt-4 space-y-2 rounded-md border border-ui-border-base bg-ui-bg-subtle p-3">
          <Text size="xsmall" className="text-ui-fg-subtle">Translate fields</Text>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {TRANSLATE_FIELDS.map((field) => (
              <div key={field} className="flex items-center gap-2">
                <Checkbox
                  id={`translate-${field}`}
                  checked={translateFields.includes(field)}
                  onCheckedChange={(checked) => setTranslateField(field, Boolean(checked))}
                />
                <Label htmlFor={`translate-${field}`}>{TRANSLATE_FIELD_LABELS[field]}</Label>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-3 flex flex-wrap gap-2 text-ui-fg-subtle">
        <Text size="small" leading="compact">
          Target locale: {targetLocale.toUpperCase()}
        </Text>
        {isTranslateMode && (
          <Text size="small" leading="compact">
            Source locale is only used for translation drafts.
          </Text>
        )}
      </div>
    </div>
  )
}
