import { defineWidgetConfig } from '@medusajs/admin-sdk'
import type { AdminProduct, DetailWidgetProps } from '@medusajs/framework/types'
import { Badge, Container, Heading, Text } from '@medusajs/ui'
import { useQuery } from '@tanstack/react-query'
import { sdk } from '../lib/sdk'

type PimContentRow = {
  id: string
  locale: string
  channel: string
  status: 'draft' | 'reviewed' | 'published' | 'archived'
  title?: string | null
  description?: string | null
  short_description?: string | null
}

function hasText(value: unknown): boolean {
  return typeof value === 'string' && value.trim().length > 0
}

function overriddenFields(row: PimContentRow): string[] {
  const fields: string[] = []
  if (hasText(row.title)) fields.push('title')
  if (hasText(row.description)) fields.push('description')
  if (hasText(row.short_description)) fields.push('subtitle')
  return fields
}

/**
 * Product page notice: when published "Product content" (PIM) exists for this
 * product, the storefront shows that copy instead of the title / description
 * edited here, for the listed languages. Hidden when nothing overrides.
 */
const ProductContentOverrideWidget = ({ data: product }: DetailWidgetProps<AdminProduct>) => {
  const contentQuery = useQuery({
    queryKey: ['pim-product-override', product.id],
    queryFn: () => {
      const query = new URLSearchParams({ product_id: product.id, limit: '100' })
      return sdk.client.fetch<{ content: PimContentRow[] }>(`/admin/pim/content?${query.toString()}`)
    },
    retry: false,
  })

  const rows = contentQuery.data?.content ?? []
  const published = rows.filter((row) => row.status === 'published' && overriddenFields(row).length > 0)
  const drafts = rows.filter((row) => row.status === 'draft' || row.status === 'reviewed')

  if (contentQuery.isError || (published.length === 0 && drafts.length === 0)) {
    return null
  }

  const editHref = `/app/pim?product_id=${encodeURIComponent(product.id)}`

  return (
    <Container className="divide-y p-0">
      <div className="flex items-center justify-between px-6 py-4">
        <Heading level="h2">Product content</Heading>
        <a href={editHref} className="txt-compact-small-plus text-ui-fg-interactive hover:underline">
          Edit product content
        </a>
      </div>
      <div className="flex flex-col gap-y-3 px-6 py-4">
        {published.length > 0 ? (
          <>
            <Text size="small">
              The storefront shows the published product content below instead of this
              page&apos;s fields for these languages. Edits to the title or description here
              will not appear there until you change or unpublish that content.
            </Text>
            <ul className="flex flex-col gap-y-1">
              {published.map((row) => (
                <li key={row.id} className="flex flex-wrap items-center gap-x-2">
                  <Badge size="2xsmall" color="green">
                    {row.locale}
                  </Badge>
                  <Text size="small" className="text-ui-fg-subtle">
                    {row.channel}: replaces {overriddenFields(row).join(', ')}
                  </Text>
                </li>
              ))}
            </ul>
          </>
        ) : null}
        {drafts.length > 0 ? (
          <Text size="small" className="text-ui-fg-subtle">
            {drafts.length} unpublished draft{drafts.length === 1 ? '' : 's'} (
            {drafts.map((row) => row.locale).join(', ')}). Drafts do not change the storefront.
          </Text>
        ) : null}
      </div>
    </Container>
  )
}

export const config = defineWidgetConfig({
  zone: 'product.details.side.before',
})

export default ProductContentOverrideWidget
