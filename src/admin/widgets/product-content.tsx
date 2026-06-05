import { defineWidgetConfig } from '@medusajs/admin-sdk'
import { DetailWidgetProps, HttpTypes } from '@medusajs/framework/types'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import {
  Container,
  Button,
  Text,
  Badge,
  Tabs,
  Textarea,
  Input,
  Label,
  Select,
  toast,
} from '@medusajs/ui'
import { sdk } from '../lib/sdk'

// ─── Types ────────────────────────────────────────────────────────────────

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
  bullets_json: Array<{ label?: string; text: string }> | null
  specifications_json: Array<{ key: string; value: string; unit?: string; group?: string }> | null
  seo_json: { title?: string; description?: string; keywords?: string[] } | null
  custom_metadata_json: Record<string, unknown> | null
  updated_at: string
}

type MetadataField = {
  id: string
  key: string
  label: string
  type: string
  visible_in_admin: boolean
}

const LOCALE_OPTIONS = ['en', 'fr', 'es', 'de', 'nl', 'it', 'pt']
const CHANNEL_OPTIONS = ['storefront', 'google', 'meta', 'default']
const STATUS_COLORS: Record<string, 'green' | 'blue' | 'orange' | 'grey' | 'red'> = {
  published: 'green',
  reviewed: 'blue',
  ai_generated: 'orange',
  draft: 'grey',
  archived: 'red',
}

const LoadingState = () => (
  <div className="flex justify-center py-8">
    <Text size="small" className="text-ui-fg-subtle">
      Loading...
    </Text>
  </div>
)

// ─── Widget ────────────────────────────────────────────────────────────────

const ProductContentWidget = ({ data: product }: DetailWidgetProps<HttpTypes.AdminProduct>) => {
  const queryClient = useQueryClient()
  const [locale, setLocale] = useState('en')
  const [channel, setChannel] = useState('storefront')
  const [activeTab, setActiveTab] = useState('description')

  // Draft form state
  const [title, setTitle] = useState('')
  const [subtitle, setSubtitle] = useState('')
  const [description, setDescription] = useState('')
  const [shortDescription, setShortDescription] = useState('')

  // Load content on mount (no conditional — always loads)
  const { data: contentData, isLoading } = useQuery({
    queryKey: ['pim-content', product.id, locale, channel],
    queryFn: () =>
      sdk.client.fetch<{ content: PimContent[] }>(
        `/admin/pim/products/${product.id}/content?locale=${locale}&channel=${channel}`,
      ),
  })

  // Load metadata fields
  const { data: fieldsData } = useQuery({
    queryKey: ['pim-metadata-fields'],
    queryFn: () =>
      sdk.client.fetch<{ metadata_fields: MetadataField[] }>('/admin/pim/metadata-fields'),
  })

  // Load version history
  const { data: versionsData } = useQuery({
    queryKey: ['pim-versions', product.id, locale, channel],
    queryFn: () =>
      sdk.client.fetch<{ content: Array<Record<string, unknown>> }>(
        `/admin/pim/content?product_id=${product.id}&locale=${locale}&channel=${channel}`,
      ),
    enabled: activeTab === 'history',
  })

  const invalidateContent = () => {
    queryClient.invalidateQueries({ queryKey: ['pim-content', product.id, locale, channel] })
  }

  // Save draft mutation
  const saveDraftMutation = useMutation({
    mutationFn: () =>
      sdk.client.fetch(`/admin/pim/products/${product.id}/content`, {
        method: 'POST',
        body: { locale, channel, title, subtitle, description, short_description: shortDescription },
      }),
    onSuccess: () => {
      toast.success('Draft saved')
      invalidateContent()
    },
    onError: (e: Error) => toast.error(e.message),
  })

  // Publish mutation
  const publishMutation = useMutation({
    mutationFn: (contentId: string) =>
      sdk.client.fetch(`/admin/pim/products/${product.id}/publish`, {
        method: 'POST',
        body: { content_id: contentId, archive_previous: true },
      }),
    onSuccess: () => {
      toast.success('Content published')
      invalidateContent()
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const content = contentData?.content?.[0]

  // Sync form when content loads
  const syncForm = (c: PimContent | undefined) => {
    if (!c) return
    setTitle(c.title ?? '')
    setSubtitle(c.subtitle ?? '')
    setDescription(c.description ?? '')
    setShortDescription(c.short_description ?? '')
  }

  return (
    <Container className="divide-y divide-ui-border-base">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4">
        <Text size="small" weight="plus" leading="compact">
          Content &amp; Metadata
        </Text>
        <div className="flex items-center gap-2">
          <Select size="small" value={locale} onValueChange={setLocale}>
            <Select.Trigger>
              <Select.Value placeholder="Locale" />
            </Select.Trigger>
            <Select.Content>
              {LOCALE_OPTIONS.map((l) => (
                <Select.Item key={l} value={l}>
                  {l.toUpperCase()}
                </Select.Item>
              ))}
            </Select.Content>
          </Select>
          <Select size="small" value={channel} onValueChange={setChannel}>
            <Select.Trigger>
              <Select.Value placeholder="Channel" />
            </Select.Trigger>
            <Select.Content>
              {CHANNEL_OPTIONS.map((c) => (
                <Select.Item key={c} value={c}>
                  {c}
                </Select.Item>
              ))}
            </Select.Content>
          </Select>
          {content && (
            <Badge color={STATUS_COLORS[content.status] ?? 'grey'} size="2xsmall">
              {content.status}
            </Badge>
          )}
        </div>
      </div>

      {isLoading ? (
        <LoadingState />
      ) : (
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <Tabs.List className="px-6 pt-2">
            <Tabs.Trigger value="description">Description</Tabs.Trigger>
            <Tabs.Trigger value="specifications">Specifications</Tabs.Trigger>
            <Tabs.Trigger value="seo">SEO</Tabs.Trigger>
            <Tabs.Trigger value="metadata">Metadata</Tabs.Trigger>
            <Tabs.Trigger value="ai">AI</Tabs.Trigger>
            <Tabs.Trigger value="history">History</Tabs.Trigger>
          </Tabs.List>

          {/* Description Tab */}
          <Tabs.Content value="description" className="px-6 py-4 space-y-4">
            <div className="space-y-2">
              <Label>Title</Label>
              <Input
                value={content ? content.title ?? title : title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Product title..."
              />
            </div>
            <div className="space-y-2">
              <Label>Subtitle</Label>
              <Input
                value={content ? content.subtitle ?? subtitle : subtitle}
                onChange={(e) => setSubtitle(e.target.value)}
                placeholder="Product subtitle..."
              />
            </div>
            <div className="space-y-2">
              <Label>Short Description</Label>
              <Input
                value={content ? content.short_description ?? shortDescription : shortDescription}
                onChange={(e) => setShortDescription(e.target.value)}
                placeholder="Brief summary..."
              />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={content ? content.description ?? description : description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Full product description..."
                rows={6}
              />
            </div>
            <div className="flex gap-2 pt-2">
              <Button
                size="small"
                variant="secondary"
                isLoading={saveDraftMutation.isPending}
                disabled={saveDraftMutation.isPending}
                onClick={() => {
                  if (content) syncForm(content)
                  saveDraftMutation.mutate()
                }}
              >
                Save Draft
              </Button>
              {content && ['draft', 'ai_generated', 'reviewed'].includes(content.status) && (
                <Button
                  size="small"
                  isLoading={publishMutation.isPending}
                  disabled={publishMutation.isPending}
                  onClick={() => publishMutation.mutate(content.id)}
                >
                  Publish
                </Button>
              )}
            </div>
          </Tabs.Content>

          {/* Specifications Tab */}
          <Tabs.Content value="specifications" className="px-6 py-4">
            {content?.specifications_json?.length ? (
              <div className="space-y-2">
                {content.specifications_json.map((spec, i) => (
                  <div key={i} className="flex gap-4 text-sm">
                    <Text size="small" weight="plus" className="w-32 shrink-0">
                      {spec.key}
                    </Text>
                    <Text size="small" className="text-ui-fg-subtle">
                      {spec.value}
                      {spec.unit ? ` ${spec.unit}` : ''}
                    </Text>
                  </div>
                ))}
              </div>
            ) : (
              <Text size="small" className="text-ui-fg-subtle">
                No specifications yet. Use the AI tab to extract them.
              </Text>
            )}
          </Tabs.Content>

          {/* SEO Tab */}
          <Tabs.Content value="seo" className="px-6 py-4 space-y-4">
            {content?.seo_json ? (
              <>
                <div className="space-y-1">
                  <Label>SEO Title</Label>
                  <Text size="small">{content.seo_json.title ?? '—'}</Text>
                  <Text size="xsmall" className="text-ui-fg-subtle">
                    {(content.seo_json.title?.length ?? 0)} / 60 chars
                  </Text>
                </div>
                <div className="space-y-1">
                  <Label>SEO Description</Label>
                  <Text size="small">{content.seo_json.description ?? '—'}</Text>
                  <Text size="xsmall" className="text-ui-fg-subtle">
                    {(content.seo_json.description?.length ?? 0)} / 160 chars
                  </Text>
                </div>
                <div className="space-y-1">
                  <Label>Keywords</Label>
                  <Text size="small">{content.seo_json.keywords?.join(', ') ?? '—'}</Text>
                </div>
              </>
            ) : (
              <Text size="small" className="text-ui-fg-subtle">
                No SEO data yet. Use the AI tab to generate it.
              </Text>
            )}
          </Tabs.Content>

          {/* Metadata Tab */}
          <Tabs.Content value="metadata" className="px-6 py-4 space-y-3">
            {fieldsData?.metadata_fields?.filter((f) => f.visible_in_admin).length ? (
              fieldsData.metadata_fields
                .filter((f) => f.visible_in_admin)
                .map((field) => (
                  <div key={field.id} className="flex items-center gap-4">
                    <Text size="small" weight="plus" className="w-40 shrink-0">
                      {field.label}
                    </Text>
                    <Text size="small" className="text-ui-fg-subtle">
                      {String(content?.custom_metadata_json?.[field.key] ?? '—')}
                    </Text>
                  </div>
                ))
            ) : (
              <Text size="small" className="text-ui-fg-subtle">
                No metadata fields defined. Go to the PIM page to configure them.
              </Text>
            )}
          </Tabs.Content>

          {/* AI Tab */}
          <Tabs.Content value="ai" className="px-6 py-4">
            <AiTab productId={product.id} locale={locale} channel={channel} onGenerated={invalidateContent} />
          </Tabs.Content>

          {/* History Tab */}
          <Tabs.Content value="history" className="px-6 py-4">
            <Text size="small" className="text-ui-fg-subtle">
              {versionsData?.content?.length
                ? `${versionsData.content.length} version(s) found.`
                : 'No version history yet.'}
            </Text>
          </Tabs.Content>
        </Tabs>
      )}
    </Container>
  )
}

// ─── AI sub-component ──────────────────────────────────────────────────────

type AiTabProps = {
  productId: string
  locale: string
  channel: string
  onGenerated: () => void
}

const AI_MODES = ['full', 'translate', 'rewrite', 'extract_specs', 'seo'] as const
const AI_TONES = ['neutral', 'luxury', 'technical', 'seo'] as const

function AiTab({ productId, locale, channel, onGenerated }: AiTabProps) {
  const [targetLocale, setTargetLocale] = useState(locale)
  const [mode, setMode] = useState<(typeof AI_MODES)[number]>('full')
  const [tone, setTone] = useState<(typeof AI_TONES)[number]>('neutral')
  const [saveAs, setSaveAs] = useState<'draft' | 'job_only'>('draft')

  const generateMutation = useMutation({
    mutationFn: () =>
      sdk.client.fetch(`/admin/pim/products/${productId}/generate`, {
        method: 'POST',
        body: { target_locale: targetLocale, channel, mode, tone, save_as: saveAs },
      }),
    onSuccess: () => {
      toast.success('Content generated successfully')
      if (saveAs === 'draft') onGenerated()
    },
    onError: (e: Error) => toast.error(`Generation failed: ${e.message}`),
  })

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <Label>Target Locale</Label>
          <Select size="small" value={targetLocale} onValueChange={setTargetLocale}>
            <Select.Trigger><Select.Value /></Select.Trigger>
            <Select.Content>
              {['en', 'fr', 'es', 'de', 'nl', 'it', 'pt'].map((l) => (
                <Select.Item key={l} value={l}>{l.toUpperCase()}</Select.Item>
              ))}
            </Select.Content>
          </Select>
        </div>
        <div className="space-y-1">
          <Label>Mode</Label>
          <Select size="small" value={mode} onValueChange={(v) => setMode(v as typeof mode)}>
            <Select.Trigger><Select.Value /></Select.Trigger>
            <Select.Content>
              {AI_MODES.map((m) => <Select.Item key={m} value={m}>{m}</Select.Item>)}
            </Select.Content>
          </Select>
        </div>
        <div className="space-y-1">
          <Label>Tone</Label>
          <Select size="small" value={tone} onValueChange={(v) => setTone(v as typeof tone)}>
            <Select.Trigger><Select.Value /></Select.Trigger>
            <Select.Content>
              {AI_TONES.map((t) => <Select.Item key={t} value={t}>{t}</Select.Item>)}
            </Select.Content>
          </Select>
        </div>
        <div className="space-y-1">
          <Label>Save As</Label>
          <Select size="small" value={saveAs} onValueChange={(v) => setSaveAs(v as typeof saveAs)}>
            <Select.Trigger><Select.Value /></Select.Trigger>
            <Select.Content>
              <Select.Item value="draft">Draft</Select.Item>
              <Select.Item value="job_only">Job only (preview)</Select.Item>
            </Select.Content>
          </Select>
        </div>
      </div>
      <Button
        size="small"
        isLoading={generateMutation.isPending}
        disabled={generateMutation.isPending}
        onClick={() => generateMutation.mutate()}
      >
        Generate Content
      </Button>
    </div>
  )
}

export const config = defineWidgetConfig({
  zone: 'product.details.after',
})

export default ProductContentWidget
