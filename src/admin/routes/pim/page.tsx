import { defineRouteConfig } from '@medusajs/admin-sdk'
import { useState } from 'react'
import { Tabs, Text } from '@medusajs/ui'
import { AiSettingsTab } from './ai-settings-tab'
import { JobsTab } from './jobs-tab'
import { MetadataFieldsTab } from './metadata-fields-tab'
import { ProductsTab } from './products-tab'

const PimPage = () => {
  const [activeTab, setActiveTab] = useState('products')

  return (
    <div className="flex flex-col gap-y-3 p-3 sm:p-4">
      <div className="flex items-center justify-between">
        <div className="min-w-0">
          <Text size="xlarge" weight="plus">
            Product Content Manager
          </Text>
          <Text size="small" className="text-ui-fg-subtle">
            Edit product copy, organize specifications, review AI drafts, and manage reusable content fields.
          </Text>
        </div>
      </div>
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="-mx-3 px-3 sm:mx-0 sm:px-0">
          <Tabs.List className="grid w-full grid-cols-2 gap-1 sm:flex sm:w-auto sm:gap-0">
            <Tabs.Trigger value="products" className="justify-center" aria-label="Product Content">
              <span aria-hidden="true" className="sm:hidden">Content</span>
              <span aria-hidden="true" className="hidden sm:inline">Product Content</span>
            </Tabs.Trigger>
            <Tabs.Trigger value="jobs" className="justify-center" aria-label="AI Review Queue">
              <span aria-hidden="true" className="sm:hidden">Queue</span>
              <span aria-hidden="true" className="hidden sm:inline">AI Review Queue</span>
            </Tabs.Trigger>
            <Tabs.Trigger value="ai-settings" className="justify-center">
              AI Setup
            </Tabs.Trigger>
            <Tabs.Trigger value="metadata-fields" className="justify-center" aria-label="Field Templates">
              <span aria-hidden="true" className="sm:hidden">Fields</span>
              <span aria-hidden="true" className="hidden sm:inline">Field Templates</span>
            </Tabs.Trigger>
          </Tabs.List>
        </div>
        <Tabs.Content value="products">
          <ProductsTab />
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
  label: 'PIM',
})

export default PimPage
