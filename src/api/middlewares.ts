import {
  authenticate,
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
import { CanonicalLocaleSchema, ProductContentFieldsSchema } from '../lib/product-content-schema'
import { PRODUCT_CONTENT_STATUSES } from '../modules/pim/models/product-content'
import {
  PRODUCT_CONTENT_JOB_STATUSES,
  PRODUCT_CONTENT_JOB_TYPES,
} from '../modules/pim/models/product-content-job'

export const BATCH_CONTENT_PRODUCT_LIMIT = 50
const NonEmptyChannelSchema = z.string().min(1)

// Body schemas

export const UpsertContentSchema = ProductContentFieldsSchema.omit({ raw_source_json: true }).extend({
  locale: CanonicalLocaleSchema,
  channel: NonEmptyChannelSchema.optional(),
  seo_json: z.record(z.string(), z.unknown()).nullable().optional(),
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
  channel: NonEmptyChannelSchema.optional(),
  mode: z.enum(['translate', 'rewrite', 'extract_specs', 'seo', 'full']),
  tone: z.enum(['neutral', 'luxury', 'technical', 'seo']).optional(),
  content_scope: z.enum(['full', 'copy_specs']).optional(),
  translate_fields: z.array(z.enum(['title', 'description', 'short_description', 'specifications'])).min(1).optional(),
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
  channel: NonEmptyChannelSchema.optional(),
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
  channel: NonEmptyChannelSchema.optional(),
})
export interface BatchContentSchema extends z.infer<typeof BatchContentSchema> {}

// Query schemas

export const ListContentQuerySchema = createFindParams().merge(
  z.object({
    product_id: z.string().optional(),
    locale: CanonicalLocaleSchema.optional(),
    status: z.enum(PRODUCT_CONTENT_STATUSES).optional(),
    channel: NonEmptyChannelSchema.optional(),
  }),
)
export type ListContentQuery = z.infer<typeof ListContentQuerySchema>

export const ListJobsQuerySchema = createFindParams().merge(
  z.object({
    status: z.enum(PRODUCT_CONTENT_JOB_STATUSES).optional(),
    type: z.enum(PRODUCT_CONTENT_JOB_TYPES).optional(),
    product_id: z.string().optional(),
  }),
)
export type ListJobsQuery = z.infer<typeof ListJobsQuerySchema>

export const GetContentQuerySchema = z.object({
  locale: CanonicalLocaleSchema.optional(),
  channel: NonEmptyChannelSchema.optional(),
})
export interface GetContentQuerySchema extends z.infer<typeof GetContentQuerySchema> {}

// Middleware registration

export default defineMiddlewares({
  routes: [
    {
      matcher: '/admin/pim/*',
      middlewares: [authenticate('user', ['session', 'bearer', 'api-key'])],
    },
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
