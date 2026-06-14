import { MedusaRequest, MedusaResponse } from '@medusajs/framework/http'
import { PIM_MODULE } from '../../../../../modules/pim'
import type PimModuleService from '../../../../../modules/pim/service'
import {
  normalizeSupplierSpecifications,
  resolveBestPimContentRecord,
} from '../../../../../lib/specifications'

const PUBLISHED_STATUS = 'published'
const DEFAULT_CHANNEL = process.env.PIM_DEFAULT_CHANNEL ?? 'storefront'

// GET /store/products/:id/content?locale=fr&channel=storefront
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const { id: product_id } = req.params
  const { locale: queryLocale, channel: queryChannel } = req.validatedQuery as {
    locale?: string
    channel?: string
  }
  const locale = queryLocale || 'en'
  const channel = queryChannel || DEFAULT_CHANNEL

  const pim = req.scope.resolve<PimModuleService>(PIM_MODULE)

  // Fetch the native product as fallback
  const query = req.scope.resolve('query')
  const { data: products } = await query.graph({
    entity: 'product',
    filters: { id: product_id },
    fields: ['id', 'title', 'description', 'handle', 'metadata'],
  })

  const product = products[0] as Record<string, unknown> | undefined

  const [records] = await pim.listAndCountProductContents(
    {
      product_id,
      status: [PUBLISHED_STATUS] as any,
    },
    { take: 100, order: { published_at: 'DESC' } },
  )

  const resolved = resolveBestPimContentRecord(
    records as unknown as Array<Record<string, unknown>>,
    {
      locale,
      channel,
      defaultChannel: DEFAULT_CHANNEL,
      statuses: [PUBLISHED_STATUS],
      preferSpecifications: true,
    },
  )

  if (!resolved) {
    const metadata =
      product?.metadata && typeof product.metadata === 'object'
        ? (product.metadata as Record<string, unknown>)
        : {}
    const supplierSpecifications = normalizeSupplierSpecifications(metadata.attributes)

    // Medusa native fallback — only expose storefront-safe fields
    res.json({
      content: {
        product_id,
        locale,
        channel,
        title: product?.title ?? null,
        description: product?.description ?? null,
        short_description: null,
        bullets: null,
        specifications: supplierSpecifications.length > 0 ? supplierSpecifications : null,
        seo: null,
        metadata: null,
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
