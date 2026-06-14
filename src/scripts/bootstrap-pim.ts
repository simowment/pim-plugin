/**
 * bootstrap-pim.ts
 *
 * Idempotent script to create default PIM metadata field definitions.
 * Run with: npx medusa exec ./src/scripts/bootstrap-pim.ts
 *
 * Safe to run multiple times — skips existing fields.
 */

import { MedusaContainer } from '@medusajs/framework/types'

// All default metadata fields
const DEFAULT_FIELDS: Array<{
  key: string
  label: string
  description?: string
  type: string
  scope: string
  group: string
  visible_in_storefront: boolean
  sort_order: number
}> = [
  {
    key: 'material',
    label: 'Material',
    description: 'Primary material composition',
    type: 'string',
    scope: 'content',
    group: 'Merchandising',
    visible_in_storefront: true,
    sort_order: 10,
  },
  {
    key: 'style',
    label: 'Style',
    description: 'Design style (e.g. Scandinavian, Industrial)',
    type: 'string',
    scope: 'content',
    group: 'Merchandising',
    visible_in_storefront: true,
    sort_order: 20,
  },
  {
    key: 'room',
    label: 'Room',
    description: 'Intended room(s)',
    type: 'string',
    scope: 'content',
    group: 'Merchandising',
    visible_in_storefront: true,
    sort_order: 30,
  },
  {
    key: 'care_instructions',
    label: 'Care Instructions',
    description: 'Cleaning and maintenance instructions',
    type: 'text',
    scope: 'content',
    group: 'Content',
    visible_in_storefront: true,
    sort_order: 40,
  },
  {
    key: 'supplier_raw_description',
    label: 'Supplier Raw Description',
    description: 'Original unedited description from supplier',
    type: 'text',
    scope: 'content',
    group: 'Supplier',
    visible_in_storefront: false,
    sort_order: 50,
  },
  {
    key: 'supplier_original_locale',
    label: 'Supplier Original Locale',
    description: "Locale of the supplier's original content",
    type: 'string',
    scope: 'content',
    group: 'Supplier',
    visible_in_storefront: false,
    sort_order: 60,
  },
  {
    key: 'google_product_category',
    label: 'Google Product Category',
    description: 'Google taxonomy category ID or path',
    type: 'string',
    scope: 'content',
    group: 'SEO',
    visible_in_storefront: false,
    sort_order: 70,
  },
  {
    key: 'compliance_warning',
    label: 'Compliance Warning',
    description: 'Legal warnings (e.g. CA Prop 65)',
    type: 'text',
    scope: 'content',
    group: 'Compliance',
    visible_in_storefront: true,
    sort_order: 80,
  },
]

export default async function bootstrapPim({ container }: { container: MedusaContainer }) {
  const logger = container.resolve('logger')
  const pim = container.resolve('pim') as any

  logger.info('[bootstrap-pim] Starting metadata field bootstrap...')

  const existingFields = await pim.listProductMetadataFields({})
  const existingKeys = new Set(existingFields.map((f: any) => f.key as string))

  let created = 0
  let skipped = 0

  for (const field of DEFAULT_FIELDS) {
    if (existingKeys.has(field.key)) {
      logger.info(`[bootstrap-pim] Skipping existing field: ${field.key}`)
      skipped++
      continue
    }

    await pim.createProductMetadataFields({
      key: field.key,
      label: field.label,
      description: field.description ?? null,
      type: field.type,
      scope: field.scope,
      group: field.group,
      required: false,
      localized: false,
      channel_specific: false,
      visible_in_admin: true,
      visible_in_storefront: field.visible_in_storefront,
      write_policy: 'admin',
      sort_order: field.sort_order,
    })

    logger.info(`[bootstrap-pim] Created field: ${field.key}`)
    created++
  }

  logger.info(`[bootstrap-pim] Done. Created: ${created}, Skipped: ${skipped}`)
}
