import type { ReactNode } from 'react'
import { Container } from '@medusajs/ui'
import { ProductEditorActionBar } from './product-editor-action-bar'
import {
  ProductEditorTabs,
  productEditorPanelId,
  type ProductEditorTab,
} from './product-editor-tabs'

interface ProductEditorShellProps {
  children: ReactNode
}

interface ProductEditorWorkspaceProps {
  activeTab: ProductEditorTab
  actionBar: ReactNode
  children: ReactNode
  localeStatus: ReactNode
  onTabChange: (tab: ProductEditorTab) => void
}

export function ProductEditorShell({ children }: ProductEditorShellProps) {
  return (
    <Container className="flex min-h-0 flex-col overflow-visible lg:h-[calc(100vh-14rem)] lg:overflow-hidden">
      {children}
    </Container>
  )
}

export function ProductEditorWorkspace({
  activeTab,
  actionBar,
  children,
  localeStatus,
  onTabChange,
}: ProductEditorWorkspaceProps) {
  return (
    <div className="grid flex-1 grid-cols-1 overflow-visible xl:grid-cols-[minmax(0,1fr)_11rem] xl:overflow-hidden">
      <div className="order-2 flex min-h-0 flex-col overflow-visible lg:order-1 lg:h-full lg:overflow-hidden">
        <ProductEditorTabs activeTab={activeTab} onTabChange={onTabChange} />
        <div
          id={productEditorPanelId(activeTab)}
          role="tabpanel"
          aria-labelledby={`pim-editor-tab-${activeTab}`}
          className="flex-1 space-y-6 overflow-visible px-4 pb-28 pt-4 sm:px-6 lg:overflow-y-auto"
        >
          {children}
        </div>
        {actionBar}
      </div>
      {localeStatus}
    </div>
  )
}

export { ProductEditorActionBar }
