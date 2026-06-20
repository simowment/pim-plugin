import { Select, Text } from '@medusajs/ui'
import { statusBadge, type AdminProduct, type PimContent } from './shared'

interface ProductEditorHeaderProps {
  channels: string[]
  channel: string
  content: PimContent | undefined
  locale: string
  locales: string[]
  product: AdminProduct | null
  productId: string
  onChannelSelect: (channel: string) => boolean | void
  onLocaleSelect: (locale: string) => boolean | void
}

const MISSING_SKU_LABEL = 'No SKU'
const PRODUCT_TITLE_STYLE = {
  display: '-webkit-box',
  WebkitBoxOrient: 'vertical',
  WebkitLineClamp: 2,
} as const

function getPrimarySku(product: AdminProduct | null) {
  return product?.variants?.find((variant) => Boolean(variant.sku))?.sku ?? null
}

export function ProductEditorHeader({
  channels,
  channel,
  content,
  locale,
  locales,
  product,
  productId,
  onChannelSelect,
  onLocaleSelect,
}: ProductEditorHeaderProps) {
  const sku = getPrimarySku(product)

  return (
    <div className="border-ui-border-base bg-ui-bg-base sticky top-0 z-20 shrink-0 border-b">
      <div className="flex flex-col gap-3 px-4 py-3 sm:px-6 sm:py-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 space-y-2">
            <div className="min-w-0">
              <Text
                size="large"
                weight="plus"
                className="overflow-hidden"
                style={PRODUCT_TITLE_STYLE}
                title={product?.title}
              >
                {product?.title ?? 'Select a product'}
              </Text>
              <Text size="xsmall" className="text-ui-fg-subtle">
                {productId || 'Choose a product to edit localized copy.'}
              </Text>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="border-ui-border-base bg-ui-bg-subtle text-ui-fg-subtle rounded-md border px-2 py-1 text-xs">
                SKU: {sku ?? MISSING_SKU_LABEL}
              </span>
              <span className="border-ui-border-base bg-ui-bg-subtle text-ui-fg-subtle rounded-md border px-2 py-1 text-xs">
                Locale: {locale.toUpperCase()}
              </span>
              <span className="border-ui-border-base bg-ui-bg-subtle text-ui-fg-subtle rounded-md border px-2 py-1 text-xs">
                Channel: {channel}
              </span>
              <span className="border-ui-border-base bg-ui-bg-subtle text-ui-fg-subtle flex items-center gap-2 rounded-md border px-2 py-1 text-xs">
                Product status {statusBadge(content?.status)}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 lg:w-[22rem]">
            <Select size="small" value={locale} onValueChange={onLocaleSelect}>
              <Select.Trigger aria-label="Locale">
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
            <Select size="small" value={channel} onValueChange={onChannelSelect}>
              <Select.Trigger aria-label="Channel">
                <Select.Value />
              </Select.Trigger>
              <Select.Content>
                {channels.map((item) => (
                  <Select.Item key={item} value={item}>
                    {item}
                  </Select.Item>
                ))}
              </Select.Content>
            </Select>
          </div>
        </div>
      </div>
    </div>
  )
}
