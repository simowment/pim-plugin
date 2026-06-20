import { useState } from 'react'
import { Button, Container, Drawer, Text } from '@medusajs/ui'
import { ProductListSidebar, type ProductListSidebarProps } from './product-list-sidebar'
import type { AdminProduct } from './shared'

const DRAWER_SIDE_INSET_PX = 8
const DRAWER_LAYER_Z_INDEX = 100
const SELECTED_TITLE_STYLE = {
  display: '-webkit-box',
  WebkitBoxOrient: 'vertical',
  WebkitLineClamp: 2,
} as const

interface MobileProductPickerProps extends ProductListSidebarProps {
  selectedProduct: AdminProduct | null
}

export function MobileProductPicker({ selectedProduct, onProductSelect, ...listProps }: MobileProductPickerProps) {
  const [open, setOpen] = useState(false)

  const handleProductSelect = (id: string) => {
    if (onProductSelect(id) !== false) {
      setOpen(false)
    }
  }

  return (
    <Container className="overflow-hidden lg:hidden">
      <div className="flex items-center justify-between gap-3 px-4 py-3">
        <div className="min-w-0">
          <Text size="small" leading="compact" className="text-ui-fg-subtle">
            Editing product
          </Text>
          <Text
            size="small"
            leading="compact"
            weight="plus"
            className="overflow-hidden"
            style={SELECTED_TITLE_STYLE}
            title={selectedProduct?.title}
          >
            {selectedProduct?.title ?? 'Choose a product'}
          </Text>
          {selectedProduct && (
            <Text size="xsmall" leading="compact" className="mt-1 truncate text-ui-fg-subtle">
              {selectedProduct.handle ? `Handle: ${selectedProduct.handle}` : `ID: ${selectedProduct.id}`}
            </Text>
          )}
        </div>
        <Button size="small" variant="secondary" className="shrink-0" onClick={() => setOpen(true)}>
          Change
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
              <Drawer.Title>Choose product</Drawer.Title>
              <Drawer.Close asChild>
                <Button size="small" variant="secondary">
                  Done
                </Button>
              </Drawer.Close>
            </div>
            <Drawer.Description className="sr-only">
              Select the product to edit in the PIM workspace.
            </Drawer.Description>
          </Drawer.Header>
          <Drawer.Body className="p-0">
            <ProductListSidebar
              {...listProps}
              selectedProductId={listProps.selectedProductId}
              onProductSelect={handleProductSelect}
              className="h-[calc(100vh-8rem)]"
              variant="drawer"
            />
          </Drawer.Body>
        </Drawer.Content>
      </Drawer>
    </Container>
  )
}
