import { Text } from '@medusajs/ui'
import { statusBadge, type AdminProduct, type PimContent } from './shared'

interface ProductEditorHeaderProps {
  content: PimContent | undefined
  product: AdminProduct | null
  productId: string
}

const MISSING_SKU_LABEL = 'No SKU'
function getPrimarySku(product: AdminProduct | null) {
  return product?.variants?.find((variant) => Boolean(variant.sku))?.sku ?? null
}

export function ProductEditorHeader({
  content,
  product,
  productId,
}: ProductEditorHeaderProps) {
  const sku = getPrimarySku(product)

  return (
    <div className="sticky top-0 z-20 shrink-0 border-b border-ui-border-base bg-ui-bg-base">
      <div className="px-4 py-3">
        <div className="min-w-0 space-y-1">
          <div className="flex min-w-0 items-center gap-2">
            <Text size="base" weight="plus" className="truncate" title={product?.title}>
              {product?.title ?? 'Select a product'}
            </Text>
            {statusBadge(content?.status)}
          </div>
          <Text size="xsmall" leading="compact" className="truncate text-ui-fg-subtle">
            {sku ?? MISSING_SKU_LABEL} · {productId || 'Choose a product'}
          </Text>
        </div>
      </div>
    </div>
  )
}
