import type { KeyboardEvent } from 'react'
import { Text } from '@medusajs/ui'

export type ProductEditorTab = 'copy' | 'specs' | 'seo_ai'

interface ProductEditorTabsProps {
  activeTab: ProductEditorTab
  onTabChange: (tab: ProductEditorTab) => void
}

const EDITOR_TABS: Array<{ label: string; value: ProductEditorTab }> = [
  { label: 'Copy', value: 'copy' },
  { label: 'Specifications', value: 'specs' },
  { label: 'SEO', value: 'seo_ai' },
]

export function productEditorPanelId(tab: ProductEditorTab) {
  return `pim-editor-panel-${tab}`
}

function productEditorTabId(tab: ProductEditorTab) {
  return `pim-editor-tab-${tab}`
}

export function ProductEditorTabs({ activeTab, onTabChange }: ProductEditorTabsProps) {
  const moveFocus = (tab: ProductEditorTab) => {
    window.requestAnimationFrame(() => document.getElementById(productEditorTabId(tab))?.focus())
  }

  const handleKeyDown = (
    event: KeyboardEvent<HTMLButtonElement>,
    tab: ProductEditorTab,
  ) => {
    const currentIndex = EDITOR_TABS.findIndex((item) => item.value === tab)
    let nextIndex: number | null = null

    if (event.key === 'ArrowRight') {
      nextIndex = (currentIndex + 1) % EDITOR_TABS.length
    } else if (event.key === 'ArrowLeft') {
      nextIndex = (currentIndex - 1 + EDITOR_TABS.length) % EDITOR_TABS.length
    } else if (event.key === 'Home') {
      nextIndex = 0
    } else if (event.key === 'End') {
      nextIndex = EDITOR_TABS.length - 1
    }

    if (nextIndex === null) {
      return
    }

    event.preventDefault()
    const nextTab = EDITOR_TABS[nextIndex].value
    onTabChange(nextTab)
    moveFocus(nextTab)
  }

  return (
    <div className="border-ui-border-base bg-ui-bg-base shrink-0 border-b">
      <div className="grid grid-cols-3" role="tablist" aria-label="Product editor sections">
        {EDITOR_TABS.map((tab) => (
          <button
            key={tab.value}
            type="button"
            id={productEditorTabId(tab.value)}
            role="tab"
            aria-controls={productEditorPanelId(tab.value)}
            aria-selected={activeTab === tab.value}
            tabIndex={activeTab === tab.value ? 0 : -1}
            onClick={() => onTabChange(tab.value)}
            onKeyDown={(event) => handleKeyDown(event, tab.value)}
            className={`border-b-2 px-2 py-3 text-center transition-colors ${
              activeTab === tab.value
                ? 'border-ui-border-strong bg-ui-bg-base text-ui-fg-base'
                : 'text-ui-fg-muted hover:text-ui-fg-base border-transparent'
            }`}
          >
            <Text size="small" weight="plus">
              {tab.label}
            </Text>
          </button>
        ))}
      </div>
    </div>
  )
}
