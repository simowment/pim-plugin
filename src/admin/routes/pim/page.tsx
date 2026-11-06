import { defineRouteConfig } from '@medusajs/admin-sdk'
import { useState } from 'react'
import { DocumentText } from '@medusajs/icons'
import { Heading, Tabs, Text } from '@medusajs/ui'
import { AiSettingsTab } from './ai-settings-tab'
import { JobsTab } from './jobs-tab'
import { MetadataFieldsTab } from './metadata-fields-tab'
import { ProductsTab } from './products-tab'

const PimPage = () => {
  const [activeTab, setActiveTab] = useState('products')

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
          <Tabs.List className="grid w-full grid-cols-2 gap-1 sm:flex sm:w-auto sm:gap-0">
            <Tabs.Trigger value="products" className="justify-center">
              Content
            </Tabs.Trigger>
            <Tabs.Trigger value="jobs" className="justify-center" aria-label="AI review queue">
              <span aria-hidden="true" className="sm:hidden">AI queue</span>
              <span aria-hidden="true" className="hidden sm:inline">AI review queue</span>
            </Tabs.Trigger>
            <Tabs.Trigger value="ai-settings" className="justify-center">
              AI setup
            </Tabs.Trigger>
            <Tabs.Trigger value="metadata-fields" className="justify-center" aria-label="Field templates">
              <span aria-hidden="true" className="sm:hidden">Fields</span>
              <span aria-hidden="true" className="hidden sm:inline">Field templates</span>
            </Tabs.Trigger>
          </Tabs.List>
        </div>
        <Tabs.Content value="products">
          <ProductsTab onOpenAiSetup={() => setActiveTab('ai-settings')} />
        </Tabs.Content>
        <Tabs.Content value="jobs">
          <JobsTab />
        </Tabs.Content>
        <Tabs.Content value="ai-settings">
          <AiSettingsTab />
        </Tabs.Content>
        <Tabs.Content value="metadata-fields">
          <MetadataFieldsTab />
        </Tabs.Content>
      </Tabs>
    </div>
  )
}

export const config = defineRouteConfig({
  label: 'Product content',
  icon: DocumentText,
  nested: '/products',
})

export default PimPage
