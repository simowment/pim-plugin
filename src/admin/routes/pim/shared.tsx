import { cloneElement, isValidElement, useId, type ReactNode } from 'react'
import { Badge, Label, Text } from '@medusajs/ui'

export const AI_MODES = ['translate', 'rewrite', 'extract_specs', 'seo', 'full'] as const
export const AI_TONES = ['neutral', 'luxury', 'technical', 'seo'] as const
export const TRANSLATE_FIELDS = ['title', 'description', 'short_description', 'specifications'] as const
export const DEFAULT_TRANSLATE_FIELDS = [...TRANSLATE_FIELDS]

export type AiMode = (typeof AI_MODES)[number]
export type AiTone = (typeof AI_TONES)[number]
export type TranslateField = (typeof TRANSLATE_FIELDS)[number]
export type MetadataValue =
  | string
  | number
  | boolean
  | null
  | MetadataValue[]
  | {
      [key: string]: MetadataValue
    }

export interface AdminProductVariant {
  id: string
  sku?: string | null
  title?: string | null
}

export interface AdminProduct {
  id: string
  title: string
  handle?: string | null
  thumbnail?: string | null
  description?: string | null
  variants?: AdminProductVariant[]
}

export interface BulletPoint {
  label?: string
  text: string
}

export interface Specification {
  key: string
  label?: string
  value: string
  unit?: string
  group?: string
}

export interface VariantTitle {
  variant_id: string
  title: string
}

export interface PimContent {
  id: string
  product_id: string
  locale: string
  channel: string
  status: string
  title: string | null
  description: string | null
  short_description: string | null
  variant_titles_json: VariantTitle[] | null
  bullets_json: BulletPoint[] | null
  specifications_json: Specification[] | null
  seo_json: {
    title?: string
    description?: string
    keywords?: string[]
  } | null
  custom_metadata_json: Record<string, unknown> | null
  updated_at: string
}

export interface ProductContentResponse {
  content: PimContent[]
  product?: Pick<AdminProduct, 'id' | 'title' | 'description'> | null
  supplier_specifications: Specification[]
  variants: Array<{ id: string; title: string }>
}

export interface MetadataField {
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
  validation_json?: Record<string, unknown> | null
  sort_order: number
}

export interface ProductContentMutationBody {
  locale?: string | null
  channel?: string
  title?: string | null
  short_description?: string | null
  description?: string | null
  bullets_json?: BulletPoint[] | null
  variant_titles_json?: VariantTitle[] | null
  specifications_json?: Specification[] | null
  seo_json?: {
    title?: string
    description?: string
    keywords: string[]
  }
  custom_metadata_json?: Record<string, unknown> | null
  change_reason: string
}

export interface MetadataFieldMutationBody {
  key?: string
  label: string
  description?: string | null
  type?: string
  scope?: string
  group?: string
  required: boolean
  localized: boolean
  channel_specific: boolean
  visible_in_storefront: boolean
  visible_in_admin?: boolean
  options_json: Array<{ label: string; value: string }> | null
}

export interface PimGeneratedResult {
  title?: string | null
  short_description?: string | null
  description?: string | null
  bullets_json?: BulletPoint[] | null
  variant_titles_json?: VariantTitle[] | null
  specifications_json?: Specification[] | null
  seo_json?: {
    title?: string
    description?: string
    keywords?: string[]
  } | null
  custom_metadata_json?: Record<string, unknown> | null
}

export interface PimJobInput {
  channel?: string | null
  source_locale?: string | null
  target_locale?: string | null
}

export interface PimJob {
  id: string
  type: 'translate' | 'rewrite' | 'extract_specs' | 'seo' | 'full'
  product_id: string | null
  locale: string | null
  status: 'running' | 'completed' | 'failed'
  input_json: PimJobInput | null
  result_json: PimGeneratedResult | null
  error_message: string | null
  created_at: string
}

export interface PimAiSettings {
  provider: string
  model: string
  base_url: string
  temperature: number
  max_tokens: number
  request_timeout_ms: number
  has_api_key: boolean
  api_key_preview: string
  can_update: boolean
  source: 'gateway' | 'pim_settings' | 'environment'
}

export interface PimAiModelOption {
  id: string
  name: string | null
  owned_by: string | null
  context_length: number | null
  supports_response_format: boolean
}

export interface PimAdminConfig {
  default_channel: string
  channels: string[]
}

export const DEFAULT_LOCALES = ['en-US', 'fr-FR', 'es-ES']
export const DEFAULT_CHANNELS = ['storefront', 'default', 'google', 'meta']
export const DEFAULT_AI_PROVIDER = 'openrouter'
export const AI_PROVIDER_DEFAULTS = [
  {
    value: 'openrouter',
    label: 'OpenRouter',
    base_url: 'https://openrouter.ai/api/v1',
    model: 'openai/gpt-4o-mini',
  },
  {
    value: 'openai',
    label: 'OpenAI',
    base_url: 'https://api.openai.com/v1',
    model: 'gpt-4o-mini',
  },
  {
    value: 'kilo',
    label: 'Kilo Code',
    base_url: 'https://api.kilo.ai/api/gateway',
    model: 'kilo-auto/balanced',
  },
]

const STATUS_COLORS: Record<string, 'green' | 'blue' | 'orange' | 'grey' | 'red'> = {
  published: 'green',
  reviewed: 'blue',
  draft: 'grey',
  archived: 'red',
}

export const emptyForm = {
  title: '',
  short_description: '',
  description: '',
  variant_titles_json: [] as VariantTitle[],
  bullets_json: [] as BulletPoint[],
  specifications_json: [] as Specification[],
  seo_title: '',
  seo_description: '',
  seo_keywords: '',
  custom_metadata_json: {} as Record<string, MetadataValue>,
  change_reason: '',
}

export const LoadingState = () => (
  <div className="flex justify-center py-8">
    <Text size="small" className="text-ui-fg-subtle">
      Loading...
    </Text>
  </div>
)

export const ErrorState = ({ message }: { message: string }) => (
  <div className="flex justify-center px-6 py-8">
    <Text size="small" className="text-ui-fg-error">
      {message}
    </Text>
  </div>
)

export const statusBadge = (status?: string | null) =>
  status ? (
    <Badge color={STATUS_COLORS[status] ?? 'grey'} size="2xsmall">
      {status}
    </Badge>
  ) : (
    <Badge color="grey" size="2xsmall">
      missing
    </Badge>
  )

export function isAiMode(value: string): value is AiMode {
  return (AI_MODES as readonly string[]).includes(value)
}

export function isAiTone(value: string): value is AiTone {
  return (AI_TONES as readonly string[]).includes(value)
}

export function normalizeMetadataValues(
  metadata: Record<string, unknown> | null | undefined,
): Record<string, MetadataValue> {
  if (!metadata) {
    return {}
  }

  return Object.fromEntries(
    Object.entries(metadata).filter((entry): entry is [string, MetadataValue] => {
      return isMetadataValue(entry[1])
    }),
  )
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Object.prototype.toString.call(value) === '[object Object]'
}

export function isMetadataValue(value: unknown): value is MetadataValue {
  if (value === null) {
    return true
  }

  if (['string', 'number', 'boolean'].includes(typeof value)) {
    return true
  }

  if (Array.isArray(value)) {
    return value.every(isMetadataValue)
  }

  if (isRecord(value)) {
    return Object.values(value).every(isMetadataValue)
  }

  return false
}

interface FieldProps {
  label: string
  children: ReactNode
  htmlFor?: string
}

export function Field({ label, children, htmlFor }: FieldProps) {
  const generatedId = useId()
  const fieldId = htmlFor ?? generatedId
  const fieldChildren = isValidElement<{ id?: string }>(children) && children.props.id === undefined
    ? cloneElement(children, { id: fieldId })
    : children

  return (
    <div className="flex flex-col gap-y-2">
      <Label htmlFor={fieldId}>{label}</Label>
      {fieldChildren}
    </div>
  )
}
