import { cloneElement, isValidElement, useId, type ReactNode } from 'react'
import { Badge, Input, Label, Text, Textarea } from '@medusajs/ui'

const SEO_TITLE_MIN_LENGTH = 45
const SEO_TITLE_MAX_LENGTH = 60
const SEO_DESCRIPTION_MIN_LENGTH = 120
const SEO_DESCRIPTION_MAX_LENGTH = 160

interface SeoFieldsPanelProps {
  title: string
  description: string
  keywords: string
  productTitle: string | null
  onTitleChange: (value: string) => void
  onDescriptionChange: (value: string) => void
  onKeywordsChange: (value: string) => void
}

export function SeoFieldsPanel({
  title,
  description,
  keywords,
  productTitle,
  onTitleChange,
  onDescriptionChange,
  onKeywordsChange,
}: SeoFieldsPanelProps) {
  const keywordsInputId = useId()
  const keywordItems = keywords
    .split(',')
    .map((keyword) => keyword.trim())
    .filter((keyword) => Boolean(keyword))
  const previewTitle = getPreviewValue(title, productTitle, 'Product title')
  const previewDescription = getPreviewValue(
    description,
    null,
    'Add a concise product description to preview how this page may appear in search results.',
  )

  return (
    <div className="space-y-4">
      <div className="border-b border-ui-border-base pb-2">
        <Text size="base" weight="plus">
          SEO Optimization
        </Text>
        <Text size="small" leading="compact" className="text-ui-fg-subtle">
          Tune the search snippet for the selected locale and channel.
        </Text>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <SeoTextField
          label="SEO title"
          value={title}
          minLength={SEO_TITLE_MIN_LENGTH}
          maxLength={SEO_TITLE_MAX_LENGTH}
          guidance="Aim for a clear product phrase that can fit in search results."
        >
          <Input
            value={title}
            onChange={(event) => onTitleChange(event.target.value)}
            placeholder="Funny cat graphic t-shirt"
          />
        </SeoTextField>

        <div className="flex flex-col gap-y-2">
          <Label htmlFor={keywordsInputId}>Focus keywords</Label>
          <Input
            id={keywordsInputId}
            value={keywords}
            onChange={(event) => onKeywordsChange(event.target.value)}
            placeholder="funny cat t-shirt, 3D print shirt, casual graphic tee"
          />
          <Text size="small" leading="compact" className="text-ui-fg-subtle">
            Use comma-separated search phrases customers would actually type.
          </Text>
          {keywordItems.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {keywordItems.map((keyword) => (
                <Badge key={keyword} size="2xsmall" color="grey">
                  {keyword}
                </Badge>
              ))}
            </div>
          )}
        </div>
      </div>

      <SeoTextField
        label="SEO description"
        value={description}
        minLength={SEO_DESCRIPTION_MIN_LENGTH}
        maxLength={SEO_DESCRIPTION_MAX_LENGTH}
        guidance="Summarize the product benefit in one readable sentence."
      >
        <Textarea
          rows={3}
          value={description}
          onChange={(event) => onDescriptionChange(event.target.value)}
          placeholder="A playful graphic tee with a standout cat print, designed for everyday casual outfits."
        />
      </SeoTextField>

      <div className="rounded-lg border border-ui-border-base bg-ui-bg-component p-4">
        <Text size="small" leading="compact" weight="plus">
          Search result preview
        </Text>
        <div className="mt-3 space-y-1">
          <Text size="small" leading="compact" weight="plus" className="text-ui-fg-interactive">
            {previewTitle}
          </Text>
          <Text size="small" leading="compact" className="text-ui-fg-subtle">
            {previewDescription}
          </Text>
        </div>
      </div>
    </div>
  )
}

interface SeoTextFieldProps {
  label: string
  value: string
  minLength: number
  maxLength: number
  guidance: string
  children: ReactNode
}

function SeoTextField({ label, value, minLength, maxLength, guidance, children }: SeoTextFieldProps) {
  const fieldId = useId()
  const characterCount = value.length
  const counterClassName = getCounterClassName(characterCount, minLength, maxLength)
  const fieldChildren = isValidElement<{ id?: string }>(children) && children.props.id === undefined
    ? cloneElement(children, { id: fieldId })
    : children

  return (
    <div className="flex flex-col gap-y-2">
      <div className="flex items-center justify-between gap-3">
        <Label htmlFor={fieldId}>{label}</Label>
        <Text size="small" leading="compact" className={counterClassName}>
          {characterCount}/{maxLength}
        </Text>
      </div>
      {fieldChildren}
      <Text size="small" leading="compact" className="text-ui-fg-subtle">
        Recommended: {minLength}-{maxLength} characters. {guidance}
      </Text>
    </div>
  )
}

function getCounterClassName(characterCount: number, minLength: number, maxLength: number) {
  if (characterCount === 0) {
    return 'text-ui-fg-subtle'
  }

  if (characterCount < minLength) {
    return 'text-ui-fg-warning'
  }

  if (characterCount > maxLength) {
    return 'text-ui-fg-error'
  }

  return 'text-ui-fg-success'
}

function getPreviewValue(value: string, secondaryValue: string | null, emptyValue: string) {
  const trimmedValue = value.trim()
  if (trimmedValue.length > 0) {
    return trimmedValue
  }

  const trimmedSecondaryValue = secondaryValue?.trim()
  if (trimmedSecondaryValue && trimmedSecondaryValue.length > 0) {
    return trimmedSecondaryValue
  }

  return emptyValue
}
