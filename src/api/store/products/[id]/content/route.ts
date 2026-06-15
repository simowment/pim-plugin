import { MedusaRequest, MedusaResponse } from '@medusajs/framework/http'
import { PIM_MODULE } from '../../../../../modules/pim'
import type PimModuleService from '../../../../../modules/pim/service'
import { getOptionalQueryString } from '../../../../query-params'
import {
  normalizeSupplierSpecifications,
  resolveBestPimContentRecord,
  serializeStorefrontPimContent,
} from '../../../../../lib/specifications'

const PUBLISHED_STATUS = 'published'
const DEFAULT_CHANNEL = process.env.PIM_DEFAULT_CHANNEL ?? 'storefront'
const DEFAULT_LOCALE = 'en'
const CONTENT_RECORD_LIMIT = 100

// GET /store/products/:id/content?locale=fr&channel=storefront
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const { id: product_id } = req.params
  const queryLocale = getOptionalQueryString(req, 'locale')
  const queryChannel = getOptionalQueryString(req, 'channel')
  const locale = queryLocale ?? DEFAULT_LOCALE
  const channel = queryChannel ?? DEFAULT_CHANNEL

  const pim = req.scope.resolve<PimModuleService>(PIM_MODULE)

  // Fetch the native product as fallback
  const query = req.scope.resolve('query')
  const [productResult, contentResult, metadataFields] = await Promise.all([
    query.graph({
      entity: 'product',
      filters: { id: product_id },
      fields: ['id', 'title', 'description', 'handle', 'metadata', 'variants.id', 'variants.title'],
    }),
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
    const variants = Array.isArray(product?.variants) ? product.variants : []

    // Medusa native fallback - only expose storefront-safe fields
    res.json({
      content: {
        product_id,
        locale,
        channel,
        title: product?.title ?? null,
        description: product?.description ?? null,
        short_description: null,
        bullets: null,
        variant_titles: variants
          .filter((variant): variant is Record<string, unknown> => {
            return Boolean(variant) && typeof variant === 'object' && typeof variant.id === 'string'
          })
          .map((variant) => ({
            variant_id: variant.id,
            title: typeof variant.title === 'string' ? variant.title : '',
          })),
        specifications: supplierSpecifications.length > 0 ? supplierSpecifications : null,
        seo: null,
        metadata: null,
        source: 'medusa_fallback',
      },
    })
    return
  }

  // Strip sensitive/internal fields before responding
  res.json({ content: serializeStorefrontPimContent(resolved, metadataFields) })
}
