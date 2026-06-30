import { z } from '@medusajs/framework/zod'
import { parseCanonicalPimLocale } from './locales'

const CANONICAL_LOCALE_ERROR = 'Locale must be a canonical BCP 47 code with a region, for example fr-FR.'

export const CanonicalLocaleSchema = z.string().transform((value, context) => {
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

export const VariantTitleSchema = z.object({
  variant_id: z.string().min(1),
  title: z.string(),
})

export const BulletSchema = z.object({
  label: z.string().optional(),
  text: z.string(),
})

export const SpecificationSchema = z.object({
  key: z.string(),
  label: z.string().optional(),
  value: z.string(),
  unit: z.string().optional(),
  group: z.string().optional(),
})

export const SeoSchema = z.object({
  title: z.string().optional(),
  description: z.string().optional(),
  keywords: z.array(z.string()).optional(),
})

export const ProductContentFieldsSchema = z.object({
  title: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  short_description: z.string().nullable().optional(),
  variant_titles_json: z.array(VariantTitleSchema).nullable().optional(),
  bullets_json: z.array(BulletSchema).nullable().optional(),
  specifications_json: z.array(SpecificationSchema).nullable().optional(),
  seo_json: SeoSchema.nullable().optional(),
  custom_metadata_json: z.record(z.string(), z.unknown()).nullable().optional(),
  raw_source_json: z.record(z.string(), z.unknown()).nullable().optional(),
})

export type ProductContentFields = z.infer<typeof ProductContentFieldsSchema>
