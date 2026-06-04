import { MedusaRequest, MedusaResponse } from '@medusajs/framework/http'
import { PIM_MODULE } from '../../../../../modules/pim'
import type PimModuleService from '../../../../../modules/pim/service'

const PUBLISHED_STATUS = 'published'
const SAFE_STATUSES = [PUBLISHED_STATUS]
const DEFAULT_LOCALE = process.env.PIM_DEFAULT_LOCALE ?? 'en'
const DEFAULT_CHANNEL = process.env.PIM_DEFAULT_CHANNEL ?? 'storefront'

// GET /store/products/:id/content?locale=fr&channel=storefront
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const { id: product_id } = req.params
  const locale = (req.query.locale as string) || DEFAULT_LOCALE
  const channel = (req.query.channel as string) || DEFAULT_CHANNEL

  const pim = req.scope.resolve<PimModuleService>(PIM_MODULE)

  // Fetch the native product as fallback
  const query = req.scope.resolve('query')
  const { data: products } = await query.graph({
    entity: 'product',
    filters: { id: product_id },
    fields: ['id', 'title', 'subtitle', 'description', 'handle', 'metadata'],
  })

  const product = products[0] as Record<string, unknown> | undefined

  // Resolution order:
  // 1. published for requested locale + requested channel
  // 2. published for requested locale + default channel
  // 3. published for default locale + requested channel
  // 4. published for default locale + default channel
  // 5. Medusa native fallback
  const candidates = [
    { locale, channel },
    { locale, channel: DEFAULT_CHANNEL },
    { locale: DEFAULT_LOCALE, channel },
    { locale: DEFAULT_LOCALE, channel: DEFAULT_CHANNEL },
  ]

  let resolved: Record<string, unknown> | null = null

  for (const candidate of candidates) {
    const [records] = await pim.listAndCountProductContents(
      {
        product_id,
        locale: candidate.locale,
        channel: candidate.channel,
        status: SAFE_STATUSES as any,
      },
      { take: 1, order: { published_at: 'DESC' } },
    )

    if (records.length > 0) {
      resolved = records[0] as unknown as Record<string, unknown>
      break
    }
  }

  if (!resolved) {
    // Medusa native fallback — only expose storefront-safe fields
    res.json({
      content: {
        product_id,
        locale,
        channel,
        title: product?.title ?? null,
        subtitle: product?.subtitle ?? null,
        description: product?.description ?? null,
        short_description: null,
        bullets: null,
        specifications: null,
        seo: null,
        metadata: product?.metadata ?? null,
        source: 'medusa_fallback',
      },
    })
    return
  }

  // Strip sensitive/internal fields before responding
  res.json({
    content: {
      product_id: resolved.product_id,
      locale: resolved.locale,
      channel: resolved.channel,
      title: resolved.title ?? null,
      subtitle: resolved.subtitle ?? null,
      description: resolved.description ?? null,
      short_description: resolved.short_description ?? null,
      bullets: (resolved.bullets_json as unknown[]) ?? null,
      specifications: (resolved.specifications_json as unknown[]) ?? null,
      seo: resolved.seo_json ?? null,
      metadata: resolved.custom_metadata_json ?? null,
      source: 'pim',
    },
  })
}
