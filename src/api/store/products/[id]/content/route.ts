import { MedusaRequest, MedusaResponse } from '@medusajs/framework/http'
import { MedusaError } from '@medusajs/framework/utils'
import { PIM_MODULE } from '../../../../../modules/pim'
import type PimModuleService from '../../../../../modules/pim/service'
import {
  resolveBestPimContentRecord,
  serializeMedusaProductFallback,
  serializeStorefrontPimContent,
} from '../../../../../lib/specifications'
import { resolveRequestPimLocale } from '../../../../../lib/locales'
import { resolveDefaultPimChannel } from '../../../../../lib/channels'

const PUBLISHED_STATUS = 'published'
const CONTENT_RECORD_LIMIT = 100

type ContentQuery = {
  locale?: string
  channel?: string
}

// GET /store/products/:id/content?locale=fr-FR&channel=storefront
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const { id: product_id } = req.params
  const validatedQuery = req.validatedQuery as ContentQuery
  const locale = resolveRequestPimLocale(req, validatedQuery.locale)
  const defaultChannel = resolveDefaultPimChannel()
  const channel = validatedQuery.channel ?? defaultChannel

  const pim = req.scope.resolve<PimModuleService>(PIM_MODULE)

  // Fetch the native product as fallback
  const query = req.scope.resolve('query')
  const [productResult, contentResult, metadataFields] = await Promise.all([
    query.graph(
      {
        entity: 'product',
        filters: { id: product_id },
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
    ),
    pim.listAndCountProductContents(
      {
        product_id,
        status: PUBLISHED_STATUS,
      },
      { take: CONTENT_RECORD_LIMIT, order: { published_at: 'DESC' } },
    ),
    pim.listProductMetadataFields(
      { visible_in_storefront: true },
      { order: { sort_order: 'ASC' } },
    ),
  ])

  const product = productResult.data[0] as Record<string, unknown> | undefined
  const [records] = contentResult

  if (!product) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, `Product ${product_id} not found`)
  }

  const resolved = resolveBestPimContentRecord(
    records as unknown as Array<Record<string, unknown>>,
    {
      locale,
      channel,
      defaultChannel,
      statuses: [PUBLISHED_STATUS],
      preferSpecifications: true,
    },
  )

  if (!resolved) {
    res.json({
      content: serializeMedusaProductFallback(product, {
        productId: product_id,
        locale,
        channel,
      }),
    })
    return
  }

  // Strip sensitive/internal fields before responding
  res.json({ content: serializeStorefrontPimContent(resolved, metadataFields) })
}
