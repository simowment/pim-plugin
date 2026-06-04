import { model } from '@medusajs/framework/utils'

const ProductContent = model.define('product_content', {
  id: model.id().primaryKey(),
  product_id: model.text(),
  locale: model.text(),
  channel: model.text(),
  status: model.enum(['draft', 'ai_generated', 'reviewed', 'published', 'archived']).default('draft'),
  source: model.enum(['supplier', 'manual', 'ai', 'import', 'directus', 'agent']).default('manual'),

  title: model.text().nullable(),
  subtitle: model.text().nullable(),
  description: model.text().nullable(),
  short_description: model.text().nullable(),

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

export default ProductContent
