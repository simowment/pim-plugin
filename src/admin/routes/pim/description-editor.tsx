import { useEffect, useId, useRef, useState } from 'react'
import { Label, Text, Textarea } from '@medusajs/ui'

/**
 * The product description is stored as HTML (the storefront renders it). Most descriptions
 * are only paragraphs, so the editor shows them as plain paragraphs (a blank line starts a new
 * one) and writes `<p>` tags back. A description with other formatting (lists, bold, links,
 * headings) opens in the HTML view so that formatting is not lost.
 */

const ENTITIES: Record<string, string> = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
  '&#039;': "'",
  '&apos;': "'",
  '&nbsp;': ' ',
}

const decode = (text: string) =>
  text.replace(/&(amp|lt|gt|quot|#0?39|apos|nbsp);/g, (entity) => ENTITIES[entity] ?? entity)

const encode = (text: string) =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

/** True when the HTML holds nothing but text, `<p>` and `<br>` (so paragraphs lose nothing). */
export function isParagraphHtml(html: string): boolean {
  const withoutSimpleTags = html.replace(/<\/?p(\s[^>]*)?>|<br\s*\/?>/gi, '')
  return !/<[a-z!/]/i.test(withoutSimpleTags)
}

export function htmlToParagraphs(html: string): string {
  if (!html.trim()) return ''
  if (!/<[a-z/]/i.test(html)) return html // plain text, stored without tags
  return html
    .split(/<\/p\s*>/i)
    .map((block) =>
      decode(
        block
          .replace(/<p(\s[^>]*)?>/gi, '')
          .replace(/<br\s*\/?>/gi, '\n')
          .trim(),
      ),
    )
    .filter((block) => block.length > 0)
    .join('\n\n')
}

export function paragraphsToHtml(text: string): string {
  return text
    .split(/\n\s*\n/)
    .map((block) => block.trim())
    .filter((block) => block.length > 0)
    .map((block) => `<p>${encode(block).replace(/\n/g, '<br>')}</p>`)
    .join('\n')
}

type Mode = 'paragraphs' | 'html'

export function DescriptionEditor({
  value,
  placeholder,
  onChange,
}: {
  value: string
  /** Shown in grey when empty, e.g. the base-language text (HTML). */
  placeholder?: string
  onChange: (html: string) => void
}) {
  const id = useId()
  const simple = isParagraphHtml(value)
  const [mode, setMode] = useState<Mode>(simple ? 'paragraphs' : 'html')
  const [text, setText] = useState(() => htmlToParagraphs(value))
  // The HTML this editor last wrote; any other value came from outside (new product, AI draft).
  const lastEmitted = useRef(value)

  useEffect(() => {
    if (value === lastEmitted.current) return
    lastEmitted.current = value
    setText(htmlToParagraphs(value))
    if (!isParagraphHtml(value)) setMode('html')
  }, [value])

  const emit = (html: string) => {
    lastEmitted.current = html
    onChange(html)
  }

  const canUseParagraphs = mode === 'paragraphs' || simple

  return (
    <div className="flex flex-col gap-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Label htmlFor={id}>Description</Label>
        <div role="radiogroup" aria-label="Description view" className="flex gap-1">
          {(['paragraphs', 'html'] as const).map((option) => {
            const disabled = option === 'paragraphs' && !canUseParagraphs
            return (
              <button
                key={option}
                type="button"
                role="radio"
                aria-checked={mode === option}
                disabled={disabled}
                title={
                  disabled
                    ? 'This description uses formatting such as lists, bold or links. Edit it as HTML to keep that formatting.'
                    : undefined
                }
                onClick={() => {
                  if (option === 'paragraphs') setText(htmlToParagraphs(value))
                  setMode(option)
                }}
                className={`txt-compact-xsmall-plus focus-visible:shadow-borders-focus rounded-md px-2 py-1 outline-none disabled:cursor-not-allowed disabled:opacity-50 ${
                  mode === option
                    ? 'bg-ui-bg-base text-ui-fg-base shadow-buttons-neutral'
                    : 'text-ui-fg-subtle hover:text-ui-fg-base'
                }`}
              >
                {option === 'paragraphs' ? 'Paragraphs' : 'HTML'}
              </button>
            )
          })}
        </div>
      </div>
      {mode === 'paragraphs' ? (
        <Textarea
          id={id}
          rows={7}
          value={text}
          placeholder={placeholder ? htmlToParagraphs(placeholder) : undefined}
          onChange={(event) => {
            setText(event.target.value)
            emit(paragraphsToHtml(event.target.value))
          }}
        />
      ) : (
        <Textarea
          id={id}
          rows={9}
          className="font-mono"
          value={value}
          placeholder={placeholder}
          onChange={(event) => emit(event.target.value)}
        />
      )}
      <Text size="xsmall" className="text-ui-fg-subtle">
        {mode === 'paragraphs'
          ? 'Leave a blank line between paragraphs. The store shows each one as its own paragraph.'
          : 'The store renders this HTML. Scripts, styles and embedded frames are never shown.'}
      </Text>
    </div>
  )
}
