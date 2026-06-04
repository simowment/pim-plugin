import { defineRouteConfig } from '@medusajs/admin-sdk'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo, useState } from 'react'
import {
  Badge,
  Button,
  Container,
  Drawer,
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

type PimContent = {
  id: string
  product_id: string
  locale: string
  channel: string
  status: string
  title: string | null
  subtitle: string | null
  description: string | null
  short_description: string | null
  seo_json: { title?: string; description?: string; keywords?: string[] } | null
  custom_metadata_json: Record<string, unknown> | null
  updated_at: string
}

type MetadataField = {
  id: string
  key: string
  label: string
  type: string
  scope: string
  visible_in_storefront: boolean
}

type ProductSummary = {
  product_id: string
  locales: Record<string, PimContent>
  latest: PimContent
}

type ContentForm = {
  title: string
  subtitle: string
  short_description: string
  description: string
  seo_title: string
  seo_description: string
  seo_keywords: string
  metadata_json: string
}

type NewField = {
  key: string
  label: string
  type: string
  scope: string
}

const LOCALES = ['en', 'fr', 'es', 'de', 'nl', 'it', 'pt']
const CHANNELS = ['storefront', 'google', 'meta', 'default']
const TONES = ['neutral', 'luxury', 'technical', 'seo'] as const
const FIELD_TYPES = ['string', 'text', 'number', 'boolean', 'select', 'json', 'url']
const FIELD_SCOPES = ['product', 'variant', 'content']
const STATUS_COLORS: Record<string, 'green' | 'blue' | 'orange' | 'grey' | 'red'> = {
  published: 'green',
  reviewed: 'blue',
  ai_generated: 'orange',
  draft: 'grey',
  archived: 'red',
}

const emptyForm: ContentForm = {
  title: '',
  subtitle: '',
  short_description: '',
  description: '',
  seo_title: '',
  seo_description: '',
  seo_keywords: '',
  metadata_json: '',
}

function latestByProduct(contents: PimContent[]): ProductSummary[] {
  const groups = contents.reduce<Record<string, ProductSummary>>((acc, content) => {
    const current = acc[content.product_id]
    if (!current) {
      acc[content.product_id] = {
        product_id: content.product_id,
        locales: { [content.locale]: content },
        latest: content,
      }
      return acc
    }

    const existingLocale = current.locales[content.locale]
    if (!existingLocale || new Date(content.updated_at) > new Date(existingLocale.updated_at)) {
      current.locales[content.locale] = content
    }
    if (new Date(content.updated_at) > new Date(current.latest.updated_at)) {
      current.latest = content
    }
    return acc
  }, {})

  return Object.values(groups).sort(
    (a, b) => new Date(b.latest.updated_at).getTime() - new Date(a.latest.updated_at).getTime(),
  )
}

function formFromContent(content?: PimContent): ContentForm {
  return {
    title: content?.title ?? '',
    subtitle: content?.subtitle ?? '',
    short_description: content?.short_description ?? '',
    description: content?.description ?? '',
    seo_title: content?.seo_json?.title ?? '',
    seo_description: content?.seo_json?.description ?? '',
    seo_keywords: content?.seo_json?.keywords?.join(', ') ?? '',
    metadata_json: content?.custom_metadata_json
      ? JSON.stringify(content.custom_metadata_json, null, 2)
      : '',
  }
}

function shortId(id: string) {
  return `${id.slice(0, 18)}...`
}

function LoadingState() {
  return (
    <div className="flex justify-center px-6 py-8">
      <Text size="small" className="text-ui-fg-subtle">
        Loading...
      </Text>
    </div>
  )
}

const PimPage = () => {
  const [activeTab, setActiveTab] = useState('products')

  return (
    <div className="flex flex-col gap-y-4 p-4">
      <div className="flex flex-col gap-y-1">
        <Text size="xlarge" weight="plus">
          PIM
        </Text>
        <Text size="small" className="text-ui-fg-subtle">
          Manage localized product copy, translations, SEO, and editable metadata from one place.
        </Text>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <Tabs.List>
          <Tabs.Trigger value="products">Product content</Tabs.Trigger>
          <Tabs.Trigger value="metadata-fields">Metadata fields</Tabs.Trigger>
        </Tabs.List>
        <Tabs.Content value="products">
          <ProductContentTab />
        </Tabs.Content>
        <Tabs.Content value="metadata-fields">
          <MetadataFieldsTab />
        </Tabs.Content>
      </Tabs>
    </div>
  )
}

function ProductContentTab() {
  const [channel, setChannel] = useState('storefront')
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['pim-content-list', channel],
    queryFn: () =>
      sdk.client.fetch<{ content: PimContent[]; count: number }>(
        `/admin/pim/content?channel=${channel}&limit=100`,
      ),
  })

  const summaries = useMemo(() => latestByProduct(data?.content ?? []), [data?.content])

  return (
    <>
      <Container className="mt-4 divide-y divide-ui-border-base">
        <div className="flex items-center justify-between gap-4 px-6 py-4">
          <div>
            <Text size="small" weight="plus" leading="compact">
              Product content workspace
            </Text>
            <Text size="small" leading="compact" className="mt-1 text-ui-fg-subtle">
              Each row is a product. Open it to edit a locale or translate from one language to another.
            </Text>
          </div>
          <Select size="small" value={channel} onValueChange={setChannel}>
            <Select.Trigger className="w-[160px]">
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
        </div>

        {isLoading ? (
          <LoadingState />
        ) : summaries.length ? (
          <Table>
            <Table.Header>
              <Table.Row>
                <Table.HeaderCell>Product</Table.HeaderCell>
                <Table.HeaderCell>Locales</Table.HeaderCell>
                <Table.HeaderCell>Latest status</Table.HeaderCell>
                <Table.HeaderCell>Updated</Table.HeaderCell>
                <Table.HeaderCell></Table.HeaderCell>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {summaries.map((summary) => (
                <Table.Row key={summary.product_id}>
                  <Table.Cell>
                    <div className="flex flex-col gap-y-1">
                      <Text size="small" weight="plus">
                        {summary.latest.title || shortId(summary.product_id)}
                      </Text>
                      <Text size="xsmall" className="font-mono text-ui-fg-subtle">
                        {summary.product_id}
                      </Text>
                    </div>
                  </Table.Cell>
                  <Table.Cell>
                    <div className="flex flex-wrap gap-1">
                      {LOCALES.slice(0, 5).map((locale) => (
                        <Badge
                          key={locale}
                          size="2xsmall"
                          color={summary.locales[locale] ? 'green' : 'grey'}
                        >
                          {locale.toUpperCase()}
                        </Badge>
                      ))}
                    </div>
                  </Table.Cell>
                  <Table.Cell>
                    <Badge color={STATUS_COLORS[summary.latest.status] ?? 'grey'} size="2xsmall">
                      {summary.latest.status}
                    </Badge>
                  </Table.Cell>
                  <Table.Cell>
                    <Text size="small" className="text-ui-fg-subtle">
                      {new Date(summary.latest.updated_at).toLocaleString()}
                    </Text>
                  </Table.Cell>
                  <Table.Cell>
                    <Button
                      size="small"
                      variant="secondary"
                      onClick={() => setSelectedProductId(summary.product_id)}
                    >
                      Manage
                    </Button>
                  </Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table>
        ) : (
          <div className="px-6 py-8">
            <Text size="small" className="text-ui-fg-subtle">
              No PIM records yet. Open a product and create the first localized draft.
            </Text>
          </div>
        )}

        <div className="px-6 py-3 text-right">
          <Text size="xsmall" className="text-ui-fg-subtle">
            {summaries.length} product(s), {data?.count ?? 0} content record(s)
          </Text>
        </div>
      </Container>

      <ProductContentDrawer
        productId={selectedProductId}
        channel={channel}
        onClose={() => setSelectedProductId(null)}
      />
    </>
  )
}

function ProductContentDrawer({
  productId,
  channel: initialChannel,
  onClose,
}: {
  productId: string | null
  channel: string
  onClose: () => void
}) {
  const queryClient = useQueryClient()
  const [locale, setLocale] = useState('fr')
  const [sourceLocale, setSourceLocale] = useState('en')
  const [channel, setChannel] = useState(initialChannel)
  const [tone, setTone] = useState<(typeof TONES)[number]>('neutral')
  const [form, setForm] = useState<ContentForm>(emptyForm)

  useEffect(() => {
    setChannel(initialChannel)
  }, [initialChannel])

  const { data, isLoading } = useQuery({
    queryKey: ['pim-product-content', productId, channel],
    queryFn: () =>
      sdk.client.fetch<{ content: PimContent[] }>(
        `/admin/pim/products/${productId}/content?channel=${channel}`,
      ),
    enabled: Boolean(productId),
  })

  const contentByLocale = useMemo(() => {
    return (data?.content ?? []).reduce<Record<string, PimContent>>((acc, content) => {
      const current = acc[content.locale]
      if (!current || new Date(content.updated_at) > new Date(current.updated_at)) {
        acc[content.locale] = content
      }
      return acc
    }, {})
  }, [data?.content])

  const selectedContent = contentByLocale[locale]

  useEffect(() => {
    setForm(formFromContent(selectedContent))
  }, [selectedContent?.id, locale])

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['pim-product-content', productId, channel] })
    queryClient.invalidateQueries({ queryKey: ['pim-content-list'] })
  }

  const saveMutation = useMutation({
    mutationFn: () => {
      let metadata: Record<string, unknown> | null = null
      if (form.metadata_json.trim()) {
        metadata = JSON.parse(form.metadata_json) as Record<string, unknown>
      }
      const keywords = form.seo_keywords
        .split(',')
        .map((keyword) => keyword.trim())
        .filter(Boolean)

      return sdk.client.fetch(`/admin/pim/products/${productId}/content`, {
        method: 'POST',
        body: {
          locale,
          channel,
          title: form.title || null,
          subtitle: form.subtitle || null,
          short_description: form.short_description || null,
          description: form.description || null,
          seo_json:
            form.seo_title || form.seo_description || keywords.length
              ? {
                  title: form.seo_title || undefined,
                  description: form.seo_description || undefined,
                  keywords,
                }
              : null,
          custom_metadata_json: metadata,
          change_reason: `Manual ${locale.toUpperCase()} content update`,
        },
      })
    },
    onSuccess: () => {
      toast.success(`${locale.toUpperCase()} draft saved`)
      invalidate()
    },
    onError: (error: Error) => {
      toast.error(error.message.includes('JSON') ? 'Metadata JSON is invalid.' : error.message)
    },
  })

  const publishMutation = useMutation({
    mutationFn: (contentId: string) =>
      sdk.client.fetch(`/admin/pim/products/${productId}/publish`, {
        method: 'POST',
        body: { content_id: contentId, archive_previous: true },
      }),
    onSuccess: () => {
      toast.success(`${locale.toUpperCase()} content published`)
      invalidate()
    },
    onError: (error: Error) => toast.error(error.message),
  })

  const translateMutation = useMutation({
    mutationFn: () =>
      sdk.client.fetch(`/admin/pim/products/${productId}/generate`, {
        method: 'POST',
        body: {
          source_locale: sourceLocale,
          target_locale: locale,
          channel,
          mode: 'translate',
          tone,
          save_as: 'draft',
        },
      }),
    onSuccess: () => {
      toast.success(`Translated ${sourceLocale.toUpperCase()} to ${locale.toUpperCase()}`)
      invalidate()
    },
    onError: (error: Error) => toast.error(`Translation failed: ${error.message}`),
  })

  return (
    <Drawer open={Boolean(productId)} onOpenChange={(open) => !open && onClose()}>
      <Drawer.Content>
        <Drawer.Header>
          <Drawer.Title>Manage product content</Drawer.Title>
        </Drawer.Header>
        <Drawer.Body className="flex-1 overflow-auto p-4">
          {isLoading ? (
            <LoadingState />
          ) : (
            <div className="flex flex-col gap-y-6">
              <section className="rounded-rounded border border-ui-border-base p-4">
                <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-3">
                  <div className="flex flex-col gap-y-1">
                    <Label>Edit language</Label>
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
                  </div>
                  <div className="flex flex-col gap-y-1">
                    <Label>Channel</Label>
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
                  </div>
                  <div className="flex flex-col gap-y-1">
                    <Label>Status</Label>
                    <div className="flex h-8 items-center">
                      {selectedContent ? (
                        <Badge color={STATUS_COLORS[selectedContent.status] ?? 'grey'} size="2xsmall">
                          {selectedContent.status}
                        </Badge>
                      ) : (
                        <Badge color="grey" size="2xsmall">
                          missing
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4">
                  <Field label="Title">
                    <Input
                      value={form.title}
                      onChange={(event) => setForm({ ...form, title: event.target.value })}
                    />
                  </Field>
                  <Field label="Subtitle">
                    <Input
                      value={form.subtitle}
                      onChange={(event) => setForm({ ...form, subtitle: event.target.value })}
                    />
                  </Field>
                  <Field label="Short description">
                    <Input
                      value={form.short_description}
                      onChange={(event) =>
                        setForm({ ...form, short_description: event.target.value })
                      }
                    />
                  </Field>
                  <Field label="Description">
                    <Textarea
                      value={form.description}
                      onChange={(event) => setForm({ ...form, description: event.target.value })}
                      rows={8}
                    />
                  </Field>
                </div>
              </section>

              <section className="rounded-rounded border border-ui-border-base p-4">
                <Text size="small" weight="plus" leading="compact">
                  Translate with AI
                </Text>
                <Text size="small" leading="compact" className="mt-1 text-ui-fg-subtle">
                  Select the source language and generate a draft for the language currently being edited.
                </Text>
                <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
                  <Field label="From">
                    <Select size="small" value={sourceLocale} onValueChange={setSourceLocale}>
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
                  </Field>
                  <Field label="To">
                    <Input value={locale.toUpperCase()} disabled />
                  </Field>
                  <Field label="Tone">
                    <Select
                      size="small"
                      value={tone}
                      onValueChange={(value) => setTone(value as typeof tone)}
                    >
                      <Select.Trigger>
                        <Select.Value />
                      </Select.Trigger>
                      <Select.Content>
                        {TONES.map((item) => (
                          <Select.Item key={item} value={item}>
                            {item}
                          </Select.Item>
                        ))}
                      </Select.Content>
                    </Select>
                  </Field>
                </div>
                <Button
                  size="small"
                  variant="secondary"
                  className="mt-4"
                  isLoading={translateMutation.isPending}
                  disabled={translateMutation.isPending || sourceLocale === locale}
                  onClick={() => translateMutation.mutate()}
                >
                  Translate {sourceLocale.toUpperCase()} to {locale.toUpperCase()}
                </Button>
              </section>

              <section className="rounded-rounded border border-ui-border-base p-4">
                <Text size="small" weight="plus" leading="compact">
                  SEO and metadata
                </Text>
                <div className="mt-4 grid grid-cols-1 gap-4">
                  <Field label="SEO title">
                    <Input
                      value={form.seo_title}
                      onChange={(event) => setForm({ ...form, seo_title: event.target.value })}
                    />
                  </Field>
                  <Field label="SEO description">
                    <Textarea
                      value={form.seo_description}
                      onChange={(event) =>
                        setForm({ ...form, seo_description: event.target.value })
                      }
                      rows={3}
                    />
                  </Field>
                  <Field label="SEO keywords">
                    <Input
                      value={form.seo_keywords}
                      onChange={(event) =>
                        setForm({ ...form, seo_keywords: event.target.value })
                      }
                      placeholder="lamp, decor, bedside"
                    />
                  </Field>
                  <Field label="Custom metadata JSON">
                    <Textarea
                      value={form.metadata_json}
                      onChange={(event) =>
                        setForm({ ...form, metadata_json: event.target.value })
                      }
                      rows={5}
                      placeholder='{"care": "Wipe clean"}'
                    />
                  </Field>
                </div>
              </section>
            </div>
          )}
        </Drawer.Body>
        <Drawer.Footer>
          <div className="flex items-center justify-end gap-x-2">
            <Drawer.Close asChild>
              <Button size="small" variant="secondary">
                Close
              </Button>
            </Drawer.Close>
            {selectedContent && selectedContent.status !== 'published' && (
              <Button
                size="small"
                variant="secondary"
                isLoading={publishMutation.isPending}
                disabled={publishMutation.isPending}
                onClick={() => publishMutation.mutate(selectedContent.id)}
              >
                Publish {locale.toUpperCase()}
              </Button>
            )}
            <Button
              size="small"
              isLoading={saveMutation.isPending}
              disabled={saveMutation.isPending}
              onClick={() => saveMutation.mutate()}
            >
              Save {locale.toUpperCase()} draft
            </Button>
          </div>
        </Drawer.Footer>
      </Drawer.Content>
    </Drawer>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-y-1">
      <Label>{label}</Label>
      {children}
    </div>
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

  return (
    <Container className="mt-4 divide-y divide-ui-border-base">
      <div className="flex items-center justify-between px-6 py-4">
        <div>
          <Text size="small" weight="plus" leading="compact">
            Metadata fields
          </Text>
          <Text size="small" leading="compact" className="mt-1 text-ui-fg-subtle">
            Define reusable editable fields for product or localized content metadata.
          </Text>
        </div>
        <Button size="small" variant="secondary" onClick={() => setShowForm(!showForm)}>
          {showForm ? 'Cancel' : 'Add field'}
        </Button>
      </div>

      {showForm && (
        <div className="grid grid-cols-1 gap-4 bg-ui-bg-subtle px-6 py-4 md:grid-cols-4">
          <Field label="Key">
            <Input
              value={newField.key}
              onChange={(event) => setNewField({ ...newField, key: event.target.value })}
              placeholder="care_instructions"
            />
          </Field>
          <Field label="Label">
            <Input
              value={newField.label}
              onChange={(event) => setNewField({ ...newField, label: event.target.value })}
              placeholder="Care instructions"
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
                {FIELD_TYPES.map((item) => (
                  <Select.Item key={item} value={item}>
                    {item}
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
                {FIELD_SCOPES.map((item) => (
                  <Select.Item key={item} value={item}>
                    {item}
                  </Select.Item>
                ))}
              </Select.Content>
            </Select>
          </Field>
          <div className="md:col-span-4">
            <Button
              size="small"
              isLoading={createMutation.isPending}
              disabled={createMutation.isPending || !newField.key || !newField.label}
              onClick={() => createMutation.mutate(newField)}
            >
              Save field
            </Button>
          </div>
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
