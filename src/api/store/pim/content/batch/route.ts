import { MedusaRequest, MedusaResponse } from '@medusajs/framework/http'
import { PIM_MODULE } from '../../../../../modules/pim'
import type PimModuleService from '../../../../../modules/pim/service'
import type { BatchContentSchema } from '../../../../middlewares'
import {
  resolveBestPimContentRecord,
  serializeStorefrontPimContent,
} from '../../../../../lib/specifications'

const PUBLISHED_STATUS = 'published'
const DEFAULT_CHANNEL = process.env.PIM_DEFAULT_CHANNEL ?? 'storefront'
const CONTENT_RECORD_LIMIT_MULTIPLIER = 4

// POST /store/pim/content/batch
export async function POST(req: MedusaRequest<BatchContentSchema>, res: MedusaResponse) {
  const { product_ids, locale, channel } = req.validatedBody
  const effectiveChannel = channel ?? DEFAULT_CHANNEL

  const pim = req.scope.resolve<PimModuleService>(PIM_MODULE)
  const resultMap = new Map<string, Record<string, unknown>>()

  const [contentResult, metadataFields] = await Promise.all([
    pim.listAndCountProductContents(
      {
        product_id: product_ids,
        status: PUBLISHED_STATUS,
      },
      {
        take: product_ids.length * CONTENT_RECORD_LIMIT_MULTIPLIER,
        order: { published_at: 'DESC' },
      },
    ),
    pim.listProductMetadataFields(
      { visible_in_storefront: true },
      { order: { sort_order: 'ASC' } },
    ),
  ])
  const [records] = contentResult

  const recordsByProduct = new Map<string, Array<Record<string, unknown>>>()
  for (const record of records as unknown as Array<Record<string, unknown>>) {
    const productId = typeof record.product_id === 'string' ? record.product_id : null
    if (!productId) continue
    const existing = recordsByProduct.get(productId) ?? []
    existing.push(record)
    recordsByProduct.set(productId, existing)
  }

  for (const productId of product_ids) {
    const match = resolveBestPimContentRecord(recordsByProduct.get(productId) ?? [], {
      locale,
      channel: effectiveChannel,
      defaultChannel: DEFAULT_CHANNEL,
      statuses: [PUBLISHED_STATUS],
      preferSpecifications: true,
    })

    if (match) {
      resultMap.set(productId, match)
    }
  }

  // Return in same order as input product_ids, with null for missing
  const contents = product_ids.map((id) => {
    const r = resultMap.get(id)
    if (!r) return { product_id: id, source: 'medusa_fallback' }
    return serializeStorefrontPimContent(r, metadataFields)
  })

  res.json({ contents })
}
