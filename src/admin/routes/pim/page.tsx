import { defineRouteConfig } from '@medusajs/admin-sdk'
import { useCallback, useEffect, useState } from 'react'
import { Language } from '@medusajs/icons'
import { Heading, Tabs, Text } from '@medusajs/ui'
import { AiSettingsTab } from './ai-settings-tab'
import { JobsTab } from './jobs-tab'
import { MetadataFieldsTab } from './metadata-fields-tab'
import { ProductsTab } from './products-tab'

const TABS = ['products', 'jobs', 'settings'] as const
type PimTab = (typeof TABS)[number]

// Old tab values (the separate AI setup and Field templates tabs) land on the merged Settings tab.
const LEGACY_TABS: Record<string, PimTab> = {
  'ai-settings': 'settings',
  'ai-setup': 'settings',
  'metadata-fields': 'settings',
  fields: 'settings',
  content: 'products',
  queue: 'jobs',
}

function readTabFromUrl(): PimTab {
  if (typeof window === 'undefined') return 'products'
  const raw = new URLSearchParams(window.location.search).get('tab') ?? ''
  if ((TABS as readonly string[]).includes(raw)) return raw as PimTab
  return LEGACY_TABS[raw] ?? 'products'
}

/**
 * Tab state lives in `?tab=` so a tab can be linked to and survives a reload. Other query
 * parameters (such as the `?product_id=` deep link) are kept. replaceState keeps the router's
 * own history state, so back/forward still work.
 */
function useTabParam(): [PimTab, (tab: string) => void] {
  const [tab, setTab] = useState<PimTab>(readTabFromUrl)

  useEffect(() => {
    const onPop = () => setTab(readTabFromUrl())
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  const select = useCallback((next: string) => {
    const value: PimTab = (TABS as readonly string[]).includes(next)
      ? (next as PimTab)
      : (LEGACY_TABS[next] ?? 'products')
    setTab(value)
    const url = new URL(window.location.href)
    if (value === 'products') url.searchParams.delete('tab')
    else url.searchParams.set('tab', value)
    if (url.href !== window.location.href) {
      window.history.replaceState(window.history.state, '', url.pathname + url.search + url.hash)
    }
  }, [])

  return [tab, select]
}

const PimPage = () => {
  const [activeTab, setActiveTab] = useTabParam()

  return (
    <div className="flex flex-col gap-y-2 p-3">
      <div className="min-w-0">
        <Heading level="h1">Product content</Heading>
        <Text size="small" className="text-ui-fg-subtle">
          Storefront copy, SEO text and translations for each product, per language. Without an
          entry here the storefront uses the product&apos;s own title and description. Price,
          stock and images stay in Products.
        </Text>
      </div>
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="-mx-3 px-3 sm:mx-0 sm:px-0">
          <Tabs.List className="grid w-full grid-cols-3 gap-1 sm:flex sm:w-auto sm:gap-0">
            <Tabs.Trigger value="products" className="justify-center">
              Content
            </Tabs.Trigger>
            <Tabs.Trigger value="jobs" className="justify-center" aria-label="AI review queue">
              <span aria-hidden="true" className="sm:hidden">AI queue</span>
              <span aria-hidden="true" className="hidden sm:inline">AI review queue</span>
            </Tabs.Trigger>
            <Tabs.Trigger value="settings" className="justify-center">
              Settings
            </Tabs.Trigger>
          </Tabs.List>
        </div>
        <Tabs.Content value="products">
          <ProductsTab onOpenAiSetup={() => setActiveTab('settings')} />
        </Tabs.Content>
        <Tabs.Content value="jobs">
          <JobsTab />
        </Tabs.Content>
        <Tabs.Content value="settings">
          <AiSettingsTab />
          <details className="mt-4">
            <summary className="text-ui-fg-subtle cursor-pointer text-sm">
              Advanced: field templates
            </summary>
            <MetadataFieldsTab />
          </details>
        </Tabs.Content>
      </Tabs>
    </div>
  )
}

export const config = defineRouteConfig({
  label: 'Product content',
  icon: Language,
  nested: '/products',
})

export default PimPage
