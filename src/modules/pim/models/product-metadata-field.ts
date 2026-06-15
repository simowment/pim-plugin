import { model } from '@medusajs/framework/utils'

export const PRODUCT_METADATA_FIELD_TYPES = [
  'string',
  'text',
  'number',
  'boolean',
  'select',
  'multiselect',
  'json',
  'url',
]
export type ProductMetadataFieldType =
  | 'string'
  | 'text'
  | 'number'
  | 'boolean'
  | 'select'
  | 'multiselect'
  | 'json'
  | 'url'

export const PRODUCT_METADATA_FIELD_SCOPES = ['product', 'variant', 'content']
export type ProductMetadataFieldScope = 'product' | 'variant' | 'content'

export const PRODUCT_METADATA_FIELD_WRITE_POLICIES = ['admin', 'agent', 'system']
export type ProductMetadataFieldWritePolicy = 'admin' | 'agent' | 'system'

export const ProductMetadataField = model
  .define('product_metadata_field', {
    id: model.id().primaryKey(),
    key: model.text(),
    label: model.text(),
    description: model.text().nullable(),
    type: model.enum(PRODUCT_METADATA_FIELD_TYPES).default('string'),
    scope: model.enum(PRODUCT_METADATA_FIELD_SCOPES).default('product'),
    group: model.text().nullable(),
    options_json: model.json().nullable(),
    required: model.boolean().default(false),
    localized: model.boolean().default(false),
    channel_specific: model.boolean().default(false),
    visible_in_admin: model.boolean().default(true),
    visible_in_storefront: model.boolean().default(false),
    write_policy: model.enum(PRODUCT_METADATA_FIELD_WRITE_POLICIES).default('admin'),
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
