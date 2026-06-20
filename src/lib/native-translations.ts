import { resolveDefaultPimChannel } from './channels'

export type NativeTranslationInput = {
  reference: string
  reference_id: string
  locale_code: string
  translations: Record<string, unknown>
}

type VariantTitle = {
  variant_id: string
  title: string
}

function cleanText(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null
  }

  const text = value.trim()
  return text.length > 0 ? text : null
}

function isVariantTitle(value: unknown): value is VariantTitle {
  return (
    Boolean(value) &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    typeof (value as VariantTitle).variant_id === 'string' &&
    typeof (value as VariantTitle).title === 'string'
  )
}

export function medusaLocaleName(localeCode: string): string {
  return localeCode
}

export function shouldMirrorNativeTranslations(channel: unknown): boolean {
  return channel === resolveDefaultPimChannel() || channel === 'default'
}

export function buildNativeTranslationInputs(
  content: Record<string, unknown>,
  localeCode: string,
): NativeTranslationInput[] {
  if (!shouldMirrorNativeTranslations(content.channel)) {
    return []
  }

  const productTranslations: Record<string, unknown> = {}
  const title = cleanText(content.title)
  const description = cleanText(content.description)
  const shortDescription = cleanText(content.short_description)

  if (title) {
    productTranslations.title = title
  }

  if (description) {
    productTranslations.description = description
  }

  if (shortDescription) {
    productTranslations.subtitle = shortDescription
  }

  const inputs: NativeTranslationInput[] = []
  if (Object.keys(productTranslations).length > 0) {
    inputs.push({
      reference: 'product',
      reference_id: String(content.product_id),
      locale_code: localeCode,
      translations: productTranslations,
    })
  }

  if (Array.isArray(content.variant_titles_json)) {
    for (const variantTitle of content.variant_titles_json.filter(isVariantTitle)) {
      const variantTranslation = cleanText(variantTitle.title)
      if (!variantTranslation) {
        continue
      }

      inputs.push({
        reference: 'product_variant',
        reference_id: variantTitle.variant_id,
        locale_code: localeCode,
        translations: {
          title: variantTranslation,
        },
      })
    }
  }

  return inputs
}
