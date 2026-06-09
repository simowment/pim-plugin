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
} from '@medusajs/ui'
import { sdk } from '../../lib/sdk'

type AdminProduct = {
  id: string
  title: string
  handle?: string | null
  thumbnail?: string | null
  description?: string | null
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
  seo_json: Record<string, unknown> | null
  updated_at: string
}

type MetadataField = {
  id: string
  key: string
  label: string
  type: string
  scope: string
  group: string | null
  visible_in_admin: boolean
  visible_in_storefront: boolean
  required: boolean
}

type NewField = { key: string; label: string; type: string; scope: string }

const LOCALES = ['en', 'fr', 'es', 'de', 'nl', 'it', 'pt']
const CHANNELS = ['storefront', 'default', 'google', 'meta']
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
  seo_title: '',
  seo_description: '',
  seo_keywords: '',
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
            Edit product copy, translations, SEO fields, and reusable metadata outside the product page.
          </Text>
        </div>
      </div>
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <Tabs.List>
          <Tabs.Trigger value="products">Product Content</Tabs.Trigger>
          <Tabs.Trigger value="jobs">AI Jobs</Tabs.Trigger>
          <Tabs.Trigger value="metadata-fields">Metadata Fields</Tabs.Trigger>
        </Tabs.List>
        <Tabs.Content value="products">
          <ProductsTab />
        </Tabs.Content>
        <Tabs.Content value="jobs">
          <JobsTab />
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

  const productsQuery = useQuery({
    queryKey: ['pim-products', search],
    queryFn: () =>
      sdk.admin.product.list({
        limit: 25,
        q: search || undefined,
        fields: 'id,title,handle,thumbnail,description',
      } as Record<string, unknown>) as Promise<{ products: AdminProduct[]; count: number }>,
  })

  const products = productsQuery.data?.products ?? []

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
        `/admin/pim/products/${selectedProductId}/content?locale=${locale}&channel=${channel}`,
      ),
    enabled: Boolean(selectedProductId),
  })

  const allContentQuery = useQuery({
    queryKey: ['pim-product-content-all', selectedProductId],
    queryFn: () =>
      sdk.client.fetch<{ content: PimContent[] }>(
        `/admin/pim/content?product_id=${selectedProductId}&limit=100`,
      ),
    enabled: Boolean(selectedProductId),
  })

  const activeContent = contentQuery.data?.content?.find((content) => content.status !== 'archived')
    ?? contentQuery.data?.content?.[0]

  useEffect(() => {
    setForm({
      title: activeContent?.title ?? selectedProduct?.title ?? '',
      short_description: activeContent?.short_description ?? '',
      description: activeContent?.description ?? selectedProduct?.description ?? '',
      seo_title: String(activeContent?.seo_json?.title ?? ''),
      seo_description: String(activeContent?.seo_json?.description ?? ''),
      seo_keywords: Array.isArray(activeContent?.seo_json?.keywords)
        ? (activeContent?.seo_json?.keywords as string[]).join(', ')
        : '',
    })
  }, [activeContent?.id, selectedProductId, locale, channel])

  const invalidateContent = () => {
    queryClient.invalidateQueries({ queryKey: ['pim-product-content', selectedProductId, locale, channel] })
    queryClient.invalidateQueries({ queryKey: ['pim-product-content-all', selectedProductId] })
    queryClient.invalidateQueries({ queryKey: ['pim-content-list'] })
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
          seo_json: {
            title: form.seo_title || undefined,
            description: form.seo_description || undefined,
            keywords: form.seo_keywords
              .split(',')
              .map((keyword) => keyword.trim())
              .filter(Boolean),
          },
          change_reason: `PIM ${locale}/${channel} edit`,
        },
      }),
    onSuccess: () => {
      toast.success('Draft saved')
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
      toast.success('Content published')
      invalidateContent()
    },
    onError: (error: Error) => toast.error(error.message),
  })

  const translateMutation = useMutation({
    mutationFn: () =>
      sdk.client.fetch(`/admin/pim/products/${selectedProductId}/generate`, {
        method: 'POST',
        body: {
          source_locale: 'en',
          target_locale: locale,
          channel,
          mode: 'translate',
          tone: 'neutral',
          save_as: 'draft',
        },
      }),
    onSuccess: () => {
      toast.success('Translation draft generated')
      invalidateContent()
    },
    onError: (error: Error) => toast.error(error.message),
  })

  const canPublish = activeContent && ['draft', 'ai_generated', 'reviewed'].includes(activeContent.status)

  return (
    <div className="mt-4 grid grid-cols-1 lg:grid-cols-[minmax(18rem,0.35fr)_minmax(0,0.65fr)] gap-4">
      <Container className="overflow-hidden">
        <div className="border-b border-ui-border-base px-6 py-4">
          <Text size="small" weight="plus">
            Products
          </Text>
          <div className="mt-3">
            <Input
              placeholder="Search products"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
        </div>
        {productsQuery.isLoading ? (
          <LoadingState />
        ) : (
          <div className="max-h-[calc(100vh-18rem)] overflow-y-auto p-2">
            {products.map((product) => (
              <button
                key={product.id}
                className={`flex w-full items-center gap-3 rounded-md px-3 py-2 text-left transition-colors ${
                  selectedProductId === product.id
                    ? 'bg-ui-bg-component-hover'
                    : 'hover:bg-ui-bg-component-hover'
                }`}
                onClick={() => setSelectedProductId(product.id)}
              >
                <div className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-md bg-ui-bg-subtle">
                  {product.thumbnail ? (
                    <img
                      src={product.thumbnail}
                      alt=""
                      className="size-full object-cover"
                    />
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
              <Text size="small" className="px-4 py-6 text-ui-fg-subtle">
                No products found.
              </Text>
            )}
          </div>
        )}
      </Container>

      <Container className="overflow-hidden">
        <div className="flex items-center justify-between border-b border-ui-border-base px-6 py-4">
          <div className="min-w-0">
            <Text size="small" weight="plus" className="truncate">
              {selectedProduct?.title ?? 'Select a product'}
            </Text>
            <Text size="xsmall" className="text-ui-fg-subtle">
              {selectedProductId || 'Choose a product to edit localized content.'}
            </Text>
          </div>
          <div className="flex items-center gap-2">
            <Select size="small" value={locale} onValueChange={setLocale}>
              <Select.Trigger>
                <Select.Value />
              </Select.Trigger>
              <Select.Content>
                {LOCALES.map((item) => (
                  <Select.Item key={item} value={item}>
                    {item.toUpperCase()}
                  </Select.Item>
                ))}
              </Select.Content>
            </Select>
            <Select size="small" value={channel} onValueChange={setChannel}>
              <Select.Trigger>
                <Select.Value />
              </Select.Trigger>
              <Select.Content>
                {CHANNELS.map((item) => (
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
          <Text size="small" className="px-6 py-8 text-ui-fg-subtle">
            Select a product to edit its localized storefront content.
          </Text>
        ) : contentQuery.isLoading ? (
          <LoadingState />
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_16rem] gap-0">
            <div className="space-y-4 px-6 py-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field label="Title">
                  <Input
                    value={form.title}
                    onChange={(event) => setForm({ ...form, title: event.target.value })}
                  />
                </Field>
              </div>
              <Field label="Short description">
                <Input
                  value={form.short_description}
                  onChange={(event) => setForm({ ...form, short_description: event.target.value })}
                />
              </Field>
              <Field label="Description">
                <Textarea
                  rows={12}
                  value={form.description}
                  onChange={(event) => setForm({ ...form, description: event.target.value })}
                />
              </Field>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field label="SEO title">
                  <Input
                    value={form.seo_title}
                    onChange={(event) => setForm({ ...form, seo_title: event.target.value })}
                  />
                </Field>
                <Field label="SEO keywords">
                  <Input
                    value={form.seo_keywords}
                    onChange={(event) => setForm({ ...form, seo_keywords: event.target.value })}
                    placeholder="lamp, mushroom lamp, bedside"
                  />
                </Field>
              </div>
              <Field label="SEO description">
                <Textarea
                  rows={3}
                  value={form.seo_description}
                  onChange={(event) => setForm({ ...form, seo_description: event.target.value })}
                />
              </Field>
              <div className="flex items-center justify-end gap-2 border-t border-ui-border-base pt-4">
                <Button
                  size="small"
                  variant="secondary"
                  isLoading={translateMutation.isPending}
                  disabled={!selectedProductId || translateMutation.isPending || locale === 'en'}
                  onClick={() => translateMutation.mutate()}
                >
                  Translate from EN
                </Button>
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

            <div className="border-l border-ui-border-base px-4 py-4">
              <Text size="small" weight="plus">
                Locale status
              </Text>
              <div className="mt-3 flex flex-col gap-2">
                {LOCALES.map((item) => {
                  const match = allContentQuery.data?.content?.find(
                    (content) =>
                      content.locale === item &&
                      content.channel === channel &&
                      content.status !== 'archived',
                  )
                  return (
                    <button
                      key={item}
                      className={`flex items-center justify-between rounded-md px-3 py-2 text-left hover:bg-ui-bg-component-hover ${
                        locale === item ? 'bg-ui-bg-component-hover' : ''
                      }`}
                      onClick={() => setLocale(item)}
                    >
                      <Text size="small">{item.toUpperCase()}</Text>
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

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-y-2">
      <Label>{label}</Label>
      {children}
    </div>
  )
}

function JobsTab() {
  const { data, isLoading } = useQuery({
    queryKey: ['pim-content-list-jobs'],
    queryFn: () =>
      sdk.client.fetch<{ content: Array<Record<string, unknown>>; count: number }>(
        '/admin/pim/content?limit=50&status=ai_generated',
      ),
  })

  return (
    <Container className="mt-4 px-6 py-4">
      {isLoading ? (
        <LoadingState />
      ) : (
        <Text size="small" className="text-ui-fg-subtle">
          {data?.count ?? 0} generated content records waiting for review.
        </Text>
      )}
    </Container>
  )
}

function MetadataFieldsTab() {
  const queryClient = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [newField, setNewField] = useState<NewField>({
    key: '',
    label: '',
    type: 'string',
    scope: 'content',
  })

  const { data, isLoading } = useQuery({
    queryKey: ['pim-metadata-fields'],
    queryFn: () =>
      sdk.client.fetch<{ metadata_fields: MetadataField[] }>('/admin/pim/metadata-fields'),
  })

  const createMutation = useMutation({
    mutationFn: (field: NewField) =>
      sdk.client.fetch('/admin/pim/metadata-fields', {
        method: 'POST',
        body: field,
      }),
    onSuccess: () => {
      toast.success('Field created')
      queryClient.invalidateQueries({ queryKey: ['pim-metadata-fields'] })
      setShowForm(false)
      setNewField({ key: '', label: '', type: 'string', scope: 'content' })
    },
    onError: (error: Error) => toast.error(error.message),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      sdk.client.fetch(`/admin/pim/metadata-fields/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast.success('Field deleted')
      queryClient.invalidateQueries({ queryKey: ['pim-metadata-fields'] })
    },
    onError: (error: Error) => toast.error(error.message),
  })

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

      {showForm && (
        <div className="space-y-3 border-b border-ui-border-base bg-ui-bg-subtle px-6 py-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Key">
              <Input
                placeholder="material"
                value={newField.key}
                onChange={(event) => setNewField({ ...newField, key: event.target.value })}
              />
            </Field>
            <Field label="Label">
              <Input
                placeholder="Material"
                value={newField.label}
                onChange={(event) => setNewField({ ...newField, label: event.target.value })}
              />
            </Field>
            <Field label="Type">
              <Select
                size="small"
                value={newField.type}
                onValueChange={(value) => setNewField({ ...newField, type: value })}
              >
                <Select.Trigger>
                  <Select.Value />
                </Select.Trigger>
                <Select.Content>
                  {['string', 'text', 'number', 'boolean', 'select', 'json', 'url'].map((type) => (
                    <Select.Item key={type} value={type}>
                      {type}
                    </Select.Item>
                  ))}
                </Select.Content>
              </Select>
            </Field>
            <Field label="Scope">
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
          </div>
          <Button
            size="small"
            isLoading={createMutation.isPending}
            disabled={createMutation.isPending || !newField.key || !newField.label}
            onClick={() => createMutation.mutate(newField)}
          >
            Save Field
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
              <Table.HeaderCell>Storefront</Table.HeaderCell>
              <Table.HeaderCell></Table.HeaderCell>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {data?.metadata_fields?.map((field) => (
              <Table.Row key={field.id}>
                <Table.Cell>
                  <Text size="small" className="font-mono">
                    {field.key}
                  </Text>
                </Table.Cell>
                <Table.Cell>
                  <Text size="small">{field.label}</Text>
                </Table.Cell>
                <Table.Cell>
                  <Text size="small">{field.type}</Text>
                </Table.Cell>
                <Table.Cell>
                  <Text size="small">{field.scope}</Text>
                </Table.Cell>
                <Table.Cell>
                  <Badge color={field.visible_in_storefront ? 'green' : 'grey'} size="2xsmall">
                    {field.visible_in_storefront ? 'visible' : 'hidden'}
                  </Badge>
                </Table.Cell>
                <Table.Cell>
                  <Button
                    size="small"
                    variant="danger"
                    isLoading={deleteMutation.isPending}
                    onClick={() => deleteMutation.mutate(field.id)}
                  >
                    Delete
                  </Button>
                </Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table>
      )}
    </Container>
  )
}

export const config = defineRouteConfig({
  label: 'PIM',
})

export default PimPage
