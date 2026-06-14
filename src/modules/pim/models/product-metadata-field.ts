import { model } from '@medusajs/framework/utils'

export const ProductMetadataField = model
  .define('product_metadata_field', {
    id: model.id().primaryKey(),
    key: model.text(),
    label: model.text(),
    description: model.text().nullable(),
    type: model
      .enum(['string', 'text', 'number', 'boolean', 'select', 'multiselect', 'json', 'url'])
      .default('string'),
    scope: model.enum(['product', 'variant', 'content']).default('product'),
    group: model.text().nullable(),
    options_json: model.json().nullable(),
    required: model.boolean().default(false),
    localized: model.boolean().default(false),
    channel_specific: model.boolean().default(false),
    visible_in_admin: model.boolean().default(true),
    visible_in_storefront: model.boolean().default(false),
    write_policy: model.enum(['admin', 'agent', 'system']).default('admin'),
    validation_json: model.json().nullable(),
    sort_order: model.number().default(0),
  })
  .indexes([
    {
      on: ['key'],
      unique: true,
    },
  ])

export default ProductMetadataField
