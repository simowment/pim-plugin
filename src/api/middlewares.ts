import {
  defineMiddlewares,
  validateAndTransformBody,
  validateAndTransformQuery,
} from '@medusajs/framework/http'
import { z } from 'zod'
import { createFindParams } from '@medusajs/medusa/api/utils/validators'

// ─── Body schemas ──────────────────────────────────────────────────────────

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

export const UpsertContentSchema = z.object({
  locale: z.string(),
  channel: z.string().optional(),
  title: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  short_description: z.string().nullable().optional(),
  bullets_json: z.array(BulletSchema).nullable().optional(),
  specifications_json: z.array(SpecSchema).nullable().optional(),
  seo_json: z.record(z.unknown()).nullable().optional(),
  custom_metadata_json: z.record(z.unknown()).nullable().optional(),
  change_reason: z.string().optional(),
})
export type UpsertContentSchema = z.infer<typeof UpsertContentSchema>

export const PublishContentSchema = z.object({
  content_id: z.string(),
  archive_previous: z.boolean().optional(),
})
export type PublishContentSchema = z.infer<typeof PublishContentSchema>

export const GenerateContentSchema = z.object({
  source_locale: z.string().optional(),
  target_locale: z.string(),
  channel: z.string().optional(),
  mode: z.enum(['translate', 'rewrite', 'extract_specs', 'seo', 'full']),
  tone: z.enum(['neutral', 'luxury', 'technical', 'seo']).optional(),
  save_as: z.enum(['draft', 'job_only']).optional(),
})
export type GenerateContentSchema = z.infer<typeof GenerateContentSchema>

export const UpdateMetadataSchema = z.object({
  scope: z.enum(['product', 'content']),
  locale: z.string().optional(),
  channel: z.string().optional(),
  metadata: z.record(z.unknown()),
})
export type UpdateMetadataSchema = z.infer<typeof UpdateMetadataSchema>

export const CreateMetadataFieldSchema = z.object({
  key: z.string().min(1),
  label: z.string().min(1),
  description: z.string().nullable().optional(),
  type: z.enum(['string', 'text', 'number', 'boolean', 'select', 'multiselect', 'json', 'url']).optional(),
  scope: z.enum(['product', 'variant', 'content']).optional(),
  group: z.string().nullable().optional(),
  options_json: z.array(z.object({ label: z.string(), value: z.string() })).nullable().optional(),
  required: z.boolean().optional(),
  localized: z.boolean().optional(),
  channel_specific: z.boolean().optional(),
  visible_in_admin: z.boolean().optional(),
  visible_in_storefront: z.boolean().optional(),
  write_policy: z.enum(['admin', 'agent', 'system']).optional(),
  validation_json: z.record(z.unknown()).nullable().optional(),
  sort_order: z.number().optional(),
})
export type CreateMetadataFieldSchema = z.infer<typeof CreateMetadataFieldSchema>

export const BatchContentSchema = z.object({
  product_ids: z.array(z.string()).min(1),
  locale: z.string(),
  channel: z.string().optional(),
})
export type BatchContentSchema = z.infer<typeof BatchContentSchema>

// ─── Query schemas ─────────────────────────────────────────────────────────

export const ListContentQuerySchema = createFindParams().merge(
  z.object({
    product_id: z.string().optional(),
    locale: z.string().optional(),
    status: z.string().optional(),
    channel: z.string().optional(),
  }),
)

export const GetContentQuerySchema = z.object({
  locale: z.string().optional(),
  channel: z.string().optional(),
})

// ─── Middleware registration ───────────────────────────────────────────────

export default defineMiddlewares({
  routes: [
    // List content
    {
      matcher: '/admin/pim/content',
      method: 'GET',
      middlewares: [validateAndTransformQuery(ListContentQuerySchema, { isList: true, defaults: ['id', 'product_id', 'locale', 'channel', 'status', 'title', 'updated_at'] })],
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
