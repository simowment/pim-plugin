import { Button, Container, Input, Text } from '@medusajs/ui'
import { LoadingState, type AdminProduct } from './shared'

const PRODUCT_LIST_HEIGHT_CLASS = 'h-[calc(100vh-14rem)]'
const TITLE_TWO_LINE_STYLE = {
  display: '-webkit-box',
  WebkitBoxOrient: 'vertical',
  WebkitLineClamp: 2,
} as const

export interface ProductListSidebarProps {
  products: AdminProduct[]
  selectedProductId: string
  search: string
  productPage: number
  productsPerPage: number
  productCount: number
  isLoading: boolean
  onProductSelect: (id: string) => boolean | void
  onSearchChange: (value: string) => void
  onPreviousPage: () => void
  onNextPage: () => void
  className?: string
  variant?: 'sidebar' | 'drawer'
}

export function ProductListSidebar({
  products,
  selectedProductId,
  search,
  productPage,
  productsPerPage,
  productCount,
  isLoading,
  onProductSelect,
  onSearchChange,
  onPreviousPage,
  onNextPage,
  className = '',
  variant = 'sidebar',
}: ProductListSidebarProps) {
  const content = (
    <>
      <div className="border-b border-ui-border-base px-6 py-4">
        <div className="flex items-center justify-between gap-3">
          <Text size="small" leading="compact" weight="plus">
            Products
          </Text>
          <Text size="xsmall" leading="compact" className="shrink-0 text-ui-fg-subtle">
            {productCount} total
          </Text>
        </div>
        <div className="mt-3">
          <Input
            placeholder="Search by name, SKU, or handle"
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {isLoading ? (
          <LoadingState />
        ) : (
          <>
            {products.map((product) => (
              <button
                key={product.id}
                className={`flex w-full items-center gap-3 rounded-md border px-3 py-2 text-left transition-colors outline-none focus-visible:shadow-borders-interactive-with-focus ${
                  selectedProductId === product.id
                    ? 'border-ui-border-strong bg-ui-bg-component shadow-elevation-card-rest'
                    : 'border-transparent hover:bg-ui-bg-component-hover'
                }`}
                aria-current={selectedProductId === product.id ? 'page' : undefined}
                onClick={() => onProductSelect(product.id)}
              >
                <div className="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-md border bg-ui-bg-subtle">
                  {product.thumbnail ? (
                    <img src={product.thumbnail} alt="" className="size-full object-cover" />
                  ) : (
                    <Text size="xsmall" className="text-ui-fg-muted">
                      IMG
                    </Text>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <Text
                    size="small"
                    leading="compact"
                    weight="plus"
                    className="overflow-hidden"
                    style={TITLE_TWO_LINE_STYLE}
                    title={product.title}
                  >
                    {product.title}
                  </Text>
                  <Text size="xsmall" leading="compact" className="mt-1 truncate text-ui-fg-subtle">
                    {product.handle ? `Handle: ${product.handle}` : `ID: ${product.id}`}
                  </Text>
                </div>
              </button>
            ))}
            {!products.length && (
              <Text size="small" className="px-4 py-6 text-ui-fg-subtle text-center">
                No products found.
              </Text>
            )}
          </>
        )}
      </div>

      {productCount > productsPerPage && (
        <div className="border-t border-ui-border-base px-4 py-3 flex items-center justify-between bg-ui-bg-subtle">
          <Button
            size="small"
            variant="secondary"
            disabled={productPage === 0}
            onClick={onPreviousPage}
          >
            Prev
          </Button>
          <Text size="xsmall" className="text-ui-fg-subtle">
            Page {productPage + 1} of {Math.ceil(productCount / productsPerPage)}
          </Text>
          <Button
            size="small"
            variant="secondary"
            disabled={(productPage + 1) * productsPerPage >= productCount}
            onClick={onNextPage}
          >
            Next
          </Button>
        </div>
      )}
    </>
  )

  if (variant === 'drawer') {
    return (
      <div className={`flex h-full flex-col overflow-hidden ${className}`}>
        {content}
      </div>
    )
  }

  return (
    <Container className={`flex ${PRODUCT_LIST_HEIGHT_CLASS} flex-col overflow-hidden ${className}`}>
      {content}
    </Container>
  )
}
