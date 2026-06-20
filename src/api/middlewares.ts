import {
  defineMiddlewares,
  validateAndTransformBody,
  validateAndTransformQuery,
} from '@medusajs/framework/http'
import { z } from '@medusajs/framework/zod'
import { createFindParams } from '@medusajs/medusa/api/utils/validators'
import {
  METADATA_FIELD_SCOPES,
  METADATA_FIELD_TYPES,
  METADATA_FIELD_WRITE_POLICIES,
} from '../lib/metadata-fields'
import { parseCanonicalPimLocale } from '../lib/locales'

export const BATCH_CONTENT_PRODUCT_LIMIT = 50
const CANONICAL_LOCALE_ERROR = 'Locale must be a canonical BCP 47 code with a region, for example fr-FR.'

// Body schemas

const BulletSchema = z.object({
  label: z.string().optional(),
  text: z.string(),
})

const SpecSchema = z.object({
  key: z.string(),
  label: z.string().optional(),
  value: z.string(),
  unit: z.string().optional(),
  group: z.string().optional(),
})

const VariantTitleSchema = z.object({
  variant_id: z.string(),
  title: z.string(),
})

const CanonicalLocaleSchema = z.string().transform((value, context) => {
  const locale = parseCanonicalPimLocale(value)
  if (!locale) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: CANONICAL_LOCALE_ERROR,
    })
    return z.NEVER
  }

  return locale
})

export const UpsertContentSchema = z.object({
  locale: CanonicalLocaleSchema,
  channel: z.string().optional(),
  title: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  short_description: z.string().nullable().optional(),
  variant_titles_json: z.array(VariantTitleSchema).nullable().optional(),
  bullets_json: z.array(BulletSchema).nullable().optional(),
  specifications_json: z.array(SpecSchema).nullable().optional(),
  seo_json: z.record(z.string(), z.unknown()).nullable().optional(),
  custom_metadata_json: z.record(z.string(), z.unknown()).nullable().optional(),
  change_reason: z.string().optional(),
})
export interface UpsertContentSchema extends z.infer<typeof UpsertContentSchema> {}

export const PublishContentSchema = z.object({
  content_id: z.string(),
  archive_previous: z.boolean().optional(),
})
export interface PublishContentSchema extends z.infer<typeof PublishContentSchema> {}

export const GenerateContentSchema = z.object({
  source_locale: CanonicalLocaleSchema.optional(),
  target_locale: CanonicalLocaleSchema,
  channel: z.string().optional(),
  mode: z.enum(['translate', 'rewrite', 'extract_specs', 'seo', 'full']),
  tone: z.enum(['neutral', 'luxury', 'technical', 'seo']).optional(),
  content_scope: z.enum(['full', 'copy_specs']).optional(),
  save_as: z.enum(['draft', 'job_only']).optional(),
})
export interface GenerateContentSchema extends z.infer<typeof GenerateContentSchema> {}

export const UpdatePimAiSettingsSchema = z.object({
  provider: z.string().min(1).optional(),
  api_key: z.string().min(1).optional(),
  base_url: z.string().url().optional(),
  model: z.string().min(1).optional(),
})
export interface UpdatePimAiSettingsSchema extends z.infer<typeof UpdatePimAiSettingsSchema> {}

export const ListPimAiModelsQuerySchema = z.object({
  provider: z.string().min(1).optional(),
  base_url: z.string().url().optional(),
})
export type ListPimAiModelsQuery = z.infer<typeof ListPimAiModelsQuerySchema>

export const UpdateMetadataSchema = z.object({
  scope: z.enum(['product', 'content']),
  locale: CanonicalLocaleSchema.optional(),
  channel: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()),
})
export interface UpdateMetadataSchema extends z.infer<typeof UpdateMetadataSchema> {}

export const CreateMetadataFieldSchema = z.object({
  key: z.string().min(1),
  label: z.string().min(1),
  description: z.string().nullable().optional(),
  type: z.enum(METADATA_FIELD_TYPES).optional(),
  scope: z.enum(METADATA_FIELD_SCOPES).optional(),
  group: z.string().nullable().optional(),
  options_json: z
    .array(z.object({ label: z.string(), value: z.string() }))
    .nullable()
    .optional(),
  required: z.boolean().optional(),
  localized: z.boolean().optional(),
  channel_specific: z.boolean().optional(),
  visible_in_admin: z.boolean().optional(),
  visible_in_storefront: z.boolean().optional(),
  write_policy: z.enum(METADATA_FIELD_WRITE_POLICIES).optional(),
  validation_json: z.record(z.string(), z.unknown()).nullable().optional(),
  sort_order: z.number().optional(),
})
export interface CreateMetadataFieldSchema extends z.infer<typeof CreateMetadataFieldSchema> {}

export const BatchContentSchema = z.object({
  product_ids: z.array(z.string()).min(1).max(BATCH_CONTENT_PRODUCT_LIMIT),
  locale: CanonicalLocaleSchema.optional(),
  channel: z.string().optional(),
})
export interface BatchContentSchema extends z.infer<typeof BatchContentSchema> {}

// Query schemas

export const ListContentQuerySchema = createFindParams().merge(
  z.object({
    product_id: z.string().optional(),
    locale: CanonicalLocaleSchema.optional(),
    status: z.string().optional(),
    channel: z.string().optional(),
  }),
)
export type ListContentQuery = z.infer<typeof ListContentQuerySchema>

export const ListJobsQuerySchema = createFindParams().merge(
  z.object({
    status: z.string().optional(),
    type: z.string().optional(),
    product_id: z.string().optional(),
  }),
)
export type ListJobsQuery = z.infer<typeof ListJobsQuerySchema>

export const GetContentQuerySchema = z.object({
  locale: CanonicalLocaleSchema.optional(),
  channel: z.string().optional(),
})
export interface GetContentQuerySchema extends z.infer<typeof GetContentQuerySchema> {}

// Middleware registration

export default defineMiddlewares({
  routes: [
    // List content
    {
      matcher: '/admin/pim/content',
      method: 'GET',
      middlewares: [
        validateAndTransformQuery(ListContentQuerySchema, {
          isList: true,
          defaults: [
            'id',
            'product_id',
            'locale',
            'channel',
            'status',
            'title',
            'variant_titles_json',
            'updated_at',
          ],
        }),
      ],
    },
    // List jobs
    {
      matcher: '/admin/pim/jobs',
      method: 'GET',
      middlewares: [
        validateAndTransformQuery(ListJobsQuerySchema, {
          isList: true,
          defaults: ['id', 'type', 'product_id', 'locale', 'status', 'created_at'],
        }),
      ],
    },
    // Product content CRUD
    {
      matcher: '/admin/pim/products/:id/content',
      method: 'GET',
      middlewares: [validateAndTransformQuery(GetContentQuerySchema, {})],
    },
    {
      matcher: '/store/products/:id/content',
      method: 'GET',
      middlewares: [validateAndTransformQuery(GetContentQuerySchema, {})],
    },
    {
      matcher: '/admin/pim/products/:id/content',
      method: 'POST',
      middlewares: [validateAndTransformBody(UpsertContentSchema)],
    },
    {
      matcher: '/admin/pim/products/:id/publish',
      method: 'POST',
      middlewares: [validateAndTransformBody(PublishContentSchema)],
    },
    {
      matcher: '/admin/pim/products/:id/generate',
      method: 'POST',
      middlewares: [validateAndTransformBody(GenerateContentSchema)],
    },
    {
      matcher: '/admin/pim/ai-settings',
      method: 'POST',
      middlewares: [validateAndTransformBody(UpdatePimAiSettingsSchema)],
    },
    {
      matcher: '/admin/pim/ai-settings/models',
      method: 'GET',
      middlewares: [validateAndTransformQuery(ListPimAiModelsQuerySchema, {})],
    },
    {
      matcher: '/admin/pim/products/:id/metadata',
      method: 'POST',
      middlewares: [validateAndTransformBody(UpdateMetadataSchema)],
    },
    // Metadata fields
    {
      matcher: '/admin/pim/metadata-fields',
      method: 'POST',
      middlewares: [validateAndTransformBody(CreateMetadataFieldSchema)],
    },
    {
      matcher: '/admin/pim/metadata-fields/:id',
      method: 'POST',
      middlewares: [validateAndTransformBody(CreateMetadataFieldSchema.partial())],
    },
    // Store batch
    {
      matcher: '/store/pim/content/batch',
      method: 'POST',
      middlewares: [validateAndTransformBody(BatchContentSchema)],
    },
  ],
})
