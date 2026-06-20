import { z } from 'zod'
import type { CreateOrUpdateContentInput } from '../workflows/steps/create-or-update-product-content'
import { normalizeSupplierSpecifications } from './specifications'
import { parseCanonicalPimLocale } from './locales'
import { resolveDefaultPimChannel } from './channels'

export const PIM_PRODUCT_IMPORTED_EVENT = 'pim.product_imported'

const PRODUCT_IMPORTED_EVENT_VERSION = 1
const PRODUCT_IMPORT_CHANGE_REASON = 'supplier_import'
const PRODUCT_IMPORT_SOURCE = 'import'
const DRAFT_STATUS = 'draft'
const CANONICAL_LOCALE_ERROR = 'Locale must be a canonical BCP 47 code with a region, for example fr-FR.'

const VariantTitleSchema = z.object({
  variant_id: z.string().min(1),
  title: z.string(),
})

const BulletSchema = z.object({
  label: z.string().optional(),
  text: z.string(),
})

const SpecificationSchema = z.object({
  key: z.string(),
  label: z.string().optional(),
  value: z.string(),
  unit: z.string().optional(),
  group: z.string().optional(),
})

const CanonicalLocaleSchema = z.string().transform((value, context) => {
  const locale = parseCanonicalPimLocale(value)
  if (!locale) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: CANONICAL_LOCALE_ERROR,
    })
    return z.NEVER
  }

  return locale
})

export const ImportedProductPayloadSchema = z.object({
  version: z
    .literal(PRODUCT_IMPORTED_EVENT_VERSION)
    .optional()
    .default(PRODUCT_IMPORTED_EVENT_VERSION),
  product_id: z.string().min(1),
  external_product_id: z.string().min(1).nullable().optional(),
  supplier_id: z.string().min(1),
  supplier_product_id: z.string().min(1),
  locale: CanonicalLocaleSchema,
  channel: z.string().min(1).optional(),
  title: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  short_description: z.string().nullable().optional(),
  attributes: z.record(z.string(), z.unknown()).default({}),
  variant_titles: z.array(VariantTitleSchema).default([]),
  bullets_json: z.array(BulletSchema).nullable().optional(),
  specifications_json: z.array(SpecificationSchema).nullable().optional(),
  seo_json: z.record(z.string(), z.unknown()).nullable().optional(),
  custom_metadata_json: z.record(z.string(), z.unknown()).nullable().optional(),
  raw_source: z.record(z.string(), z.unknown()).default({}),
})

export type ImportedProductPayload = z.infer<typeof ImportedProductPayloadSchema>

export function buildImportedProductContentInput(payload: unknown): CreateOrUpdateContentInput {
  const parsed = ImportedProductPayloadSchema.parse(payload)
  const specifications = normalizeSupplierSpecifications(parsed.attributes)

  const contentInput: CreateOrUpdateContentInput = {
    product_id: parsed.product_id,
    locale: parsed.locale,
    channel: parsed.channel ?? resolveDefaultPimChannel(),
    title: parsed.title ?? null,
    description: parsed.description ?? null,
    short_description: parsed.short_description ?? null,
    variant_titles_json: parsed.variant_titles.length > 0 ? parsed.variant_titles : null,
    raw_source_json: {
      ...parsed.raw_source,
      supplier: parsed.supplier_id,
      supplier_product_id: parsed.supplier_product_id,
      external_product_id: parsed.external_product_id ?? null,
      attributes: parsed.attributes,
    },
    source: PRODUCT_IMPORT_SOURCE,
    status: DRAFT_STATUS,
    created_by: null,
    updated_by: null,
    change_reason: PRODUCT_IMPORT_CHANGE_REASON,
  }

  if (parsed.bullets_json !== undefined) {
    contentInput.bullets_json = parsed.bullets_json
  }

  if (parsed.specifications_json !== undefined) {
    contentInput.specifications_json = parsed.specifications_json
  } else if (specifications.length > 0) {
    contentInput.specifications_json = specifications
  }

  if (parsed.seo_json !== undefined) {
    contentInput.seo_json = parsed.seo_json
  }

  if (parsed.custom_metadata_json !== undefined) {
    contentInput.custom_metadata_json = parsed.custom_metadata_json
  }

  return contentInput
}
