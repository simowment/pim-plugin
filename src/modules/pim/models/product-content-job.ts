import { model } from '@medusajs/framework/utils'

const JOB_TYPES = ['translate', 'rewrite', 'extract_specs', 'seo', 'full', 'bulk_import_cleanup']
const JOB_STATUSES = ['queued', 'running', 'completed', 'failed', 'cancelled']

const ProductContentJob = model.define('product_content_job', {
  id: model.id().primaryKey(),
  type: model.enum(JOB_TYPES),
  product_id: model.text().nullable(),
  locale: model.text().nullable(),
  status: model.enum(JOB_STATUSES).default('queued'),
  input_json: model.json(),
  result_json: model.json().nullable(),
  error_message: model.text().nullable(),
  created_by: model.text().nullable(),
  started_at: model.dateTime().nullable(),
  completed_at: model.dateTime().nullable(),
})

export default ProductContentJob
