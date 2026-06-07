import { MedusaRequest, MedusaResponse } from '@medusajs/framework/http'
import { PIM_MODULE } from '../../../../../modules/pim'
import type PimModuleService from '../../../../../modules/pim/service'
import type { BatchContentSchema } from '../../../../middlewares'

const PUBLISHED_STATUS = 'published'
const DEFAULT_CHANNEL = process.env.PIM_DEFAULT_CHANNEL ?? 'storefront'

// POST /store/pim/content/batch
export async function POST(
  req: MedusaRequest<BatchContentSchema>,
  res: MedusaResponse,
) {
  const { product_ids, locale, channel } = req.validatedBody
  const effectiveChannel = channel ?? DEFAULT_CHANNEL

  const pim = req.scope.resolve<PimModuleService>(PIM_MODULE)

  // Fetch all published content for these products in bulk
  const [allRecords] = await pim.listAndCountProductContents(
    {
      product_id: product_ids as any,
      status: [PUBLISHED_STATUS] as any,
    },
    {},
  )

  // Build a lookup: product_id → best matching content record
  const resultMap = new Map<string, Record<string, unknown>>()

  for (const productId of product_ids) {
    // Priority: exact locale+channel → exact locale+default channel
    const candidates = [
      { l: locale, c: effectiveChannel },
      { l: locale, c: DEFAULT_CHANNEL },
    ]

    for (const { l, c } of candidates) {
      const match = (allRecords as unknown as Array<Record<string, unknown>>).find(
        (r) => r.product_id === productId && r.locale === l && r.channel === c,
      )
      if (match) {
        resultMap.set(productId, match)
        break
      }
    }
  }

  // Return in same order as input product_ids, with null for missing
  const contents = product_ids.map((id) => {
    const r = resultMap.get(id)
    if (!r) return { product_id: id, source: 'medusa_fallback' }
    return {
      product_id: r.product_id,
      locale: r.locale,
      channel: r.channel,
      title: r.title ?? null,
      description: r.description ?? null,
      short_description: r.short_description ?? null,
      bullets: r.bullets_json ?? null,
      specifications: r.specifications_json ?? null,
      seo: r.seo_json ?? null,
      metadata: r.custom_metadata_json ?? null,
      source: 'pim',
    }
  })

  res.json({ contents })
}
