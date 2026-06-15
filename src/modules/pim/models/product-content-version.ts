import { model } from '@medusajs/framework/utils'

export const PRODUCT_CONTENT_VERSION_ACTOR_TYPES = ['admin', 'agent', 'system']
export type ProductContentVersionActorType = 'admin' | 'agent' | 'system'

export const ProductContentVersion = model.define('product_content_version', {
  id: model.id().primaryKey(),
  content_id: model.text(), // FK to product_content.id (managed manually — no ORM relation)
  version: model.number(),
  snapshot_json: model.json(), // Full content snapshot at this version
  change_reason: model.text().nullable(),
  actor_type: model.enum(PRODUCT_CONTENT_VERSION_ACTOR_TYPES).default('admin'),
  actor_id: model.text().nullable(),
  // created_at is auto-added by Medusa — no need to add explicitly
})

export default ProductContentVersion
