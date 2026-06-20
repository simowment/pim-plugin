import { useEffect, useState } from 'react'
import { Checkbox, Input, Label, Select, Switch, Text, Textarea } from '@medusajs/ui'
import { isMetadataValue, type MetadataField, type MetadataValue } from './shared'

const JSON_INDENT_SPACES = 2
const TEXTAREA_ROWS = 3

interface MetadataFieldInputProps {
  field: MetadataField
  value: MetadataValue | undefined
  onChange: (value: MetadataValue) => void
  onErrorChange?: (message: string) => void
}

export function MetadataFieldInput({ field, value, onChange, onErrorChange }: MetadataFieldInputProps) {
  const [jsonDraft, setJsonDraft] = useState(() => formatJsonValue(value))
  const [jsonError, setJsonError] = useState('')
  const textValue = value === undefined || value === null ? '' : String(value)
  const selectedValues = Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : []

  useEffect(() => {
    if (field.type === 'json') {
      setJsonDraft(formatJsonValue(value))
      setJsonError('')
      onErrorChange?.('')
    }
  }, [field.key, field.type, value])

  if (field.type === 'boolean') {
    return (
      <div className="flex items-center gap-2 py-1">
        <Switch checked={value === true} onCheckedChange={(checked) => onChange(checked)} />
        <Text size="small">{value === true ? 'Yes' : 'No'}</Text>
      </div>
    )
  }

  if (field.type === 'text') {
    return <Textarea rows={TEXTAREA_ROWS} value={textValue} onChange={(event) => onChange(event.target.value)} />
  }

  if (field.type === 'select') {
    return (
      <Select size="small" value={textValue} onValueChange={onChange}>
        <Select.Trigger aria-label={field.label}>
          <Select.Value placeholder="Select an option" />
        </Select.Trigger>
        <Select.Content>
          {field.options_json?.map((option) => (
            <Select.Item key={option.value} value={option.value}>
              {option.label}
            </Select.Item>
          ))}
        </Select.Content>
      </Select>
    )
  }

  if (field.type === 'multiselect') {
    return (
      <div className="flex flex-col gap-2">
        {field.options_json?.map((option) => {
          const checked = selectedValues.includes(option.value)
          return (
            <div key={option.value} className="flex items-center gap-2">
              <Checkbox
                id={`${field.id}-${option.value}`}
                checked={checked}
                onCheckedChange={(nextChecked) =>
                  onChange(
                    nextChecked
                      ? [...selectedValues, option.value]
                      : selectedValues.filter((selectedValue) => selectedValue !== option.value),
                  )
                }
              />
              <Label htmlFor={`${field.id}-${option.value}`}>{option.label}</Label>
            </div>
          )
        })}
      </div>
    )
  }

  if (field.type === 'json') {
    return (
      <div className="flex flex-col gap-2">
        <Textarea
          rows={TEXTAREA_ROWS}
          value={jsonDraft}
          onChange={(event) => {
            const nextValue = event.target.value
            setJsonDraft(nextValue)
            if (!nextValue.trim()) {
              setJsonError('')
              onErrorChange?.('')
              onChange(null)
              return
            }

            try {
              const parsedValue: unknown = JSON.parse(nextValue)
              if (!isMetadataValue(parsedValue)) {
                const message = 'JSON value must contain only serializable values.'
                setJsonError(message)
                onErrorChange?.(message)
                return
              }

              onChange(parsedValue)
              setJsonError('')
              onErrorChange?.('')
            } catch {
              const message = 'Enter valid JSON before saving.'
              setJsonError(message)
              onErrorChange?.(message)
            }
          }}
        />
        {jsonError && (
          <Text size="xsmall" className="text-ui-fg-error">
            {jsonError}
          </Text>
        )}
      </div>
    )
  }

  return (
    <Input
      type={field.type === 'number' ? 'number' : 'text'}
      value={textValue}
      onChange={(event) => {
        const nextValue = event.target.value
        onChange(field.type === 'number' ? (nextValue === '' ? null : Number(nextValue)) : nextValue)
      }}
    />
  )
}

function formatJsonValue(value: MetadataValue | undefined): string {
  if (value === undefined) {
    return ''
  }

  if (typeof value === 'string') {
    return value
  }

  return JSON.stringify(value, null, JSON_INDENT_SPACES)
}
