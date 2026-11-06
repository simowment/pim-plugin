import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Plus, Trash } from '@medusajs/icons'
import { Button, IconButton, Input, Label, Text, Textarea, toast, usePrompt } from '@medusajs/ui'
import { sdk } from '../../lib/sdk'
import { getErrorMessage } from '../../../lib/error-messages'
import { AiDraftHelper } from './ai-draft-helper'
import { usePimAiStatus } from './ai-status'
import { AutoTranslatePanel } from './auto-translate-panel'
import { LocaleStatusStrip } from './locale-status-strip'
import { MetadataFieldInput } from './metadata-field-input'
import { MobileProductPicker } from './mobile-product-picker'
import { ProductEditorHeader } from './product-editor-header'
import {
  ProductEditorActionBar,
  ProductEditorShell,
  ProductEditorWorkspace,
} from './product-editor-shell'
import type { ProductEditorTab } from './product-editor-tabs'
import { ProductListSidebar } from './product-list-sidebar'
import { SeoFieldsPanel } from './seo-fields-panel'
import {
  DEFAULT_CHANNELS,
  DEFAULT_LOCALE,
  DEFAULT_LOCALES,
  DEFAULT_TRANSLATE_FIELDS,
  ErrorState,
  Field,
  LoadingState,
  emptyForm,
  normalizeMetadataValues,
  type AdminProduct,
  type AiMode,
  type AiTone,
  type BulletPoint,
  type MetadataField,
  type MetadataValue,
  type PimAdminConfig,
  type PimContent,
  type ProductContentResponse,
  type Specification,
  type TranslateField,
  type VariantTitle,
} from './shared'

const PRODUCTS_PAGE_SIZE = 10
const VARIANT_TITLE_PAGE_SIZE = 8
const FIRST_PAGE_INDEX = 0
const PAGE_DISPLAY_OFFSET = 1

function readLinkedProductId(): string {
  if (typeof window === 'undefined') return ''
  const value = new URLSearchParams(window.location.search).get('product_id') ?? ''
  return /^[A-Za-z0-9_]{1,64}$/.test(value) ? value : ''
}

interface ProductsTabProps {
  onOpenAiSetup?: () => void
}

export function ProductsTab({ onOpenAiSetup }: ProductsTabProps = {}) {
  const queryClient = useQueryClient()
  const prompt = usePrompt()
  const aiStatus = usePimAiStatus()
  const [search, setSearch] = useState('')
  // `?product_id=` deep link (the product page's "Edit product content" link).
  const [linkedProductId] = useState(readLinkedProductId)
  const [selectedProductId, setSelectedProductId] = useState(linkedProductId)
  const [selectedProductSnapshot, setSelectedProductSnapshot] = useState<AdminProduct | null>(null)
  const [locale, setLocale] = useState(DEFAULT_LOCALE)
  const [form, setForm] = useState(emptyForm)
  const [productPage, setProductPage] = useState(0)
  const [variantTitlePage, setVariantTitlePage] = useState(FIRST_PAGE_INDEX)
  const [metadataErrors, setMetadataErrors] = useState<Record<string, string>>({})
  const productsPerPage = PRODUCTS_PAGE_SIZE

  // AI drafting configuration (translation has its own one-step panel)
  const [aiMode, setAiMode] = useState<AiMode>('rewrite')
  const [aiTone, setAiTone] = useState<AiTone>('neutral')
  const [editorTab, setEditorTab] = useState<ProductEditorTab>('copy')

  const configQuery = useQuery({
    queryKey: ['pim-admin-config'],
    queryFn: () => sdk.client.fetch<{ config: PimAdminConfig }>('/admin/pim/config'),
  })
  const defaultChannel = configQuery.data?.config.default_channel ?? DEFAULT_CHANNELS[0]
  const channel = defaultChannel
  const configuredLocales = configQuery.data?.config.locales
  const locales = useMemo(
    () => (configuredLocales?.length ? configuredLocales : DEFAULT_LOCALES),
    [configuredLocales],
  )
  const configuredDefaultLocale = configQuery.data?.config.default_locale
  // The base language: the only one pre-filled from the Medusa product itself.
  const baseLocale =
    configuredDefaultLocale && locales.includes(configuredDefaultLocale)
      ? configuredDefaultLocale
      : (locales[0] ?? DEFAULT_LOCALE)
  const isBaseLocale = locale === baseLocale
  const appliedConfigLocale = useRef(false)

  useEffect(() => {
    if (appliedConfigLocale.current || !configQuery.data) {
      return
    }
    appliedConfigLocale.current = true
    const initialLocale =
      configuredDefaultLocale && locales.includes(configuredDefaultLocale)
        ? configuredDefaultLocale
        : locales[0]
    if (initialLocale) {
      setLocale(initialLocale)
    }
  }, [configQuery.data, configuredDefaultLocale, locales])

  // Fetch custom metadata field definitions
  const metadataFieldsQuery = useQuery({
    queryKey: ['pim-metadata-fields'],
    queryFn: () =>
      sdk.client.fetch<{ metadata_fields: MetadataField[] }>('/admin/pim/metadata-fields'),
  })
  const contentMetadataFields = useMemo(() => {
    return (
      metadataFieldsQuery.data?.metadata_fields?.filter(
        (f) => f.scope === 'content' || f.scope === 'product',
      ) ?? []
    )
  }, [metadataFieldsQuery.data])

  const productsQuery = useQuery({
    queryKey: ['pim-products', search, productPage],
    queryFn: () =>
      sdk.admin.product.list({
        limit: productsPerPage,
        offset: productPage * productsPerPage,
        q: search || undefined,
        fields: 'id,title,handle,thumbnail,description,variants.id,variants.title,variants.sku',
      } as Record<string, unknown>) as Promise<{ products: AdminProduct[]; count: number }>,
  })

  const products = productsQuery.data?.products ?? []
  const productCount = productsQuery.data?.count ?? 0

  useEffect(() => {
    const firstProductId = products[0]?.id
    if (firstProductId && !selectedProductId) {
      setSelectedProductId(firstProductId)
    }
  }, [products, selectedProductId])

  // A deep-linked product may not be on the current list page: load it once.
  const linkedProductQuery = useQuery({
    queryKey: ['pim-linked-product', linkedProductId],
    queryFn: () =>
      sdk.admin.product.retrieve(linkedProductId, {
        fields: 'id,title,handle,thumbnail,description,variants.id,variants.title,variants.sku',
      } as Record<string, unknown>) as Promise<{ product: AdminProduct }>,
    enabled: Boolean(linkedProductId),
    retry: false,
  })

  useEffect(() => {
    const linked = linkedProductQuery.data?.product
    if (linked && !selectedProductSnapshot) {
      setSelectedProductSnapshot(linked)
    }
  }, [linkedProductQuery.data, selectedProductSnapshot])

  const selectedProduct = useMemo(
    () =>
      products.find((product) => product.id === selectedProductId) ??
      (selectedProductSnapshot?.id === selectedProductId ? selectedProductSnapshot : null),
    [products, selectedProductId, selectedProductSnapshot],
  )

  useEffect(() => {
    if (selectedProduct) {
      setSelectedProductSnapshot(selectedProduct)
    }
  }, [selectedProduct])

  const contentQuery = useQuery({
    queryKey: ['pim-product-content', selectedProductId, locale, channel],
    queryFn: () => {
      const query = new URLSearchParams({ locale, channel })
      return sdk.client.fetch<ProductContentResponse>(
        `/admin/pim/products/${selectedProductId}/content?${query.toString()}`,
      )
    },
    enabled: Boolean(selectedProductId && configQuery.data?.config),
  })

  const allContentQuery = useQuery({
    queryKey: ['pim-product-content-all', selectedProductId],
    queryFn: () => {
      const query = new URLSearchParams({ product_id: selectedProductId, limit: '100' })
      return sdk.client.fetch<{ content: PimContent[] }>(`/admin/pim/content?${query.toString()}`)
    },
    enabled: Boolean(selectedProductId && configQuery.data?.config),
  })

  // Unpublished (archived) records are history: the editor starts from the defaults again.
  const activeContent = contentQuery.data?.content?.find(
    (content) => content.status !== 'archived',
  )
  const baseSpecifications = useMemo(
    () => contentQuery.data?.supplier_specifications ?? [],
    [contentQuery.data?.supplier_specifications],
  )
  // Only the base language starts from the supplier facts; other languages start empty.
  const displayedSpecifications = useMemo(
    () =>
      activeContent?.specifications_json?.length
        ? activeContent.specifications_json
        : isBaseLocale
          ? baseSpecifications
          : [],
    [activeContent?.specifications_json, baseSpecifications, isBaseLocale],
  )
  const variants = useMemo(() => {
    const skuById = new Map(
      (selectedProduct?.variants ?? []).map((variant) => [variant.id, variant.sku ?? null]),
    )
    return (contentQuery.data?.variants ?? selectedProduct?.variants ?? []).map((variant) => ({
      id: variant.id,
      title: variant.title ?? '',
      sku: skuById.get(variant.id) ?? null,
    }))
  }, [contentQuery.data?.variants, selectedProduct?.variants])
  const baseVariantTitles = useMemo<VariantTitle[]>(
    () => variants.map((variant) => ({ variant_id: variant.id, title: variant.title ?? '' })),
    [variants],
  )
  const displayedVariantTitles = useMemo<VariantTitle[]>(
    () =>
      activeContent?.variant_titles_json?.length
        ? activeContent.variant_titles_json
        : isBaseLocale
          ? baseVariantTitles
          : [],
    [activeContent?.variant_titles_json, baseVariantTitles, isBaseLocale],
  )
  const variantTitlePageCount = Math.ceil(variants.length / VARIANT_TITLE_PAGE_SIZE)
  const currentVariantTitlePage = variantTitlePageCount
    ? Math.min(variantTitlePage, variantTitlePageCount - PAGE_DISPLAY_OFFSET)
    : FIRST_PAGE_INDEX
  const variantTitleStart = currentVariantTitlePage * VARIANT_TITLE_PAGE_SIZE
  const variantTitleEnd = Math.min(variantTitleStart + VARIANT_TITLE_PAGE_SIZE, variants.length)
  const visibleVariants = variants.slice(variantTitleStart, variantTitleEnd)
  const hasVariantTitlePagination = variants.length > VARIANT_TITLE_PAGE_SIZE
  const variantTitleDisplayStart = variants.length
    ? variantTitleStart + PAGE_DISPLAY_OFFSET
    : FIRST_PAGE_INDEX

  // What the editor starts from. PIM-B2: only the base language is pre-filled
  // from the Medusa product; other languages start empty (the base text is
  // shown as a placeholder and can be copied in with "Copy from base").
  const initialForm = useMemo(
    () => ({
      title: activeContent?.title ?? (isBaseLocale ? (selectedProduct?.title ?? '') : ''),
      short_description: activeContent?.short_description ?? '',
      description:
        activeContent?.description ?? (isBaseLocale ? (selectedProduct?.description ?? '') : ''),
      variant_titles_json: displayedVariantTitles,
      bullets_json: activeContent?.bullets_json ?? [],
      specifications_json: displayedSpecifications,
      seo_title: String(activeContent?.seo_json?.title ?? ''),
      seo_description: String(activeContent?.seo_json?.description ?? ''),
      seo_keywords: Array.isArray(activeContent?.seo_json?.keywords)
        ? activeContent.seo_json.keywords.join(', ')
        : '',
      custom_metadata_json: normalizeMetadataValues(activeContent?.custom_metadata_json),
      change_reason: '',
    }),
    [
      activeContent,
      isBaseLocale,
      selectedProduct?.title,
      selectedProduct?.description,
      displayedVariantTitles,
      displayedSpecifications,
    ],
  )

  // Detect draft dirtiness against exactly what the editor started from.
  const isDirty = useMemo(() => {
    if (!selectedProduct) return false
    const { change_reason: _ignoredReason, ...current } = form
    const { change_reason: _ignoredInitialReason, ...initial } = initialForm
    return JSON.stringify(current) !== JSON.stringify(initial)
  }, [form, initialForm, selectedProduct])

  useEffect(() => {
    setForm(initialForm)
  }, [initialForm, selectedProductId, locale, channel])

  useEffect(() => {
    setMetadataErrors({})
  }, [selectedProductId, locale, channel])

  useEffect(() => {
    setVariantTitlePage(FIRST_PAGE_INDEX)
  }, [selectedProductId])

  const confirmSwitch = async () => {
    if (!isDirty) {
      return true
    }
    return prompt({
      title: 'Discard unsaved changes?',
      description: 'Your changes to this product content are not saved yet.',
      confirmText: 'Discard',
      cancelText: 'Keep editing',
    })
  }

  const handleProductSelect = (id: string) => {
    void confirmSwitch().then((confirmed) => {
      if (confirmed) setSelectedProductId(id)
    })
    return true
  }

  const handleLocaleSelect = (item: string) => {
    void confirmSwitch().then((confirmed) => {
      if (confirmed) setLocale(item)
    })
    return true
  }

  const copyFromBase = () => {
    setForm((current) => ({
      ...current,
      title: current.title || selectedProduct?.title || '',
      description: current.description || selectedProduct?.description || '',
      variant_titles_json: baseVariantTitles.map(
        (base) =>
          current.variant_titles_json.find(
            (item) => item.variant_id === base.variant_id && item.title,
          ) ?? base,
      ),
      specifications_json: current.specifications_json.length
        ? current.specifications_json
        : baseSpecifications,
    }))
  }

  const invalidateContent = () => {
    queryClient.invalidateQueries({
      queryKey: ['pim-product-content', selectedProductId, locale, channel],
    })
    queryClient.invalidateQueries({ queryKey: ['pim-product-content-all', selectedProductId] })
    queryClient.invalidateQueries({ queryKey: ['pim-content-list'] })
    queryClient.invalidateQueries({ queryKey: ['pim-jobs'] })
  }

  const buildDraftBody = () => ({
    locale,
    channel,
    title: form.title || null,
    short_description: form.short_description || null,
    description: form.description || null,
    variant_titles_json: form.variant_titles_json.filter((item) => item.title.trim()),
    bullets_json: form.bullets_json,
    specifications_json: form.specifications_json,
    seo_json: {
      title: form.seo_title || undefined,
      description: form.seo_description || undefined,
      keywords: form.seo_keywords
        .split(',')
        .map((keyword) => keyword.trim())
        .filter((keyword) => Boolean(keyword)),
    },
    custom_metadata_json: form.custom_metadata_json,
    change_reason: form.change_reason || `PIM ${locale}/${channel} edit`,
  })

  const saveDraftMutation = useMutation({
    mutationFn: () =>
      sdk.client.fetch<{ content: PimContent }>(
        `/admin/pim/products/${selectedProductId}/content`,
        {
          method: 'POST',
          body: buildDraftBody(),
        },
      ),
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
          target_locale: locale,
          channel,
          mode: aiMode,
          tone: aiTone,
          save_as: 'draft',
        },
      }),
    onSuccess: () => {
      toast.success('AI draft created. Review it in the AI review queue.')
      invalidateContent()
    },
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error), { duration: 8000 })
      console.error('[PIM] Generate error:', error)
    },
  })

  const saveCurrentDraftForTranslation = async () => {
    await sdk.client.fetch(`/admin/pim/products/${selectedProductId}/content`, {
      method: 'POST',
      body: buildDraftBody(),
    })
  }

  const translateCopySpecsDraft = async (sourceLocale: string, targetLocale: string, fields: TranslateField[]) => {
    await sdk.client.fetch(`/admin/pim/products/${selectedProductId}/generate`, {
      method: 'POST',
      body: {
        source_locale: sourceLocale,
        target_locale: targetLocale,
        channel,
        mode: 'translate',
        tone: aiTone,
        content_scope: 'copy_specs',
        translate_fields: fields,
        save_as: 'draft',
      },
    })
  }

  const translateHereMutation = useMutation({
    mutationFn: () => translateCopySpecsDraft(baseLocale, locale, DEFAULT_TRANSLATE_FIELDS),
    onSuccess: () => {
      toast.success(`${locale.toUpperCase()} translation draft is in the AI review queue.`)
      invalidateContent()
    },
    onError: (error: unknown) => toast.error(getErrorMessage(error), { duration: 8000 }),
  })

  const unpublishMutation = useMutation({
    mutationFn: (contentId: string) =>
      sdk.client.fetch<{ removed_translations: number }>(
        `/admin/pim/content/${contentId}/archive`,
        { method: 'POST' },
      ),
    onSuccess: () => {
      toast.success(
        `Unpublished ${locale.toUpperCase()}. The storefront shows the product's own text again.`,
      )
      invalidateContent()
    },
    onError: (error: Error) => toast.error(error.message),
  })

  const handleUnpublish = async () => {
    if (!activeContent?.id) return
    const confirmed = await prompt({
      title: `Unpublish ${locale.toUpperCase()}?`,
      description:
        "The storefront goes back to the product's own title and description for this language, and the translation copied to the store is removed. The editor then starts from the product text again.",
      confirmText: 'Unpublish',
      cancelText: 'Cancel',
    })
    if (confirmed) {
      unpublishMutation.mutate(activeContent.id)
    }
  }

  const canPublish = activeContent && ['draft', 'reviewed'].includes(activeContent.status)
  const canUnpublish = activeContent?.status === 'published'
  const hasMetadataErrors = Object.values(metadataErrors).some((message) => Boolean(message))

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

  const updateVariantTitle = (variantId: string, title: string) => {
    const existing = form.variant_titles_json.filter((item) => item.variant_id !== variantId)
    setForm({
      ...form,
      variant_titles_json: [...existing, { variant_id: variantId, title }],
    })
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

  const setMetadataValue = (key: string, value: MetadataValue) => {
    setForm({
      ...form,
      custom_metadata_json: {
        ...form.custom_metadata_json,
        [key]: value,
      },
    })
  }

  const setMetadataError = useCallback((key: string, message: string) => {
    setMetadataErrors((current) => ({ ...current, [key]: message }))
  }, [])

  return (
    <div className="mt-2 grid grid-cols-1 gap-3 lg:grid-cols-[15rem_minmax(0,1fr)]">
      <ProductListSidebar
        className="hidden lg:flex"
        products={products}
        selectedProductId={selectedProductId}
        search={search}
        productPage={productPage}
        productsPerPage={productsPerPage}
        productCount={productCount}
        isLoading={productsQuery.isLoading}
        onProductSelect={handleProductSelect}
        onSearchChange={(value) => {
          setSearch(value)
          setProductPage(0)
        }}
        onPreviousPage={() => setProductPage(productPage - 1)}
        onNextPage={() => setProductPage(productPage + 1)}
      />

      <div className="flex min-w-0 flex-col gap-3">
        <MobileProductPicker
          products={products}
          selectedProduct={selectedProduct}
          selectedProductId={selectedProductId}
          search={search}
          productPage={productPage}
          productsPerPage={productsPerPage}
          productCount={productCount}
          isLoading={productsQuery.isLoading}
          onProductSelect={handleProductSelect}
          onSearchChange={(value) => {
          setSearch(value)
          setProductPage(0)
        }}
        onPreviousPage={() => setProductPage(productPage - 1)}
        onNextPage={() => setProductPage(productPage + 1)}
        />

        <ProductEditorShell>
          {configQuery.isLoading ? (
            <LoadingState />
          ) : configQuery.isError ? (
            <ErrorState
              message={`Could not load the product content settings: ${
                (configQuery.error as Error | null)?.message ?? 'unknown error'
              }`}
            />
          ) : (
            <>
              <ProductEditorHeader
                content={activeContent}
                product={selectedProduct}
                productId={selectedProductId}
              />

              {!selectedProduct ? (
            <div className="flex flex-1 items-center justify-center p-8">
              <Text size="small" className="text-ui-fg-subtle">
                Pick a product on the left to edit its storefront text.
              </Text>
            </div>
          ) : contentQuery.isLoading ? (
            <LoadingState />
          ) : contentQuery.isError ? (
            <ErrorState
              message={`Could not load this product's content: ${
                (contentQuery.error as Error | null)?.message ?? 'unknown error'
              }`}
            />
          ) : (
            <ProductEditorWorkspace
              activeTab={editorTab}
              actionBar={
                <ProductEditorActionBar
                  canPublish={canPublish}
                  canUnpublish={canUnpublish}
                  isDirty={isDirty}
                  isUnpublishing={unpublishMutation.isPending}
                  onUnpublish={() => void handleUnpublish()}
                  changeReason={form.change_reason}
                  hasMetadataErrors={hasMetadataErrors}
                  isPublishing={publishMutation.isPending}
                  isSaving={saveDraftMutation.isPending}
                  locale={locale}
                  selectedProductId={selectedProductId}
                  onChangeReasonChange={(change_reason) => setForm({ ...form, change_reason })}
                  onPublish={() => activeContent?.id && publishMutation.mutate(activeContent.id)}
                  onSaveDraft={() => saveDraftMutation.mutate()}
                />
              }
              localeStatus={
                <LocaleStatusStrip
                  baseLocale={baseLocale}
                  channel={channel}
                  contents={allContentQuery.data?.content}
                  locale={locale}
                  locales={locales}
                  onLocaleSelect={handleLocaleSelect}
                />
              }
              onTabChange={setEditorTab}
            >
              {editorTab === 'copy' && (
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_18rem] 2xl:grid-cols-[minmax(0,1.25fr)_minmax(20rem,0.75fr)]">
                  {!isBaseLocale && (
                    <div className="bg-ui-bg-subtle flex flex-col gap-2 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between lg:col-span-2">
                      <Text size="small" leading="compact" className="text-ui-fg-subtle">
                        {locale.toUpperCase()} translation. Empty fields show the{' '}
                        {baseLocale.toUpperCase()} product text in grey; the storefront uses that
                        text until you publish a translation.
                      </Text>
                      <div className="flex shrink-0 gap-2">
                        <Button size="small" variant="secondary" onClick={copyFromBase}>
                          Copy from base
                        </Button>
                        <Button
                          size="small"
                          variant="secondary"
                          isLoading={translateHereMutation.isPending}
                          disabled={!aiStatus.ready || translateHereMutation.isPending}
                          title={aiStatus.ready ? undefined : 'AI is not set up (see the AI setup tab)'}
                          onClick={() => translateHereMutation.mutate()}
                        >
                          Translate from {baseLocale.toUpperCase()} with AI
                        </Button>
                      </div>
                    </div>
                  )}

                  <div className="space-y-3">
                    <Text size="base" weight="plus" className="border-b pb-2">
                      Text
                    </Text>
                    <div className="grid grid-cols-1 gap-3 2xl:grid-cols-2">
                      <Field label="Title">
                        <Input
                          value={form.title}
                          placeholder={isBaseLocale ? undefined : (selectedProduct?.title ?? '')}
                          onChange={(event) => setForm({ ...form, title: event.target.value })}
                        />
                      </Field>
                      <Field label="Short description (subtitle)">
                        <Input
                          value={form.short_description}
                          onChange={(event) =>
                            setForm({ ...form, short_description: event.target.value })
                          }
                        />
                      </Field>
                    </div>
                    <Field label="Description">
                      <Textarea
                        rows={7}
                        value={form.description}
                        placeholder={
                          isBaseLocale ? undefined : (selectedProduct?.description ?? '')
                        }
                        onChange={(event) => setForm({ ...form, description: event.target.value })}
                      />
                    </Field>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between border-b pb-2">
                      <Text size="base" weight="plus">
                        Highlights
                      </Text>
                      <Button size="small" variant="secondary" onClick={addBullet}>
                        <Plus /> Add highlight
                      </Button>
                    </div>
                    <div className="grid grid-cols-1 gap-2 md:grid-cols-2 lg:grid-cols-1">
                      {form.bullets_json.map((bullet, index) => (
                        <div
                          key={index}
                          className="bg-ui-bg-subtle flex items-start gap-2 rounded-lg border p-2"
                        >
                          <div className="min-w-0 flex-1 space-y-2">
                            <Input
                              placeholder="Label"
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
                          <IconButton
                            size="small"
                            variant="transparent"
                            aria-label={`Remove bullet ${index + PAGE_DISPLAY_OFFSET}`}
                            onClick={() => removeBullet(index)}
                          >
                            <Trash className="text-ui-fg-danger" />
                          </IconButton>
                        </div>
                      ))}
                      {!form.bullets_json.length && (
                        <Text size="small" className="text-ui-fg-muted italic">
                          No highlights. Optional short selling points.
                        </Text>
                      )}
                    </div>
                  </div>

                  <div className="space-y-3 lg:col-span-2">
                    <div className="flex flex-col gap-3 border-b pb-3 sm:flex-row sm:items-end sm:justify-between">
                      <div className="min-w-0">
                        <Text size="base" weight="plus">
                          Variant names
                      </Text>
                      <Text size="small" leading="compact" className="text-ui-fg-subtle">
                        {isBaseLocale
                          ? 'The variant names customers see.'
                          : `Variant names in ${locale.toUpperCase()}. Empty names keep the product's own name.`}
                      </Text>
                        {variants.length > FIRST_PAGE_INDEX && (
                          <Text size="xsmall" leading="compact" className="text-ui-fg-muted mt-1">
                            Showing {variantTitleDisplayStart}-{variantTitleEnd} of{' '}
                            {variants.length}
                          </Text>
                        )}
                      </div>
                      {hasVariantTitlePagination && (
                        <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center">
                          <Button
                            size="small"
                            variant="secondary"
                            className="w-full sm:w-auto"
                            disabled={currentVariantTitlePage === FIRST_PAGE_INDEX}
                            onClick={() =>
                              setVariantTitlePage((page) =>
                                Math.max(FIRST_PAGE_INDEX, page - PAGE_DISPLAY_OFFSET),
                              )
                            }
                          >
                            Previous
                          </Button>
                          <Button
                            size="small"
                            variant="secondary"
                            className="w-full sm:w-auto"
                            disabled={
                              currentVariantTitlePage >= variantTitlePageCount - PAGE_DISPLAY_OFFSET
                            }
                            onClick={() =>
                              setVariantTitlePage((page) =>
                                Math.min(
                                  variantTitlePageCount - PAGE_DISPLAY_OFFSET,
                                  page + PAGE_DISPLAY_OFFSET,
                                ),
                              )
                            }
                          >
                            Next
                          </Button>
                        </div>
                      )}
                    </div>
                    <div className="space-y-2">
                      {visibleVariants.map((variant) => {
                        const translatedTitle =
                          form.variant_titles_json.find((item) => item.variant_id === variant.id)
                            ?.title ?? (isBaseLocale ? (variant.title ?? '') : '')

                        return (
                          <div
                            key={variant.id}
                            className="bg-ui-bg-subtle grid grid-cols-1 gap-2 rounded-lg border p-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)]"
                          >
                            <div className="min-w-0">
                              <Text
                                size="small"
                                leading="compact"
                                weight="plus"
                                className="truncate"
                              >
                                {variant.title || 'Untitled variant'}
                              </Text>
                              {variant.sku && (
                                <Text
                                  size="xsmall"
                                  leading="compact"
                                  className="text-ui-fg-subtle truncate"
                                >
                                  SKU {variant.sku}
                                </Text>
                              )}
                            </div>
                            <Input
                              value={translatedTitle}
                              aria-label={`Name in ${locale.toUpperCase()} for variant ${variant.title || variant.sku || ''}`}
                              onChange={(event) =>
                                updateVariantTitle(variant.id, event.target.value)
                              }
                              placeholder={variant.title || 'Variant name'}
                            />
                          </div>
                        )
                      })}
                      {variants.length === FIRST_PAGE_INDEX && (
                        <Text size="small" className="text-ui-fg-subtle">
                          No variants found for this product.
                        </Text>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {editorTab === 'specs' && (
                <>
                  {/* Dynamic Metadata Attributes */}
                  <div className="space-y-4">
                    <div className="border-b pb-2">
                      <Text size="base" weight="plus">
                        Template fields
                      </Text>
                      <Text size="xsmall" className="text-ui-fg-subtle">
                        Fields defined on the Field templates tab, the same for every product.
                      </Text>
                    </div>
                    {metadataFieldsQuery.isError ? (
                      <ErrorState message="Could not load the field templates." />
                    ) : contentMetadataFields.length > 0 ? (
                      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        {contentMetadataFields.map((field) => {
                          const rawValue = form.custom_metadata_json[field.key]
                          return (
                            <div
                              key={field.id}
                              className="bg-ui-bg-subtle flex flex-col gap-2 rounded-lg border p-3"
                            >
                              <div className="flex items-center justify-between">
                                <span>{field.label}</span>
                                <span className="text-ui-fg-muted font-mono text-[10px]">
                                  {field.key}
                                </span>
                              </div>
                              {field.description && (
                                <Text size="xsmall" className="text-ui-fg-subtle mb-1">
                                  {field.description}
                                </Text>
                              )}

                              <MetadataFieldInput
                                field={field}
                                value={rawValue}
                                onChange={(value) => setMetadataValue(field.key, value)}
                                onErrorChange={(message) => setMetadataError(field.key, message)}
                              />
                            </div>
                          )
                        })}
                      </div>
                    ) : (
                      <Text size="small" className="text-ui-fg-muted italic">
                        No field templates yet. Add them on the Field templates tab, or type
                        specifications below.
                      </Text>
                    )}
                  </div>

                  {/* Specifications Editor */}
                  <div className="space-y-3 pt-6">
                    <div className="flex items-center justify-between border-b pb-2">
                      <div className="space-y-1">
                        <Text size="base" weight="plus">
                          Specifications
                        </Text>
                        <Text size="xsmall" className="text-ui-fg-subtle">
                          {form.specifications_json.length
                            ? `${form.specifications_json.length} product facts, such as material or size.`
                            : isBaseLocale
                              ? 'Product facts such as material, size or care.'
                              : `No ${locale.toUpperCase()} specifications. Use "Copy from base" on the Copy tab to start from the base ones.`}
                        </Text>
                      </div>
                      <Button size="small" variant="secondary" onClick={addSpec}>
                        <Plus /> Add specification
                      </Button>
                    </div>
                    {form.specifications_json.length > 0 ? (
                      <div className="space-y-3">
                        {form.specifications_json.map((spec, index) => {
                          const title = spec.label || spec.key || `Specification ${index + 1}`
                          const hasSource = Boolean(spec.group || spec.key)
                          const specLabelId = `pim-spec-${index}-label`
                          const specValueId = `pim-spec-${index}-value`
                          const specUnitId = `pim-spec-${index}-unit`
                          const specGroupId = `pim-spec-${index}-group`
                          const specKeyId = `pim-spec-${index}-key`

                          return (
                            <div
                              key={index}
                              className="border-ui-border-base bg-ui-bg-subtle rounded-md border p-3"
                            >
                              <div className="mb-3 flex items-start justify-between gap-3">
                                <div className="min-w-0 space-y-1">
                                  <Text size="small" weight="plus" className="truncate">
                                    {title}
                                  </Text>
                                  <Text size="xsmall" className="text-ui-fg-subtle">
                                    {hasSource
                                      ? [spec.group, spec.key]
                                          .filter((part) => Boolean(part))
                                          .join(' / ')
                                      : 'No source group or key set'}
                                  </Text>
                                </div>
                                <IconButton
                                  size="small"
                                  variant="transparent"
                                  aria-label={`Remove ${title}`}
                                  onClick={() => removeSpec(index)}
                                >
                                  <Trash className="text-ui-fg-danger" />
                                </IconButton>
                              </div>

                              <div className="grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_7rem]">
                                <div className="flex flex-col gap-1">
                                  <Label htmlFor={specLabelId} className="text-ui-fg-subtle text-xs">
                                    Label
                                  </Label>
                                  <Input
                                    id={specLabelId}
                                    placeholder="Material"
                                    value={spec.label ?? ''}
                                    onChange={(event) =>
                                      updateSpec(index, { label: event.target.value })
                                    }
                                  />
                                </div>
                                <div className="flex flex-col gap-1">
                                  <Label htmlFor={specValueId} className="text-ui-fg-subtle text-xs">
                                    Value
                                  </Label>
                                  <Input
                                    id={specValueId}
                                    placeholder="PU, 60 cm, indoor/outdoor"
                                    value={spec.value}
                                    onChange={(event) =>
                                      updateSpec(index, { value: event.target.value })
                                    }
                                  />
                                </div>
                                <div className="flex flex-col gap-1">
                                  <Label htmlFor={specUnitId} className="text-ui-fg-subtle text-xs">
                                    Unit
                                  </Label>
                                  <Input
                                    id={specUnitId}
                                    placeholder="optional"
                                    value={spec.unit ?? ''}
                                    onChange={(event) =>
                                      updateSpec(index, { unit: event.target.value })
                                    }
                                  />
                                </div>
                              </div>

                              <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
                                <div className="flex flex-col gap-1">
                                  <Label htmlFor={specGroupId} className="text-ui-fg-subtle text-xs">
                                    Group
                                  </Label>
                                  <Input
                                    id={specGroupId}
                                    placeholder="supplier"
                                    value={spec.group ?? ''}
                                    onChange={(event) =>
                                      updateSpec(index, { group: event.target.value })
                                    }
                                  />
                                </div>
                                <div className="flex flex-col gap-1">
                                  <Label htmlFor={specKeyId} className="text-ui-fg-subtle text-xs">
                                    Key
                                  </Label>
                                  <Input
                                    id={specKeyId}
                                    placeholder="material"
                                    value={spec.key}
                                    onChange={(event) =>
                                      updateSpec(index, { key: event.target.value })
                                    }
                                  />
                                </div>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    ) : (
                      <Text size="small" className="text-ui-fg-muted italic">
                        No specifications.
                      </Text>
                    )}
                  </div>
                </>
              )}

              {editorTab === 'ai' && (
                <div className="space-y-4">
                  <AutoTranslatePanel
                    baseLocale={baseLocale}
                    locales={locales}
                    selectedProductId={selectedProductId}
                    saveBaseFirst={isDirty && isBaseLocale}
                    isBusy={saveDraftMutation.isPending || generateMutation.isPending}
                    aiStatus={aiStatus}
                    onOpenAiSetup={onOpenAiSetup}
                    onSaveSource={saveCurrentDraftForTranslation}
                    onTranslateLocale={translateCopySpecsDraft}
                    onComplete={invalidateContent}
                  />
                  <AiDraftHelper
                    mode={aiMode}
                    tone={aiTone}
                    targetLocale={locale}
                    isGenerating={generateMutation.isPending}
                    aiStatus={aiStatus}
                    onOpenAiSetup={onOpenAiSetup}
                    onModeChange={setAiMode}
                    onToneChange={setAiTone}
                    onGenerate={() => generateMutation.mutate()}
                  />
                </div>
              )}

              {editorTab === 'seo_ai' && (
                <>
                  <SeoFieldsPanel
                    title={form.seo_title}
                    description={form.seo_description}
                    keywords={form.seo_keywords}
                    productTitle={selectedProduct?.title ?? null}
                    onTitleChange={(value) => setForm({ ...form, seo_title: value })}
                    onDescriptionChange={(value) => setForm({ ...form, seo_description: value })}
                    onKeywordsChange={(value) => setForm({ ...form, seo_keywords: value })}
                  />
                </>
              )}
            </ProductEditorWorkspace>
          )}
            </>
          )}
        </ProductEditorShell>
      </div>
    </div>
  )
}
