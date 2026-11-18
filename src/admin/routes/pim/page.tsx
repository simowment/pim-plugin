import { defineRouteConfig } from '@medusajs/admin-sdk'
import { useCallback, useEffect, useState } from 'react'
import { Language } from '@medusajs/icons'
import { Tabs, usePrompt } from '@medusajs/ui'
import { Navigate, useNavigate } from 'react-router-dom'
import { PageHeader } from '../../components/ui/page-header'
import { SettingsLink } from '../../components/ui/settings-page'
import { JobsTab } from './jobs-tab'
import { ProductsTab } from './products-tab'

const TABS = ['products', 'jobs'] as const
type PimTab = (typeof TABS)[number]

const LEGACY_TABS: Record<string, PimTab> = {
  content: 'products',
  queue: 'jobs',
}

/** The old Settings tab (and the AI setup and Field templates tabs before it) is now /pim/settings. */
const SETTINGS_TABS: Record<string, string> = {
  settings: '/pim/settings',
  'ai-settings': '/pim/settings#ai',
  'ai-setup': '/pim/settings#ai',
  'metadata-fields': '/pim/settings#fields',
  fields: '/pim/settings#fields',
}

function settingsRedirect(): string | null {
  if (typeof window === 'undefined') return null
  const raw = new URLSearchParams(window.location.search).get('tab') ?? ''
  return SETTINGS_TABS[raw] ?? null
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
  const redirect = settingsRedirect()
  if (redirect) return <Navigate to={redirect} replace />
  return <PimTabs />
}

const PimTabs = () => {
  const [activeTab, setTab] = useTabParam()
  const prompt = usePrompt()
  const navigate = useNavigate()
  // Leaving the Content tab unmounts the editor, so ask first when it holds unsaved edits.
  const [editorDirty, setEditorDirty] = useState(false)
  const setActiveTab = useCallback(
    (next: string) => {
      if (!editorDirty || next === activeTab) {
        setTab(next)
        return
      }
      void prompt({
        title: 'Discard unsaved changes?',
        description: 'Your changes to this product content are not saved yet.',
        confirmText: 'Discard',
        cancelText: 'Keep editing',
        variant: 'danger',
      }).then((confirmed) => {
        if (confirmed) setTab(next)
      })
    },
    [activeTab, editorDirty, prompt, setTab],
  )
  // AI notices link to the AI section of the settings page; ask first when the editor is dirty.
  const openAiSetup = useCallback(() => {
    if (!editorDirty) {
      navigate('/pim/settings#ai')
      return
    }
    void prompt({
      title: 'Discard unsaved changes?',
      description: 'Your changes to this product content are not saved yet.',
      confirmText: 'Discard',
      cancelText: 'Keep editing',
      variant: 'danger',
    }).then((confirmed) => {
      if (confirmed) navigate('/pim/settings#ai')
    })
  }, [editorDirty, navigate, prompt])

  return (
    <div className="flex flex-col gap-y-2 p-3">
      <PageHeader
        title="Product content"
        subtitle={
          <>
            Storefront copy, SEO text and translations for each product, per language. Without an
            entry here the storefront uses the product&apos;s own title and description. Price,
            stock and images stay in Products.
          </>
        }
        links={<SettingsLink to="/pim/settings" />}
      />
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="-mx-3 px-3 sm:mx-0 sm:px-0">
          <Tabs.List className="grid w-full grid-cols-2 gap-1 sm:flex sm:w-auto sm:gap-0">
            <Tabs.Trigger value="products" className="justify-center">
              Content
            </Tabs.Trigger>
            <Tabs.Trigger value="jobs" className="justify-center" aria-label="AI review queue">
              <span aria-hidden="true" className="sm:hidden">AI queue</span>
              <span aria-hidden="true" className="hidden sm:inline">AI review queue</span>
            </Tabs.Trigger>
          </Tabs.List>
        </div>
        <Tabs.Content value="products">
          <ProductsTab onOpenAiSetup={openAiSetup} onDirtyChange={setEditorDirty} />
        </Tabs.Content>
        <Tabs.Content value="jobs">
          <JobsTab />
        </Tabs.Content>
      </Tabs>
    </div>
  )
}

export const config = defineRouteConfig({
  label: 'Product content',
  icon: Language,
  nested: '/products',
  // Nested under Products, so its Settings page (/pim/settings) has no sidebar item: it is
  // reached from the Settings link in this page header and from Settings > Apps (S12).
  rank: 1,
})

export default PimPage
