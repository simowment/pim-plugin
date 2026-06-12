import { defineRouteConfig } from '@medusajs/admin-sdk'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { useEffect, useMemo, useState } from 'react'
import {
  Badge,
  Button,
  Container,
  Input,
  Label,
  Select,
  Table,
  Tabs,
  Text,
  Textarea,
  toast,
  Switch,
  IconButton,
  FocusModal,
  Checkbox,
} from '@medusajs/ui'
import { Plus, Trash, PencilSquare, ArrowPath, Sparkles } from '@medusajs/icons'
import { sdk } from '../../lib/sdk'

type AdminProduct = {
  id: string
  title: string
  handle?: string | null
  thumbnail?: string | null
  description?: string | null
}

type BulletPoint = {
  label?: string
  text: string
}

type Specification = {
  key: string
  label?: string
  value: string
  unit?: string
  group?: string
}

type PimContent = {
  id: string
  product_id: string
  locale: string
  channel: string
  status: string
  title: string | null
  description: string | null
  short_description: string | null
  bullets_json: BulletPoint[] | null
  specifications_json: Specification[] | null
  seo_json: {
    title?: string
    description?: string
    keywords?: string[]
  } | null
  custom_metadata_json: Record<string, any> | null
  updated_at: string
}

type MetadataField = {
  id: string
  key: string
  label: string
  description?: string | null
  type: string
  scope: string
  group?: string | null
  options_json?: Array<{ label: string; value: string }> | null
  required: boolean
  localized: boolean
  channel_specific: boolean
  visible_in_admin: boolean
  visible_in_storefront: boolean
  write_policy: string
  validation_json?: Record<string, any> | null
  sort_order: number
}

type PimJob = {
  id: string
  type: 'translate' | 'rewrite' | 'extract_specs' | 'seo' | 'full'
  product_id: string | null
  locale: string | null
  status: 'queued' | 'running' | 'completed' | 'failed' | 'cancelled'
  input_json: any
  result_json: any
  error_message: string | null
  created_at: string
}

type PimAiSettings = {
  provider: string
  model: string
  base_url: string
  temperature: number
  max_tokens: number
  request_timeout_ms: number
  has_api_key: boolean
  api_key_preview: string
}

const DEFAULT_LOCALES = ['en', 'fr', 'es', 'de', 'nl', 'it', 'pt']
const DEFAULT_CHANNELS = ['storefront', 'default', 'google', 'meta']

const STATUS_COLORS: Record<string, 'green' | 'blue' | 'orange' | 'grey' | 'red'> = {
  published: 'green',
  reviewed: 'blue',
  ai_generated: 'orange',
  draft: 'grey',
  archived: 'red',
}

const emptyForm = {
  title: '',
  short_description: '',
  description: '',
  bullets_json: [] as BulletPoint[],
  specifications_json: [] as Specification[],
  seo_title: '',
  seo_description: '',
  seo_keywords: '',
  custom_metadata_json: {} as Record<string, any>,
  change_reason: '',
}

const LoadingState = () => (
  <div className="flex justify-center py-8">
    <Text size="small" className="text-ui-fg-subtle">
      Loading...
    </Text>
  </div>
)

const statusBadge = (status?: string | null) =>
  status ? (
    <Badge color={STATUS_COLORS[status] ?? 'grey'} size="2xsmall">
      {status}
    </Badge>
  ) : (
    <Badge color="grey" size="2xsmall">
      missing
    </Badge>
  )

const PimPage = () => {
  const [activeTab, setActiveTab] = useState('products')

  return (
    <div className="flex flex-col gap-y-2 p-4">
      <div className="flex items-center justify-between">
        <div>
          <Text size="xlarge" weight="plus">
            PIM - Product Information Management
          </Text>
          <Text size="small" className="text-ui-fg-subtle">
            Enrich product content, translate copies, extract specifications, and define reusable metadata attributes.
          </Text>
        </div>
      </div>
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <Tabs.List>
          <Tabs.Trigger value="products">Product Content</Tabs.Trigger>
          <Tabs.Trigger value="jobs">AI Jobs</Tabs.Trigger>
          <Tabs.Trigger value="ai-settings">AI Settings</Tabs.Trigger>
          <Tabs.Trigger value="metadata-fields">Metadata Fields</Tabs.Trigger>
        </Tabs.List>
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

function ProductsTab() {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [selectedProductId, setSelectedProductId] = useState('')
  const [locale, setLocale] = useState('fr')
  const [channel, setChannel] = useState('storefront')
  const [form, setForm] = useState(emptyForm)
  const [productPage, setProductPage] = useState(0)
  const productsPerPage = 10

  // AI Generation configuration
  const [aiMode, setAiMode] = useState<'translate' | 'rewrite' | 'extract_specs' | 'seo' | 'full'>('translate')
  const [aiTone, setAiTone] = useState<'neutral' | 'luxury' | 'technical' | 'seo'>('neutral')
  const [aiSourceLocale, setAiSourceLocale] = useState('en')
  const [editorTab, setEditorTab] = useState<'copy' | 'specs' | 'seo_ai'>('copy')

  // Fetch sales channels dynamically
  const salesChannelsQuery = useQuery({
    queryKey: ['pim-sales-channels'],
    queryFn: () => sdk.admin.salesChannel.list(),
  })
  const channels = useMemo(() => {
    return salesChannelsQuery.data?.sales_channels?.map((c) => c.name) ?? DEFAULT_CHANNELS
  }, [salesChannelsQuery.data])

  // Fetch store languages dynamically
  const storeQuery = useQuery({
    queryKey: ['pim-store-locales'],
    queryFn: () => sdk.admin.store.retrieve(),
  })
  const locales = useMemo(() => {
    return storeQuery.data?.store?.supported_locales?.map((l) => l.code) ?? DEFAULT_LOCALES
  }, [storeQuery.data])

  // Fetch custom metadata field definitions
  const metadataFieldsQuery = useQuery({
    queryKey: ['pim-metadata-fields'],
    queryFn: () =>
      sdk.client.fetch<{ metadata_fields: MetadataField[] }>('/admin/pim/metadata-fields'),
  })
  const contentMetadataFields = useMemo(() => {
    return metadataFieldsQuery.data?.metadata_fields?.filter(
      (f) => f.scope === 'content' || f.scope === 'product'
    ) ?? []
  }, [metadataFieldsQuery.data])

  const productsQuery = useQuery({
    queryKey: ['pim-products', search, productPage],
    queryFn: () =>
      sdk.admin.product.list({
        limit: productsPerPage,
        offset: productPage * productsPerPage,
        q: search || undefined,
        fields: 'id,title,handle,thumbnail,description',
      } as Record<string, unknown>) as Promise<{ products: AdminProduct[]; count: number }>,
  })

  const products = productsQuery.data?.products ?? []
  const productCount = productsQuery.data?.count ?? 0

  useEffect(() => {
    if (!selectedProductId && products[0]?.id) {
      setSelectedProductId(products[0].id)
    }
  }, [products, selectedProductId])

  const selectedProduct = useMemo(
    () => products.find((product) => product.id === selectedProductId) ?? null,
    [products, selectedProductId],
  )

  const contentQuery = useQuery({
    queryKey: ['pim-product-content', selectedProductId, locale, channel],
    queryFn: () =>
      sdk.client.fetch<{ content: PimContent[] }>(
        `/admin/pim/products/${selectedProductId}/content?locale=${locale}&channel=${channel}`
      ),
    enabled: Boolean(selectedProductId),
  })

  const allContentQuery = useQuery({
    queryKey: ['pim-product-content-all', selectedProductId],
    queryFn: () =>
      sdk.client.fetch<{ content: PimContent[] }>(
        `/admin/pim/content?product_id=${selectedProductId}&limit=100`
      ),
    enabled: Boolean(selectedProductId),
  })

  const activeContent = contentQuery.data?.content?.find((content) => content.status !== 'archived')
    ?? contentQuery.data?.content?.[0]

  // Detect draft dirtiness
  const isDirty = useMemo(() => {
    if (!selectedProduct) return false
    const initialTitle = activeContent?.title ?? selectedProduct?.title ?? ''
    const initialShortDesc = activeContent?.short_description ?? ''
    const initialDesc = activeContent?.description ?? selectedProduct?.description ?? ''
    const initialSeoTitle = String(activeContent?.seo_json?.title ?? '')
    const initialSeoDesc = String(activeContent?.seo_json?.description ?? '')
    const initialSeoKeywords = Array.isArray(activeContent?.seo_json?.keywords)
      ? (activeContent?.seo_json?.keywords as string[]).join(', ')
      : ''

    const initialBullets = activeContent?.bullets_json ?? []
    const initialSpecs = activeContent?.specifications_json ?? []
    const initialMetadata = activeContent?.custom_metadata_json ?? {}

    if (form.title !== initialTitle) return true
    if (form.short_description !== initialShortDesc) return true
    if (form.description !== initialDesc) return true
    if (form.seo_title !== initialSeoTitle) return true
    if (form.seo_description !== initialSeoDesc) return true
    if (form.seo_keywords !== initialSeoKeywords) return true

    if (JSON.stringify(form.bullets_json) !== JSON.stringify(initialBullets)) return true
    if (JSON.stringify(form.specifications_json) !== JSON.stringify(initialSpecs)) return true
    if (JSON.stringify(form.custom_metadata_json) !== JSON.stringify(initialMetadata)) return true

    return false
  }, [form, activeContent, selectedProduct])

  useEffect(() => {
    setForm({
      title: activeContent?.title ?? selectedProduct?.title ?? '',
      short_description: activeContent?.short_description ?? '',
      description: activeContent?.description ?? selectedProduct?.description ?? '',
      bullets_json: activeContent?.bullets_json ?? [],
      specifications_json: activeContent?.specifications_json ?? [],
      seo_title: String(activeContent?.seo_json?.title ?? ''),
      seo_description: String(activeContent?.seo_json?.description ?? ''),
      seo_keywords: Array.isArray(activeContent?.seo_json?.keywords)
        ? (activeContent?.seo_json?.keywords as string[]).join(', ')
        : '',
      custom_metadata_json: activeContent?.custom_metadata_json ?? {},
      change_reason: '',
    })
  }, [activeContent?.id, selectedProductId, locale, channel])

  const confirmSwitch = () => {
    if (isDirty) {
      return window.confirm('You have unsaved changes. Discard changes and continue?')
    }
    return true
  }

  const handleProductSelect = (id: string) => {
    if (confirmSwitch()) {
      setSelectedProductId(id)
    }
  }

  const handleLocaleSelect = (item: string) => {
    if (confirmSwitch()) {
      setLocale(item)
    }
  }

  const handleChannelSelect = (item: string) => {
    if (confirmSwitch()) {
      setChannel(item)
    }
  }

  const invalidateContent = () => {
    queryClient.invalidateQueries({ queryKey: ['pim-product-content', selectedProductId, locale, channel] })
    queryClient.invalidateQueries({ queryKey: ['pim-product-content-all', selectedProductId] })
    queryClient.invalidateQueries({ queryKey: ['pim-content-list'] })
    queryClient.invalidateQueries({ queryKey: ['pim-jobs'] })
  }

  const saveDraftMutation = useMutation({
    mutationFn: () =>
      sdk.client.fetch<{ content: PimContent }>(`/admin/pim/products/${selectedProductId}/content`, {
        method: 'POST',
        body: {
          locale,
          channel,
          title: form.title || null,
          short_description: form.short_description || null,
          description: form.description || null,
          bullets_json: form.bullets_json,
          specifications_json: form.specifications_json,
          seo_json: {
            title: form.seo_title || undefined,
            description: form.seo_description || undefined,
            keywords: form.seo_keywords
              .split(',')
              .map((keyword) => keyword.trim())
              .filter(Boolean),
          },
          custom_metadata_json: form.custom_metadata_json,
          change_reason: form.change_reason || `PIM ${locale}/${channel} edit`,
        },
      }),
    onSuccess: () => {
      toast.success('Draft saved successfully')
      invalidateContent()
    },
    onError: (error: Error) => toast.error(error.message),
  })

  const publishMutation = useMutation({
    mutationFn: (contentId: string) =>
      sdk.client.fetch(`/admin/pim/products/${selectedProductId}/publish`, {
        method: 'POST',
        body: { content_id: contentId, archive_previous: true },
      }),
    onSuccess: () => {
      toast.success('Content published successfully')
      invalidateContent()
    },
    onError: (error: Error) => toast.error(error.message),
  })

  const generateMutation = useMutation({
    mutationFn: () =>
      sdk.client.fetch(`/admin/pim/products/${selectedProductId}/generate`, {
        method: 'POST',
        body: {
          source_locale: aiSourceLocale,
          target_locale: locale,
          channel,
          mode: aiMode,
          tone: aiTone,
          save_as: 'draft',
        },
      }),
    onSuccess: () => {
      toast.success('AI enrichment job triggered successfully! Check the AI Jobs tab for status.')
      invalidateContent()
    },
    onError: (error: Error) => {
      const msg = error.message || 'AI generation failed. Check backend logs for details.'
      toast.error(msg, { duration: 8000 })
      console.error('[PIM] Generate error:', error)
    },
  })

  const canPublish = activeContent && ['draft', 'ai_generated', 'reviewed'].includes(activeContent.status)

  // Bullet list handlers
  const addBullet = () => {
    setForm({
      ...form,
      bullets_json: [...form.bullets_json, { text: '' }],
    })
  }

  const updateBullet = (index: number, fields: Partial<BulletPoint>) => {
    const nextBullets = [...form.bullets_json]
    nextBullets[index] = { ...nextBullets[index], ...fields }
    setForm({ ...form, bullets_json: nextBullets })
  }

  const removeBullet = (index: number) => {
    const nextBullets = form.bullets_json.filter((_, idx) => idx !== index)
    setForm({ ...form, bullets_json: nextBullets })
  }

  // Specifications handlers
  const addSpec = () => {
    setForm({
      ...form,
      specifications_json: [
        ...form.specifications_json,
        { key: '', label: '', value: '', unit: '', group: '' },
      ],
    })
  }

  const updateSpec = (index: number, fields: Partial<Specification>) => {
    const nextSpecs = [...form.specifications_json]
    nextSpecs[index] = { ...nextSpecs[index], ...fields }
    setForm({ ...form, specifications_json: nextSpecs })
  }

  const removeSpec = (index: number) => {
    const nextSpecs = form.specifications_json.filter((_, idx) => idx !== index)
    setForm({ ...form, specifications_json: nextSpecs })
  }

  // Metadata value setter
  const setMetadataValue = (key: string, value: any) => {
    setForm({
      ...form,
      custom_metadata_json: {
        ...form.custom_metadata_json,
        [key]: value,
      },
    })
  }

  return (
    <div className="mt-4 grid grid-cols-1 lg:grid-cols-[minmax(18rem,0.3fr)_minmax(0,0.7fr)] gap-4">
      {/* Product list sidebar */}
      <Container className="overflow-hidden flex flex-col h-[calc(100vh-14rem)]">
        <div className="border-b border-ui-border-base px-6 py-4">
          <Text size="small" weight="plus">
            Products
          </Text>
          <div className="mt-3">
            <Input
              placeholder="Search products..."
              value={search}
              onChange={(event) => {
                setSearch(event.target.value)
                setProductPage(0)
              }}
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {productsQuery.isLoading ? (
            <LoadingState />
          ) : (
            <>
              {products.map((product) => (
                <button
                  key={product.id}
                  className={`flex w-full items-center gap-3 rounded-md px-3 py-2 text-left transition-colors ${
                    selectedProductId === product.id
                      ? 'bg-ui-bg-component-hover'
                      : 'hover:bg-ui-bg-component-hover'
                  }`}
                  onClick={() => handleProductSelect(product.id)}
                >
                  <div className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-md bg-ui-bg-subtle border">
                    {product.thumbnail ? (
                      <img src={product.thumbnail} alt="" className="size-full object-cover" />
                    ) : (
                      <Text size="xsmall" className="text-ui-fg-muted">
                        IMG
                      </Text>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <Text size="small" weight="plus" className="truncate">
                      {product.title}
                    </Text>
                    <Text size="xsmall" className="truncate text-ui-fg-subtle">
                      {product.handle ?? product.id}
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

        {/* Pagination */}
        {productCount > productsPerPage && (
          <div className="border-t border-ui-border-base px-4 py-3 flex items-center justify-between bg-ui-bg-subtle">
            <Button
              size="small"
              variant="secondary"
              disabled={productPage === 0}
              onClick={() => setProductPage(productPage - 1)}
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
              onClick={() => setProductPage(productPage + 1)}
            >
              Next
            </Button>
          </div>
        )}
      </Container>

      {/* Main product PIM editor workspace */}
      <Container className="overflow-hidden flex flex-col h-[calc(100vh-14rem)]">
        <div className="flex items-center justify-between border-b border-ui-border-base px-6 py-4 shrink-0 bg-ui-bg-subtle">
          <div className="min-w-0">
            <Text size="small" weight="plus" className="truncate">
              {selectedProduct?.title ?? 'Select a product'}
            </Text>
            <Text size="xsmall" className="text-ui-fg-subtle">
              {selectedProductId || 'Choose a product to edit localized copy.'}
            </Text>
          </div>
          <div className="flex items-center gap-2">
            <Select size="small" value={locale} onValueChange={handleLocaleSelect}>
              <Select.Trigger>
                <Select.Value />
              </Select.Trigger>
              <Select.Content>
                {locales.map((item) => (
                  <Select.Item key={item} value={item}>
                    {item.toUpperCase()}
                  </Select.Item>
                ))}
              </Select.Content>
            </Select>
            <Select size="small" value={channel} onValueChange={handleChannelSelect}>
              <Select.Trigger>
                <Select.Value />
              </Select.Trigger>
              <Select.Content>
                {channels.map((item) => (
                  <Select.Item key={item} value={item}>
                    {item}
                  </Select.Item>
                ))}
              </Select.Content>
            </Select>
            {statusBadge(activeContent?.status)}
          </div>
        </div>

        {!selectedProduct ? (
          <div className="flex-1 flex items-center justify-center p-8">
            <Text size="small" className="text-ui-fg-subtle">
              Select a product from the sidebar to enrich copy.
            </Text>
          </div>
        ) : contentQuery.isLoading ? (
          <LoadingState />
        ) : (
          <div className="flex-1 overflow-hidden grid grid-cols-1 lg:grid-cols-[1fr_14rem]">
            <div className="flex flex-col h-full overflow-hidden">
              {/* Sub-tabs Navigation */}
              <div className="flex border-b border-ui-border-base bg-ui-bg-subtle shrink-0">
                <button
                  type="button"
                  onClick={() => setEditorTab('copy')}
                  className={`flex-1 py-3 text-xs font-semibold border-b-2 text-center transition-all ${
                    editorTab === 'copy'
                      ? 'border-ui-border-strong text-ui-fg-base bg-ui-bg-base'
                      : 'border-transparent text-ui-fg-muted hover:text-ui-fg-base'
                  }`}
                >
                  Copy & Highlights
                </button>
                <button
                  type="button"
                  onClick={() => setEditorTab('specs')}
                  className={`flex-1 py-3 text-xs font-semibold border-b-2 text-center transition-all ${
                    editorTab === 'specs'
                      ? 'border-ui-border-strong text-ui-fg-base bg-ui-bg-base'
                      : 'border-transparent text-ui-fg-muted hover:text-ui-fg-base'
                  }`}
                >
                  Specs & Attributes
                </button>
                <button
                  type="button"
                  onClick={() => setEditorTab('seo_ai')}
                  className={`flex-1 py-3 text-xs font-semibold border-b-2 text-center transition-all ${
                    editorTab === 'seo_ai'
                      ? 'border-ui-border-strong text-ui-fg-base bg-ui-bg-base'
                      : 'border-transparent text-ui-fg-muted hover:text-ui-fg-base'
                  }`}
                >
                  SEO & AI Copilot
                </button>
              </div>

              {/* Scrollable editor form */}
              <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
                {editorTab === 'copy' && (
                  <>
                    {/* Basic Fields */}
                    <div className="space-y-4">
                      <Text size="base" weight="plus" className="border-b pb-2">
                        Copy Writing
                      </Text>
                      <Field label="Enriched Title">
                        <Input
                          value={form.title}
                          onChange={(event) => setForm({ ...form, title: event.target.value })}
                        />
                      </Field>
                      <Field label="Short Description">
                        <Input
                          value={form.short_description}
                          onChange={(event) => setForm({ ...form, short_description: event.target.value })}
                        />
                      </Field>
                      <Field label="Full Description">
                        <Textarea
                          rows={6}
                          value={form.description}
                          onChange={(event) => setForm({ ...form, description: event.target.value })}
                        />
                      </Field>
                    </div>

                    {/* Bullet Points Repeating Field */}
                    <div className="space-y-3 pt-4">
                      <div className="flex items-center justify-between border-b pb-2">
                        <Text size="base" weight="plus">
                          Bullet Highlights
                        </Text>
                        <Button size="small" variant="secondary" onClick={addBullet}>
                          <Plus /> Add Bullet
                        </Button>
                      </div>
                      <div className="space-y-2">
                        {form.bullets_json.map((bullet, index) => (
                          <div key={index} className="flex gap-2 items-start bg-ui-bg-subtle p-3 rounded-lg border">
                            <div className="flex-1 space-y-2">
                              <Input
                                placeholder="Header/Label (e.g. Eco-Friendly)"
                                value={bullet.label ?? ''}
                                onChange={(e) => updateBullet(index, { label: e.target.value })}
                              />
                              <Textarea
                                placeholder="Highlight copy..."
                                rows={2}
                                value={bullet.text}
                                onChange={(e) => updateBullet(index, { text: e.target.value })}
                              />
                            </div>
                            <IconButton size="small" variant="transparent" onClick={() => removeBullet(index)}>
                              <Trash className="text-ui-fg-danger" />
                            </IconButton>
                          </div>
                        ))}
                        {!form.bullets_json.length && (
                          <Text size="small" className="text-ui-fg-muted italic">
                            No highlights defined yet. Click "Add Bullet" to summarize benefits.
                          </Text>
                        )}
                      </div>
                    </div>
                  </>
                )}

                {editorTab === 'specs' && (
                  <>
                    {/* Dynamic Metadata Attributes */}
                    <div className="space-y-4">
                      <Text size="base" weight="plus" className="border-b pb-2">
                        Custom PIM Metadata Fields
                      </Text>
                      {contentMetadataFields.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {contentMetadataFields.map((field) => {
                            const value = form.custom_metadata_json[field.key] ?? ''
                            return (
                              <div key={field.id} className="flex flex-col gap-2 p-3 bg-ui-bg-subtle rounded-lg border">
                                <Label className="flex justify-between items-center">
                                  <span>{field.label}</span>
                                  <span className="text-[10px] text-ui-fg-muted font-mono">{field.key}</span>
                                </Label>
                                {field.description && (
                                  <Text size="xsmall" className="text-ui-fg-subtle mb-1">
                                    {field.description}
                                  </Text>
                                )}

                                {field.type === 'boolean' ? (
                                  <div className="flex items-center gap-2 py-1">
                                    <Switch
                                      checked={Boolean(value)}
                                      onCheckedChange={(checked) => setMetadataValue(field.key, checked)}
                                    />
                                    <Text size="small">{Boolean(value) ? 'Yes' : 'No'}</Text>
                                  </div>
                                ) : field.type === 'text' ? (
                                  <Textarea
                                    rows={3}
                                    value={value}
                                    onChange={(e) => setMetadataValue(field.key, e.target.value)}
                                  />
                                ) : field.type === 'select' ? (
                                  <Select
                                    size="small"
                                    value={value}
                                    onValueChange={(val) => setMetadataValue(field.key, val)}
                                  >
                                    <Select.Trigger>
                                      <Select.Value placeholder="Select an option" />
                                    </Select.Trigger>
                                    <Select.Content>
                                      {field.options_json?.map((opt) => (
                                        <Select.Item key={opt.value} value={opt.value}>
                                          {opt.label}
                                        </Select.Item>
                                      ))}
                                    </Select.Content>
                                  </Select>
                                ) : (
                                  <Input
                                    type={field.type === 'number' ? 'number' : 'text'}
                                    value={value}
                                    onChange={(e) =>
                                      setMetadataValue(
                                        field.key,
                                        field.type === 'number' ? Number(e.target.value) : e.target.value
                                      )
                                    }
                                  />
                                )}
                              </div>
                            )
                          })}
                        </div>
                      ) : (
                        <Text size="small" className="text-ui-fg-muted italic">
                          No schema attributes defined. Create schemas in the "Metadata Fields" tab first.
                        </Text>
                      )}
                    </div>

                    {/* Specifications Repeating Table */}
                    <div className="space-y-3 pt-6">
                      <div className="flex items-center justify-between border-b pb-2">
                        <Text size="base" weight="plus">
                          Structured Specifications
                        </Text>
                        <Button size="small" variant="secondary" onClick={addSpec}>
                          <Plus /> Add Specification
                        </Button>
                      </div>
                      {form.specifications_json.length > 0 ? (
                        <Table>
                          <Table.Header>
                            <Table.Row>
                              <Table.HeaderCell>Group</Table.HeaderCell>
                              <Table.HeaderCell>Key</Table.HeaderCell>
                              <Table.HeaderCell>Label</Table.HeaderCell>
                              <Table.HeaderCell>Value</Table.HeaderCell>
                              <Table.HeaderCell>Unit</Table.HeaderCell>
                              <Table.HeaderCell className="w-[40px]"></Table.HeaderCell>
                            </Table.Row>
                          </Table.Header>
                          <Table.Body>
                            {form.specifications_json.map((spec, index) => (
                              <Table.Row key={index}>
                                <Table.Cell>
                                  <Input
                                    placeholder="Dimensions"
                                    value={spec.group ?? ''}
                                    onChange={(e) => updateSpec(index, { group: e.target.value })}
                                  />
                                </Table.Cell>
                                <Table.Cell>
                                  <Input
                                    placeholder="weight"
                                    value={spec.key}
                                    onChange={(e) => updateSpec(index, { key: e.target.value })}
                                  />
                                </Table.Cell>
                                <Table.Cell>
                                  <Input
                                    placeholder="Weight"
                                    value={spec.label ?? ''}
                                    onChange={(e) => updateSpec(index, { label: e.target.value })}
                                  />
                                </Table.Cell>
                                <Table.Cell>
                                  <Input
                                    placeholder="1.5"
                                    value={spec.value}
                                    onChange={(e) => updateSpec(index, { value: e.target.value })}
                                  />
                                </Table.Cell>
                                <Table.Cell>
                                  <Input
                                    placeholder="kg"
                                    value={spec.unit ?? ''}
                                    onChange={(e) => updateSpec(index, { unit: e.target.value })}
                                  />
                                </Table.Cell>
                                <Table.Cell>
                                  <IconButton size="small" variant="transparent" onClick={() => removeSpec(index)}>
                                    <Trash className="text-ui-fg-danger" />
                                  </IconButton>
                                </Table.Cell>
                              </Table.Row>
                            ))}
                          </Table.Body>
                        </Table>
                      ) : (
                        <Text size="small" className="text-ui-fg-muted italic">
                          No technical specifications defined.
                        </Text>
                      )}
                    </div>
                  </>
                )}

                {editorTab === 'seo_ai' && (
                  <>
                    {/* SEO Configurations */}
                    <div className="space-y-4">
                      <Text size="base" weight="plus" className="border-b pb-2">
                        SEO Optimization
                      </Text>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Field label="SEO Title">
                          <Input
                            value={form.seo_title}
                            onChange={(event) => setForm({ ...form, seo_title: event.target.value })}
                          />
                        </Field>
                        <Field label="SEO Keywords">
                          <Input
                            value={form.seo_keywords}
                            onChange={(event) => setForm({ ...form, seo_keywords: event.target.value })}
                            placeholder="oak, dining, solid wood"
                          />
                        </Field>
                      </div>
                      <Field label="SEO Description">
                        <Textarea
                          rows={3}
                          value={form.seo_description}
                          onChange={(event) => setForm({ ...form, seo_description: event.target.value })}
                        />
                      </Field>
                    </div>

                    {/* AI Copilot Card */}
                    <div className="p-4 bg-ui-bg-component border border-ui-border-base rounded-lg space-y-3">
                      <div className="flex items-center gap-2 text-ui-fg-interactive">
                        <Sparkles />
                        <Text size="small" weight="plus">
                          AI Copilot Enrichment
                        </Text>
                      </div>
                      <Text size="xsmall" className="text-ui-fg-subtle">
                        Generate copy, translate drafts, or extract key attributes using the configured LLM gateway.
                      </Text>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div className="flex flex-col gap-1">
                          <Label className="text-[10px] text-ui-fg-subtle">Action Mode</Label>
                          <Select size="small" value={aiMode} onValueChange={(val: any) => setAiMode(val)}>
                            <Select.Trigger>
                              <Select.Value />
                            </Select.Trigger>
                            <Select.Content>
                              <Select.Item value="translate">Translate Draft</Select.Item>
                              <Select.Item value="rewrite">Rewrite copy</Select.Item>
                              <Select.Item value="extract_specs">Extract specs</Select.Item>
                              <Select.Item value="seo">Optimize SEO</Select.Item>
                              <Select.Item value="full">Full Copywrite</Select.Item>
                            </Select.Content>
                          </Select>
                        </div>

                        <div className="flex flex-col gap-1">
                          <Label className="text-[10px] text-ui-fg-subtle">Brand Tone</Label>
                          <Select size="small" value={aiTone} onValueChange={(val: any) => setAiTone(val)}>
                            <Select.Trigger>
                              <Select.Value />
                            </Select.Trigger>
                            <Select.Content>
                              <Select.Item value="neutral">Neutral/Clean</Select.Item>
                              <Select.Item value="luxury">Luxury/Creative</Select.Item>
                              <Select.Item value="technical">Technical/Specs</Select.Item>
                              <Select.Item value="seo">SEO-Focused</Select.Item>
                            </Select.Content>
                          </Select>
                        </div>

                        <div className="flex flex-col gap-1">
                          <Label className="text-[10px] text-ui-fg-subtle">Source Locale</Label>
                          <Select size="small" value={aiSourceLocale} onValueChange={setAiSourceLocale}>
                            <Select.Trigger>
                              <Select.Value />
                            </Select.Trigger>
                            <Select.Content>
                              {locales.map((item) => (
                                <Select.Item key={item} value={item}>
                                  {item.toUpperCase()}
                                </Select.Item>
                              ))}
                            </Select.Content>
                          </Select>
                        </div>
                      </div>

                      <div className="pt-2 flex justify-end">
                        <Button
                          size="small"
                          variant="secondary"
                          isLoading={generateMutation.isPending}
                          disabled={generateMutation.isPending || aiSourceLocale === locale}
                          onClick={() => generateMutation.mutate()}
                        >
                          Run AI Copilot
                        </Button>
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* Audit Footer & Actions - Pinned at the bottom */}
              <div className="border-t border-ui-border-base p-4 bg-ui-bg-subtle shrink-0 space-y-3">
                <div className="flex items-center gap-4">
                  <div className="flex-1">
                    <Input
                      placeholder="Audit log change reason..."
                      value={form.change_reason}
                      onChange={(e) => setForm({ ...form, change_reason: e.target.value })}
                      size="small"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="small"
                      variant="secondary"
                      isLoading={saveDraftMutation.isPending}
                      disabled={!selectedProductId || saveDraftMutation.isPending}
                      onClick={() => saveDraftMutation.mutate()}
                    >
                      Save Draft
                    </Button>
                    <Button
                      size="small"
                      isLoading={publishMutation.isPending}
                      disabled={!canPublish || publishMutation.isPending}
                      onClick={() => activeContent?.id && publishMutation.mutate(activeContent.id)}
                    >
                      Publish
                    </Button>
                  </div>
                </div>
              </div>
            </div>

            {/* Sidebar locale switcher */}
            <div className="border-l border-ui-border-base px-4 py-4 bg-ui-bg-subtle shrink-0">
              <Text size="small" weight="plus">
                Locale status
              </Text>
              <div className="mt-3 flex flex-col gap-2">
                {locales.map((item) => {
                  const match = allContentQuery.data?.content?.find(
                    (content) =>
                      content.locale === item &&
                      content.channel === channel &&
                      content.status !== 'archived'
                  )
                  return (
                    <button
                      key={item}
                      className={`flex items-center justify-between rounded-md px-3 py-2 text-left hover:bg-ui-bg-component-hover ${
                        locale === item ? 'bg-ui-bg-component-hover border border-ui-border-strong' : ''
                      }`}
                      onClick={() => handleLocaleSelect(item)}
                    >
                      <Text size="small" weight={locale === item ? 'plus' : 'regular'}>
                        {item.toUpperCase()}
                      </Text>
                      {statusBadge(match?.status)}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        )}
      </Container>
    </div>
  )
}

function AiSettingsTab() {
  const queryClient = useQueryClient()
  const [form, setForm] = useState({
    provider: 'openrouter',
    model: '',
    base_url: '',
    api_key: '',
  })

  const settingsQuery = useQuery({
    queryKey: ['pim-ai-settings'],
    queryFn: () => sdk.client.fetch<{ settings: PimAiSettings }>('/admin/pim/ai-settings'),
  })

  useEffect(() => {
    const settings = settingsQuery.data?.settings
    if (!settings) return
    setForm({
      provider: settings.provider,
      model: settings.model,
      base_url: settings.base_url,
      api_key: '',
    })
  }, [settingsQuery.data?.settings])

  const saveMutation = useMutation({
    mutationFn: () => {
      const body: Record<string, string> = {
        provider: form.provider,
        model: form.model,
        base_url: form.base_url,
      }
      if (form.api_key.trim()) {
        body.api_key = form.api_key.trim()
      }
      return sdk.client.fetch<{ settings: PimAiSettings }>('/admin/pim/ai-settings', {
        method: 'POST',
        body,
      })
    },
    onSuccess: () => {
      toast.success('PIM AI settings saved')
      setForm((current) => ({ ...current, api_key: '' }))
      queryClient.invalidateQueries({ queryKey: ['pim-ai-settings'] })
    },
    onError: (error: Error) => toast.error(error.message),
  })

  const settings = settingsQuery.data?.settings

  return (
    <Container className="mt-4 overflow-hidden">
      <div className="border-b border-ui-border-base px-6 py-4">
        <Text size="small" weight="plus">
          PIM AI Gateway
        </Text>
        <Text size="small" leading="compact" className="text-ui-fg-subtle">
          Configure the shared LLM gateway used by PIM generation. These values are stored server-side and never sent to product-generation requests from the browser.
        </Text>
      </div>

      {settingsQuery.isLoading ? (
        <LoadingState />
      ) : (
        <div className="grid grid-cols-1 gap-6 px-6 py-4 lg:grid-cols-[minmax(0,1fr)_18rem]">
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Field label="Provider">
                <Select
                  size="small"
                  value={form.provider}
                  onValueChange={(value) => setForm({ ...form, provider: value })}
                >
                  <Select.Trigger>
                    <Select.Value />
                  </Select.Trigger>
                  <Select.Content>
                    <Select.Item value="openrouter">OpenRouter</Select.Item>
                    <Select.Item value="openai">OpenAI</Select.Item>
                    <Select.Item value="custom">Custom gateway</Select.Item>
                  </Select.Content>
                </Select>
              </Field>
              <Field label="Model">
                <Input
                  value={form.model}
                  onChange={(event) => setForm({ ...form, model: event.target.value })}
                  placeholder="openai/gpt-4o-mini"
                />
              </Field>
            </div>

            <Field label="Gateway Base URL">
              <Input
                value={form.base_url}
                onChange={(event) => setForm({ ...form, base_url: event.target.value })}
                placeholder="https://openrouter.ai/api/v1"
              />
            </Field>

            <Field label="API Key">
              <Input
                type="password"
                value={form.api_key}
                onChange={(event) => setForm({ ...form, api_key: event.target.value })}
                placeholder="Enter new key or leave blank to keep current"
              />
              {settings?.has_api_key && settings.api_key_preview ? (
                <div className="flex items-center gap-1.5 mt-1.5">
                  <Badge size="2xsmall" rounded="full" className="bg-ui-tag-green-icon text-ui-tag-green-icon">
                    ✓
                  </Badge>
                  <Text size="xsmall" className="text-ui-fg-subtle font-mono">
                    {settings.api_key_preview}
                  </Text>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 mt-1.5">
                  <Badge size="2xsmall" rounded="full" className="bg-ui-tag-red-icon text-ui-tag-red-icon">
                    ✗
                  </Badge>
                  <Text size="xsmall" className="text-ui-fg-subtle">
                    No API key saved
                  </Text>
                </div>
              )}
            </Field>

            <div className="flex justify-end">
              <Button
                size="small"
                isLoading={saveMutation.isPending}
                disabled={saveMutation.isPending || !form.provider || !form.model || !form.base_url}
                onClick={() => saveMutation.mutate()}
              >
                Save AI Settings
              </Button>
            </div>
          </div>

          <div className="rounded-lg border border-ui-border-base bg-ui-bg-subtle px-4 py-3 space-y-3">
            <Text size="small" weight="plus">
              Current gateway
            </Text>
            <SettingsRow label="Provider" value={settings?.provider} />
            <SettingsRow label="Model" value={settings?.model} />
            <SettingsRow label="Base URL" value={settings?.base_url} />
            <SettingsRow label="API key" value={settings?.has_api_key ? `✓ ${settings.api_key_preview}` : '✗ Not configured'} />
            <SettingsRow label="Temperature" value={String(settings?.temperature ?? '')} />
            <SettingsRow label="Max tokens" value={String(settings?.max_tokens ?? '')} />
          </div>
        </div>
      )}
    </Container>
  )
}

function SettingsRow({ label, value }: { label: string; value?: string }) {
  return (
    <div className="space-y-1">
      <Text size="xsmall" leading="compact" weight="plus" className="text-ui-fg-subtle">
        {label}
      </Text>
      <Text size="small" leading="compact" className="break-all">
        {value || '—'}
      </Text>
    </div>
  )
}

function JobsTab() {
  const queryClient = useQueryClient()
  const [reviewJob, setReviewJob] = useState<PimJob | null>(null)
  const [reviewForm, setReviewForm] = useState({
    title: '',
    short_description: '',
    description: '',
    seo_title: '',
    seo_description: '',
    seo_keywords: '',
  })

  const { data, isLoading } = useQuery({
    queryKey: ['pim-jobs'],
    queryFn: () => sdk.client.fetch<{ jobs: PimJob[]; count: number }>('/admin/pim/jobs?limit=50'),
  })

  // Load selected product content to show original content on split view
  const productId = reviewJob?.product_id ?? ''
  const sourceProductQuery = useQuery({
    queryKey: ['pim-review-source-product', productId],
    queryFn: () =>
      sdk.admin.product.retrieve(productId, {
        fields: 'id,title,description',
      }) as Promise<{ product: AdminProduct }>,
    enabled: Boolean(productId),
  })

  const jobs = data?.jobs ?? []

  const handleReviewClick = (job: PimJob) => {
    const result = job.result_json ?? {}
    setReviewJob(job)
    setReviewForm({
      title: result.title ?? '',
      short_description: result.short_description ?? '',
      description: result.description ?? '',
      seo_title: result.seo_json?.title ?? '',
      seo_description: result.seo_json?.description ?? '',
      seo_keywords: Array.isArray(result.seo_json?.keywords)
        ? (result.seo_json.keywords as string[]).join(', ')
        : '',
    })
  }

  const approveMutation = useMutation({
    mutationFn: (body: any) =>
      sdk.client.fetch(`/admin/pim/products/${reviewJob?.product_id}/content`, {
        method: 'POST',
        body,
      }),
    onSuccess: () => {
      toast.success('AI Draft Approved and saved')
      setReviewJob(null)
      queryClient.invalidateQueries({ queryKey: ['pim-product-content'] })
      queryClient.invalidateQueries({ queryKey: ['pim-product-content-all'] })
      queryClient.invalidateQueries({ queryKey: ['pim-jobs'] })
    },
    onError: (error: Error) => toast.error(error.message),
  })

  const handleApprove = () => {
    if (!reviewJob) return
    approveMutation.mutate({
      locale: reviewJob.locale,
      channel: reviewJob.input_json?.channel || 'storefront',
      title: reviewForm.title || null,
      short_description: reviewForm.short_description || null,
      description: reviewForm.description || null,
      bullets_json: reviewJob.result_json?.bullets_json || null,
      specifications_json: reviewJob.result_json?.specifications_json || null,
      seo_json: {
        title: reviewForm.seo_title || undefined,
        description: reviewForm.seo_description || undefined,
        keywords: reviewForm.seo_keywords
          .split(',')
          .map((k) => k.trim())
          .filter(Boolean),
      },
      custom_metadata_json: reviewJob.result_json?.custom_metadata_json || null,
      change_reason: 'Approved AI generated copy from queue',
    })
  }

  return (
    <Container className="mt-4">
      <div className="border-b border-ui-border-base px-6 py-4">
        <Text size="small" weight="plus">
          AI Copilot Processing Jobs Queue
        </Text>
      </div>

      {isLoading ? (
        <LoadingState />
      ) : (
        <Table>
          <Table.Header>
            <Table.Row>
              <Table.HeaderCell>Job ID</Table.HeaderCell>
              <Table.HeaderCell>Type</Table.HeaderCell>
              <Table.HeaderCell>Target Locale</Table.HeaderCell>
              <Table.HeaderCell>Status</Table.HeaderCell>
              <Table.HeaderCell>Created At</Table.HeaderCell>
              <Table.HeaderCell className="w-[120px]"></Table.HeaderCell>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {jobs.map((job) => (
              <Table.Row key={job.id}>
                <Table.Cell className="font-mono text-xs">{job.id}</Table.Cell>
                <Table.Cell>
                  <Badge color="blue" size="2xsmall">
                    {job.type}
                  </Badge>
                </Table.Cell>
                <Table.Cell>{job.locale?.toUpperCase()}</Table.Cell>
                <Table.Cell>
                  {job.status === 'running' ? (
                    <Badge color="orange" className="animate-pulse">
                      {job.status}
                    </Badge>
                  ) : job.status === 'completed' ? (
                    <Badge color="green">{job.status}</Badge>
                  ) : job.status === 'failed' ? (
                    <Badge color="red">{job.status}</Badge>
                  ) : (
                    <Badge color="grey">{job.status}</Badge>
                  )}
                </Table.Cell>
                <Table.Cell className="text-ui-fg-subtle text-xs">
                  {new Date(job.created_at).toLocaleString()}
                </Table.Cell>
                <Table.Cell>
                  {job.status === 'completed' && (
                    <Button size="small" variant="secondary" onClick={() => handleReviewClick(job)}>
                      Review Copy
                    </Button>
                  )}
                  {job.status === 'failed' && (
                    <Text size="xsmall" className="text-ui-fg-danger truncate max-w-[200px]" title={job.error_message || ''}>
                      {job.error_message || 'Unknown error'}
                    </Text>
                  )}
                </Table.Cell>
              </Table.Row>
            ))}
            {!jobs.length && (
              <Table.Row>
                <Table.Cell colSpan={6} className="text-center py-8 text-ui-fg-subtle">
                  No AI generation jobs processed yet.
                </Table.Cell>
              </Table.Row>
            )}
          </Table.Body>
        </Table>
      )}

      {/* Side-by-side split screen review modal */}
      {reviewJob && (
        <FocusModal open={true} onOpenChange={() => setReviewJob(null)}>
          <FocusModal.Content>
            <FocusModal.Header>
              <div className="flex items-center justify-between w-full pr-10">
                <Text size="base" weight="plus">
                  Review AI Generated Copy - {reviewJob.locale?.toUpperCase()}
                </Text>
                <div className="flex items-center gap-2">
                  <Button size="small" variant="secondary" onClick={() => setReviewJob(null)}>
                    Discard
                  </Button>
                  <Button size="small" isLoading={approveMutation.isPending} onClick={handleApprove}>
                    Approve Draft
                  </Button>
                </div>
              </div>
            </FocusModal.Header>
            <FocusModal.Body className="p-0 overflow-hidden">
              <div className="grid grid-cols-1 md:grid-cols-2 h-full divide-x divide-ui-border-base">
                {/* Left side: Original source content */}
                <div className="p-8 overflow-y-auto space-y-6 bg-ui-bg-subtle">
                  <Text size="large" weight="plus" className="border-b pb-2">
                    Original Product Content
                  </Text>
                  <div className="space-y-4">
                    <div>
                      <Label className="text-ui-fg-subtle">Original Title</Label>
                      <Text className="mt-1 font-semibold">{sourceProductQuery.data?.product?.title}</Text>
                    </div>
                    <div>
                      <Label className="text-ui-fg-subtle">Original Description</Label>
                      <Text className="mt-1 whitespace-pre-wrap leading-relaxed">
                        {sourceProductQuery.data?.product?.description || 'No description provided.'}
                      </Text>
                    </div>
                  </div>
                </div>

                {/* Right side: AI Generated copy editor */}
                <div className="p-8 overflow-y-auto space-y-6 bg-ui-bg-base">
                  <Text size="large" weight="plus" className="border-b pb-2 text-ui-fg-interactive">
                    AI Copy Editor ({reviewJob.locale?.toUpperCase()})
                  </Text>
                  <div className="space-y-4">
                    <Field label="AI Title">
                      <Input
                        value={reviewForm.title}
                        onChange={(e) => setReviewForm({ ...reviewForm, title: e.target.value })}
                      />
                    </Field>
                    <Field label="AI Short Description">
                      <Input
                        value={reviewForm.short_description}
                        onChange={(e) => setReviewForm({ ...reviewForm, short_description: e.target.value })}
                      />
                    </Field>
                    <Field label="AI Full Description">
                      <Textarea
                        rows={8}
                        value={reviewForm.description}
                        onChange={(e) => setReviewForm({ ...reviewForm, description: e.target.value })}
                      />
                    </Field>
                    <Field label="AI SEO Title">
                      <Input
                        value={reviewForm.seo_title}
                        onChange={(e) => setReviewForm({ ...reviewForm, seo_title: e.target.value })}
                      />
                    </Field>
                    <Field label="AI SEO Keywords">
                      <Input
                        value={reviewForm.seo_keywords}
                        onChange={(e) => setReviewForm({ ...reviewForm, seo_keywords: e.target.value })}
                      />
                    </Field>
                    <Field label="AI SEO Description">
                      <Textarea
                        rows={3}
                        value={reviewForm.seo_description}
                        onChange={(e) => setReviewForm({ ...reviewForm, seo_description: e.target.value })}
                      />
                    </Field>
                  </div>
                </div>
              </div>
            </FocusModal.Body>
          </FocusModal.Content>
        </FocusModal>
      )}
    </Container>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-y-2">
      <Label>{label}</Label>
      {children}
    </div>
  )
}

function MetadataFieldsTab() {
  const queryClient = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [editField, setEditField] = useState<MetadataField | null>(null)

  // Options builder state
  const [optionsText, setOptionsText] = useState('')
  
  const [newField, setNewField] = useState({
    key: '',
    label: '',
    description: '',
    type: 'string',
    scope: 'content',
    group: '',
    required: false,
    localized: true,
    channel_specific: false,
    visible_in_admin: true,
    visible_in_storefront: false,
  })

  const { data, isLoading } = useQuery({
    queryKey: ['pim-metadata-fields'],
    queryFn: () =>
      sdk.client.fetch<{ metadata_fields: MetadataField[] }>('/admin/pim/metadata-fields'),
  })

  const createMutation = useMutation({
    mutationFn: (body: any) =>
      sdk.client.fetch('/admin/pim/metadata-fields', {
        method: 'POST',
        body,
      }),
    onSuccess: () => {
      toast.success('Metadata attribute created successfully')
      queryClient.invalidateQueries({ queryKey: ['pim-metadata-fields'] })
      setShowForm(false)
      setNewField({
        key: '',
        label: '',
        description: '',
        type: 'string',
        scope: 'content',
        group: '',
        required: false,
        localized: true,
        channel_specific: false,
        visible_in_admin: true,
        visible_in_storefront: false,
      })
      setOptionsText('')
    },
    onError: (error: Error) => toast.error(error.message),
  })

  const updateMutation = useMutation({
    mutationFn: (body: any) =>
      sdk.client.fetch(`/admin/pim/metadata-fields/${editField?.id}`, {
        method: 'POST',
        body,
      }),
    onSuccess: () => {
      toast.success('Metadata attribute updated successfully')
      queryClient.invalidateQueries({ queryKey: ['pim-metadata-fields'] })
      setEditField(null)
    },
    onError: (error: Error) => toast.error(error.message),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      sdk.client.fetch(`/admin/pim/metadata-fields/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast.success('Metadata attribute deleted successfully')
      queryClient.invalidateQueries({ queryKey: ['pim-metadata-fields'] })
    },
    onError: (error: Error) => toast.error(error.message),
  })

  const handleCreate = () => {
    // Parse options label/value pairs from e.g. "Solid:solid, Laminate:laminate"
    const parsedOptions = optionsText
      .split(',')
      .map((opt) => {
        const parts = opt.split(':')
        if (parts.length === 2) {
          return { label: parts[0].trim(), value: parts[1].trim() }
        }
        return null
      })
      .filter(Boolean) as Array<{ label: string; value: string }>

    createMutation.mutate({
      ...newField,
      options_json: parsedOptions.length > 0 ? parsedOptions : null,
    })
  }

  const handleDelete = (id: string) => {
    if (window.confirm('Are you sure you want to delete this metadata field? This will delete all associated values across products.')) {
      deleteMutation.mutate(id)
    }
  }

  const handleEditClick = (field: MetadataField) => {
    setEditField(field)
    setOptionsText(
      field.options_json?.map((o) => `${o.label}:${o.value}`).join(', ') ?? ''
    )
  }

  return (
    <Container className="mt-4">
      <div className="flex items-center justify-between border-b border-ui-border-base px-6 py-4">
        <Text size="small" weight="plus">
          Metadata Field Definitions
        </Text>
        <Button size="small" onClick={() => setShowForm(!showForm)}>
          {showForm ? 'Cancel' : 'Add Field'}
        </Button>
      </div>

      {/* Field Creator Card */}
      {showForm && (
        <div className="space-y-4 border-b border-ui-border-base bg-ui-bg-subtle px-6 py-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Field Key (Unique identifier e.g. care_instructions)">
              <Input
                placeholder="material"
                value={newField.key}
                onChange={(e) => setNewField({ ...newField, key: e.target.value })}
              />
            </Field>
            <Field label="Field Label (Visual name)">
              <Input
                placeholder="Material"
                value={newField.label}
                onChange={(e) => setNewField({ ...newField, label: e.target.value })}
              />
            </Field>
            <Field label="Field Type">
              <Select
                size="small"
                value={newField.type}
                onValueChange={(value) => setNewField({ ...newField, type: value })}
              >
                <Select.Trigger>
                  <Select.Value />
                </Select.Trigger>
                <Select.Content>
                  {['string', 'text', 'number', 'boolean', 'select', 'multiselect', 'json', 'url'].map(
                    (type) => (
                      <Select.Item key={type} value={type}>
                        {type}
                      </Select.Item>
                    )
                  )}
                </Select.Content>
              </Select>
            </Field>
            <Field label="Field Scope">
              <Select
                size="small"
                value={newField.scope}
                onValueChange={(value) => setNewField({ ...newField, scope: value })}
              >
                <Select.Trigger>
                  <Select.Value />
                </Select.Trigger>
                <Select.Content>
                  {['product', 'variant', 'content'].map((scope) => (
                    <Select.Item key={scope} value={scope}>
                      {scope}
                    </Select.Item>
                  ))}
                </Select.Content>
              </Select>
            </Field>

            <Field label="Field Options (Only for select/multiselect - Format: Label:value, e.g. Oak:oak, Pine:pine)">
              <Input
                placeholder="Label:value, Label2:value2"
                value={optionsText}
                onChange={(e) => setOptionsText(e.target.value)}
              />
            </Field>

            <Field label="Description">
              <Input
                placeholder="Short description of field purpose"
                value={newField.description}
                onChange={(e) => setNewField({ ...newField, description: e.target.value })}
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-3 bg-ui-bg-base border rounded-lg">
            <div className="flex items-center gap-2">
              <Checkbox
                id="req"
                checked={newField.required}
                onCheckedChange={(checked) => setNewField({ ...newField, required: Boolean(checked) })}
              />
              <Label htmlFor="req">Required</Label>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="loc"
                checked={newField.localized}
                onCheckedChange={(checked) => setNewField({ ...newField, localized: Boolean(checked) })}
              />
              <Label htmlFor="loc">Localized (Multilingual)</Label>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="ch"
                checked={newField.channel_specific}
                onCheckedChange={(checked) =>
                  setNewField({ ...newField, channel_specific: Boolean(checked) })
                }
              />
              <Label htmlFor="ch">Channel Specific</Label>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="store"
                checked={newField.visible_in_storefront}
                onCheckedChange={(checked) =>
                  setNewField({ ...newField, visible_in_storefront: Boolean(checked) })
                }
              />
              <Label htmlFor="store">Visible in Storefront</Label>
            </div>
          </div>

          <Button
            size="small"
            isLoading={createMutation.isPending}
            disabled={createMutation.isPending || !newField.key || !newField.label}
            onClick={handleCreate}
          >
            Save Schema Attribute
          </Button>
        </div>
      )}

      {isLoading ? (
        <LoadingState />
      ) : (
        <Table>
          <Table.Header>
            <Table.Row>
              <Table.HeaderCell>Key</Table.HeaderCell>
              <Table.HeaderCell>Label</Table.HeaderCell>
              <Table.HeaderCell>Type</Table.HeaderCell>
              <Table.HeaderCell>Scope</Table.HeaderCell>
              <Table.HeaderCell>Requirements</Table.HeaderCell>
              <Table.HeaderCell>Storefront</Table.HeaderCell>
              <Table.HeaderCell className="w-[180px]"></Table.HeaderCell>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {data?.metadata_fields?.map((field) => (
              <Table.Row key={field.id}>
                <Table.Cell className="font-mono text-xs">{field.key}</Table.Cell>
                <Table.Cell>{field.label}</Table.Cell>
                <Table.Cell>{field.type}</Table.Cell>
                <Table.Cell>{field.scope}</Table.Cell>
                <Table.Cell>
                  <div className="flex flex-wrap gap-1">
                    {field.required && <Badge size="2xsmall" color="red">Required</Badge>}
                    {field.localized && <Badge size="2xsmall" color="blue">Locale</Badge>}
                    {field.channel_specific && <Badge size="2xsmall" color="orange">Channel</Badge>}
                  </div>
                </Table.Cell>
                <Table.Cell>
                  <Badge color={field.visible_in_storefront ? 'green' : 'grey'} size="2xsmall">
                    {field.visible_in_storefront ? 'visible' : 'hidden'}
                  </Badge>
                </Table.Cell>
                <Table.Cell>
                  <div className="flex gap-2 justify-end">
                    <IconButton size="small" variant="secondary" onClick={() => handleEditClick(field)}>
                      <PencilSquare />
                    </IconButton>
                    <IconButton size="small" variant="transparent" onClick={() => handleDelete(field.id)}>
                      <Trash className="text-ui-fg-danger" />
                    </IconButton>
                  </div>
                </Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table>
      )}

      {/* Edit drawer FocusModal */}
      {editField && (
        <FocusModal open={true} onOpenChange={() => setEditField(null)}>
          <FocusModal.Content>
            <FocusModal.Header>
              <div className="flex items-center justify-between w-full pr-10">
                <Text size="base" weight="plus">
                  Edit Metadata Attribute Definition
                </Text>
                <div className="flex items-center gap-2">
                  <Button size="small" variant="secondary" onClick={() => setEditField(null)}>
                    Cancel
                  </Button>
                  <Button
                    size="small"
                    isLoading={updateMutation.isPending}
                    onClick={() =>
                      updateMutation.mutate({
                        label: editField.label,
                        description: editField.description,
                        options_json: optionsText
                          .split(',')
                          .map((opt) => {
                            const parts = opt.split(':')
                            if (parts.length === 2) {
                              return { label: parts[0].trim(), value: parts[1].trim() }
                            }
                            return null
                          })
                          .filter(Boolean),
                        required: editField.required,
                        localized: editField.localized,
                        channel_specific: editField.channel_specific,
                        visible_in_storefront: editField.visible_in_storefront,
                      })
                    }
                  >
                    Save Changes
                  </Button>
                </div>
              </div>
            </FocusModal.Header>
            <FocusModal.Body className="p-8 space-y-6 max-w-xl mx-auto">
              <Field label="Label">
                <Input
                  value={editField.label}
                  onChange={(e) => setEditField({ ...editField, label: e.target.value })}
                />
              </Field>
              <Field label="Description">
                <Input
                  value={editField.description ?? ''}
                  onChange={(e) => setEditField({ ...editField, description: e.target.value })}
                />
              </Field>
              <Field label="Options List (Format: Label:value, e.g. Oak:oak, Pine:pine)">
                <Input value={optionsText} onChange={(e) => setOptionsText(e.target.value)} />
              </Field>

              <div className="space-y-3 p-4 bg-ui-bg-subtle border rounded-lg">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="edit-req"
                    checked={editField.required}
                    onCheckedChange={(checked) =>
                      setEditField({ ...editField, required: Boolean(checked) })
                    }
                  />
                  <Label htmlFor="edit-req">Required</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="edit-loc"
                    checked={editField.localized}
                    onCheckedChange={(checked) =>
                      setEditField({ ...editField, localized: Boolean(checked) })
                    }
                  />
                  <Label htmlFor="edit-loc">Localized (Multilingual)</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="edit-ch"
                    checked={editField.channel_specific}
                    onCheckedChange={(checked) =>
                      setEditField({ ...editField, channel_specific: Boolean(checked) })
                    }
                  />
                  <Label htmlFor="edit-ch">Channel Specific</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="edit-store"
                    checked={editField.visible_in_storefront}
                    onCheckedChange={(checked) =>
                      setEditField({ ...editField, visible_in_storefront: Boolean(checked) })
                    }
                  />
                  <Label htmlFor="edit-store">Visible in Storefront</Label>
                </div>
              </div>
            </FocusModal.Body>
          </FocusModal.Content>
        </FocusModal>
      )}
    </Container>
  )
}

export const config = defineRouteConfig({
  label: 'PIM',
})

export default PimPage
