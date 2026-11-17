import { defineWidgetConfig } from '@medusajs/admin-sdk'
import type { AdminProduct, DetailWidgetProps } from '@medusajs/framework/types'
import { Badge, Button, Container, Heading, Text } from '@medusajs/ui'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { ErrorState } from '../components/ui/error-state'
import { formatList, plural } from '../components/ui/format'
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

const localeLabel = (row: PimContentRow) => row.locale.toUpperCase()

/** "EN-US" or "EN-US and FR-FR": each language once, in the order the rows came. */
function localeList(rows: PimContentRow[]): string {
  return formatList([...new Set(rows.map(localeLabel))])
}

/**
 * Product page card "Product text" (review rank 21, PIM part). It says which text the store
 * shows for this product: the published Product content (PIM) for the listed languages, or the
 * product's own title and description. Its one "Edit text" link goes to whichever wins.
 * Hidden when this product has no Product content at all (the product's own fields win).
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

  const editTo = `/pim?product_id=${encodeURIComponent(product.id)}`

  if (contentQuery.isError) {
    return (
      <Container className="px-6 py-4">
        <ErrorState
          what="this product's Product content"
          error={contentQuery.error}
          onRetry={() => contentQuery.refetch()}
          retrying={contentQuery.isFetching}
        >
          <Text size="small">
            Until it loads, this page cannot tell whether the store shows Product content or this
            product&apos;s own title and description.
          </Text>
        </ErrorState>
      </Container>
    )
  }

  const rows = contentQuery.data?.content ?? []
  const published = rows.filter((row) => row.status === 'published' && overriddenFields(row).length > 0)
  const drafts = rows.filter((row) => row.status === 'draft' || row.status === 'reviewed')

  if (published.length === 0 && drafts.length === 0) {
    return null
  }

  return (
    <Container className="divide-y p-0">
      <div className="flex items-center justify-between gap-3 px-6 py-4">
        <Heading level="h2">Product text</Heading>
        {published.length > 0 ? (
          <Button size="small" variant="secondary" asChild>
            <Link to={editTo}>Edit text</Link>
          </Button>
        ) : null}
      </div>
      <div className="flex flex-col gap-y-3 px-6 py-4">
        {published.length > 0 ? (
          <>
            <Text size="small">
              <span className="font-medium">Your store shows:</span> Product content (
              {localeList(published)}, published).
            </Text>
            <Text size="small" className="text-ui-fg-subtle">
              It replaces this page&apos;s fields for those languages, so edits to the title or
              description here do not appear in the store until you change or unpublish that
              Product content. Other languages show this product&apos;s own text.
            </Text>
            <ul className="flex flex-col gap-y-1">
              {published.map((row) => (
                <li key={row.id} className="flex flex-wrap items-center gap-x-2">
                  <Badge size="2xsmall" color="green">
                    {localeLabel(row)}
                  </Badge>
                  <Text size="small" className="text-ui-fg-subtle">
                    {row.channel}: replaces {formatList(overriddenFields(row))}
                  </Text>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <Text size="small">
            <span className="font-medium">Your store shows:</span> this product&apos;s own title and
            description. To change them, use Edit on this product.
          </Text>
        )}
        {drafts.length > 0 ? (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <Text size="small" className="text-ui-fg-subtle">
              {plural(drafts.length, 'Product content draft')} not published ({localeList(drafts)}).
              Drafts do not change the store.
            </Text>
            {published.length === 0 ? (
              <Link
                to={editTo}
                className="txt-compact-small-plus text-ui-fg-interactive hover:text-ui-fg-interactive-hover"
              >
                {drafts.length === 1 ? 'Open draft' : 'Open drafts'}
              </Link>
            ) : null}
          </div>
        ) : null}
      </div>
    </Container>
  )
}

export const config = defineWidgetConfig({
  zone: 'product.details.side.before',
})

export default ProductContentOverrideWidget
