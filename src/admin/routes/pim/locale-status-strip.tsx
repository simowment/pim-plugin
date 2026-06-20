import { useState } from 'react'
import { Button, Drawer, Text } from '@medusajs/ui'
import { statusBadge, type PimContent } from './shared'

const DRAWER_SIDE_INSET_PX = 8
const DRAWER_LAYER_Z_INDEX = 100
const COMPLETION_FIELD_COUNT = 7

interface LocaleStatusStripProps {
  channel: string
  contents: PimContent[] | undefined
  locale: string
  locales: string[]
  onLocaleSelect: (locale: string) => boolean | void
}

export function LocaleStatusStrip({
  channel,
  contents,
  locale,
  locales,
  onLocaleSelect,
}: LocaleStatusStripProps) {
  const [open, setOpen] = useState(false)

  const localeRows = locales.map((item) => {
    const match = contents?.find(
      (content) =>
        content.locale === item &&
        content.channel === channel &&
        content.status !== 'archived'
    )

    return {
      code: item,
      content: match,
      completion: getCompletionPercent(match),
    }
  })

  const activeLocaleCount = localeRows.filter((row) => Boolean(row.content)).length
  const currentLocale = localeRows.find((row) => row.code === locale)

  const handleLocaleSelect = (item: string) => {
    if (onLocaleSelect(item) !== false) {
      setOpen(false)
    }
  }

  return (
    <>
      <div className="order-1 border-b border-ui-border-base bg-ui-bg-subtle px-4 py-3 xl:hidden">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <Text size="small" leading="compact" weight="plus">
              Locales {activeLocaleCount}/{locales.length}
            </Text>
            <Text size="xsmall" leading="compact" className="truncate text-ui-fg-subtle">
              {locale.toUpperCase()} - {currentLocale?.completion ?? 0}% complete
            </Text>
          </div>
          <Button size="small" variant="secondary" className="shrink-0" onClick={() => setOpen(true)}>
            Manage
          </Button>
        </div>

        <Drawer open={open} onOpenChange={setOpen}>
          <Drawer.Content
            className="bg-ui-bg-base shadow-elevation-flyout"
            style={{
              left: DRAWER_SIDE_INSET_PX,
              right: DRAWER_SIDE_INSET_PX,
              width: 'auto',
              maxWidth: 'none',
              transform: 'none',
              animation: 'none',
              zIndex: DRAWER_LAYER_Z_INDEX,
            }}
          >
            <Drawer.Header>
              <div className="flex items-center justify-between gap-3">
                <Drawer.Title>Locale status</Drawer.Title>
                <Drawer.Close asChild>
                  <Button size="small" variant="secondary">
                    Done
                  </Button>
                </Drawer.Close>
              </div>
              <Drawer.Description className="sr-only">
                Select the localized product content to edit.
              </Drawer.Description>
            </Drawer.Header>
            <Drawer.Body className="p-4">
              <LocaleRows
                localeRows={localeRows}
                selectedLocale={locale}
                onLocaleSelect={handleLocaleSelect}
              />
            </Drawer.Body>
          </Drawer.Content>
        </Drawer>
      </div>

      <div className="order-2 hidden border-l border-ui-border-base bg-ui-bg-subtle px-3 py-4 xl:block">
        <Text size="small" leading="compact" weight="plus">
          Locales {activeLocaleCount}/{locales.length}
        </Text>
        <LocaleRows
          localeRows={localeRows}
          selectedLocale={locale}
          onLocaleSelect={onLocaleSelect}
        />
      </div>
    </>
  )
}

interface LocaleRow {
  code: string
  content: PimContent | undefined
  completion: number
}

interface LocaleRowsProps {
  localeRows: LocaleRow[]
  selectedLocale: string
  onLocaleSelect: (locale: string) => boolean | void
}

function LocaleRows({ localeRows, selectedLocale, onLocaleSelect }: LocaleRowsProps) {
  return (
    <div className="mt-2 flex flex-col gap-2">
      {localeRows.map((row) => (
        <button
          key={row.code}
          className={`w-full rounded-md border px-3 py-2 text-left transition-colors outline-none hover:bg-ui-bg-component-hover focus-visible:shadow-borders-interactive-with-focus ${
          selectedLocale === row.code
            ? 'border-ui-border-strong bg-ui-bg-component shadow-elevation-card-rest'
            : 'border-transparent'
        }`}
          aria-current={selectedLocale === row.code ? 'page' : undefined}
          onClick={() => onLocaleSelect(row.code)}
        >
          <div className="flex items-center justify-between gap-2">
            <Text size="small" leading="compact" weight="plus">
              {row.code.toUpperCase()}
            </Text>
            {statusBadge(row.content?.status)}
          </div>
          <div className="mt-1 flex items-center justify-between gap-2">
            <Text size="xsmall" leading="compact" className="text-ui-fg-subtle">
              {row.content ? `${row.completion}% complete` : 'No localized copy'}
            </Text>
            <Text size="xsmall" leading="compact" weight="plus">
              {row.content ? 'Continue' : 'Create'}
            </Text>
          </div>
        </button>
      ))}
    </div>
  )
}

function getCompletionPercent(content: PimContent | undefined) {
  if (!content) {
    return 0
  }

  const completedFields = [
    content.title,
    content.short_description,
    content.description,
    content.bullets_json?.length,
    content.specifications_json?.length,
    content.seo_json?.title,
    content.seo_json?.description,
  ].filter((value) => Boolean(value)).length

  return Math.round((completedFields / COMPLETION_FIELD_COUNT) * 100)
}
