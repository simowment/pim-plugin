import { model } from '@medusajs/framework/utils'

export const PRODUCT_CONTENT_JOB_TYPES = [
  'translate',
  'rewrite',
  'extract_specs',
  'seo',
  'full',
  'bulk_import_cleanup',
]
export type ProductContentJobType =
  | 'translate'
  | 'rewrite'
  | 'extract_specs'
  | 'seo'
  | 'full'
  | 'bulk_import_cleanup'

export const PRODUCT_CONTENT_JOB_STATUSES = ['queued', 'running', 'completed', 'failed', 'cancelled']
export type ProductContentJobStatus = 'queued' | 'running' | 'completed' | 'failed' | 'cancelled'

export const ProductContentJob = model.define('product_content_job', {
  id: model.id().primaryKey(),
  type: model.enum(PRODUCT_CONTENT_JOB_TYPES),
  product_id: model.text().nullable(),
  locale: model.text().nullable(),
  status: model.enum(PRODUCT_CONTENT_JOB_STATUSES).default('queued'),
  input_json: model.json(),
  result_json: model.json().nullable(),
  error_message: model.text().nullable(),
  created_by: model.text().nullable(),
  started_at: model.dateTime().nullable(),
  completed_at: model.dateTime().nullable(),
})

export default ProductContentJob
