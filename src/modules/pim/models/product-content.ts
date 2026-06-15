import { model } from '@medusajs/framework/utils'

export const PRODUCT_CONTENT_STATUSES = ['draft', 'ai_generated', 'reviewed', 'published', 'archived']
export type ProductContentStatus =
  | 'draft'
  | 'ai_generated'
  | 'reviewed'
  | 'published'
  | 'archived'

export const PRODUCT_CONTENT_SOURCES = ['supplier', 'manual', 'ai', 'import', 'directus', 'agent']
export type ProductContentSource = 'supplier' | 'manual' | 'ai' | 'import' | 'directus' | 'agent'

export const ProductContent = model
  .define('product_content', {
    id: model.id().primaryKey(),
    product_id: model.text(),
    locale: model.text(),
    channel: model.text(),
    status: model.enum(PRODUCT_CONTENT_STATUSES).default('draft'),
    source: model.enum(PRODUCT_CONTENT_SOURCES).default('manual'),

    title: model.text().nullable(),
    description: model.text().nullable(),
    short_description: model.text().nullable(),

    variant_titles_json: model.json().nullable(),
    bullets_json: model.json().nullable(),
    specifications_json: model.json().nullable(),
    seo_json: model.json().nullable(),
    custom_metadata_json: model.json().nullable(),
    raw_source_json: model.json().nullable(),
    quality_json: model.json().nullable(),

    published_at: model.dateTime().nullable(),
    created_by: model.text().nullable(),
    updated_by: model.text().nullable(),
  })
  .indexes([
    {
      on: ['product_id', 'status', 'locale', 'channel'],
    },
    {
      on: ['product_id', 'locale', 'channel'],
    },
  ])

export default ProductContent
