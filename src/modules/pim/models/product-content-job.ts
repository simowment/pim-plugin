import { model } from '@medusajs/framework/utils'

export const PRODUCT_CONTENT_JOB_TYPES = [
  'translate',
  'rewrite',
  'extract_specs',
  'seo',
  'full',
]
export type ProductContentJobType =
  | 'translate'
  | 'rewrite'
  | 'extract_specs'
  | 'seo'
  | 'full'

export const PRODUCT_CONTENT_JOB_STATUSES = ['running', 'completed', 'failed']
export type ProductContentJobStatus = 'running' | 'completed' | 'failed'

export const ProductContentJob = model.define('product_content_job', {
  id: model.id().primaryKey(),
  type: model.enum(PRODUCT_CONTENT_JOB_TYPES),
  product_id: model.text().nullable(),
  locale: model.text().nullable(),
  status: model.enum(PRODUCT_CONTENT_JOB_STATUSES).default('running'),
  input_json: model.json(),
  result_json: model.json().nullable(),
  error_message: model.text().nullable(),
  created_by: model.text().nullable(),
  started_at: model.dateTime().nullable(),
  completed_at: model.dateTime().nullable(),
})

export default ProductContentJob
