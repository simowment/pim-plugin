import { MedusaRequest, MedusaResponse } from '@medusajs/framework/http'
import { PIM_MODULE } from '../../../../../modules/pim'
import type PimModuleService from '../../../../../modules/pim/service'
import type { BatchContentSchema } from '../../../../middlewares'
import { getOptionalQueryString } from '../../../../query-params'
import {
  resolveBestPimContentRecord,
  serializeMedusaProductFallback,
  serializeStorefrontPimContent,
} from '../../../../../lib/specifications'
import { resolveRequestPimLocale } from '../../../../../lib/locales'
import { resolveDefaultPimChannel, resolvePimChannels } from '../../../../../lib/channels'

const PUBLISHED_STATUS = 'published'
const CONTENT_RECORDS_PER_CHANNEL_LIMIT = 2
const SINGLE_PRODUCT_COUNT = 1

type ProductFallbackRecord = Record<string, unknown> & {
  id: string
}

function isProductFallbackRecord(value: unknown): value is ProductFallbackRecord {
  return (
    value !== null &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    'id' in value &&
    typeof value.id === 'string'
  )
}

// POST /store/pim/content/batch
export async function POST(req: MedusaRequest<BatchContentSchema>, res: MedusaResponse) {
  const { product_ids, channel } = req.validatedBody
  const locale = resolveRequestPimLocale(
    req,
    getOptionalQueryString(req, 'locale') ?? req.validatedBody.locale,
  )
  const defaultChannel = resolveDefaultPimChannel()
  const effectiveChannel = channel ?? defaultChannel
  const candidateChannels = Array.from(
    new Set([effectiveChannel, defaultChannel, ...resolvePimChannels()]),
  )

  const pim = req.scope.resolve<PimModuleService>(PIM_MODULE)
  const resultMap = new Map<string, Record<string, unknown>>()
  const productIdFilter =
    product_ids.length === SINGLE_PRODUCT_COUNT ? product_ids[0] : product_ids

  const [contentResult, metadataFields] = await Promise.all([
    pim.listAndCountProductContents(
      {
        product_id: productIdFilter,
        locale,
        channel: candidateChannels,
        status: PUBLISHED_STATUS,
      },
      {
        take: product_ids.length * candidateChannels.length * CONTENT_RECORDS_PER_CHANNEL_LIMIT,
        order: { published_at: 'DESC' },
      },
    ),
    pim.listProductMetadataFields(
      { visible_in_storefront: true },
      { order: { sort_order: 'ASC' } },
    ),
  ])
  const [records] = contentResult
  const recordsByProductId = new Map<string, Array<Record<string, unknown>>>()

  for (const record of records as unknown as Array<Record<string, unknown>>) {
    const productId = String(record.product_id ?? '')
    const groupedRecords = recordsByProductId.get(productId)

    if (groupedRecords) {
      groupedRecords.push(record)
    } else {
      recordsByProductId.set(productId, [record])
    }
  }

  for (const productId of product_ids) {
    const match = resolveBestPimContentRecord(recordsByProductId.get(productId) ?? [], {
      locale,
      channel: effectiveChannel,
      defaultChannel,
      statuses: [PUBLISHED_STATUS],
      preferSpecifications: true,
    })

    if (match) {
      resultMap.set(productId, match)
    }
  }

  const unresolvedProductIds = product_ids.filter((id) => !resultMap.has(id))
  const fallbackProductsById = new Map<string, Record<string, unknown>>()
  if (unresolvedProductIds.length > 0) {
    const query = req.scope.resolve('query')
    const unresolvedProductIdFilter =
      unresolvedProductIds.length === SINGLE_PRODUCT_COUNT
        ? unresolvedProductIds[0]
        : unresolvedProductIds
    const productResult = await query.graph(
      {
        entity: 'product',
        filters: { id: unresolvedProductIdFilter },
        fields: [
          'id',
          'title',
          'description',
          'handle',
          'metadata',
          'variants.id',
          'variants.title',
        ],
      },
      { locale },
    )

    for (const product of productResult.data) {
      if (isProductFallbackRecord(product)) {
        fallbackProductsById.set(product.id, product)
      }
    }
  }

  // Return in same order as input product_ids.
  const contents = product_ids.map((id) => {
    const r = resultMap.get(id)
    if (r) {
      return serializeStorefrontPimContent(r, metadataFields)
    }

    const fallbackProduct = fallbackProductsById.get(id)
    if (fallbackProduct) {
      return serializeMedusaProductFallback(fallbackProduct, {
        productId: id,
        locale,
        channel: effectiveChannel,
      })
    }

    return { product_id: id, locale, channel: effectiveChannel, content: null, source: 'missing' }
  })

  res.json({ contents })
}
