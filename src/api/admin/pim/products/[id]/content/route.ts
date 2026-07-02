import { AuthenticatedMedusaRequest, MedusaResponse } from '@medusajs/framework/http'
import { PIM_MODULE } from '../../../../../../modules/pim'
import type PimModuleService from '../../../../../../modules/pim/service'
import { createOrUpdateProductContentWorkflow } from '../../../../../../workflows/create-or-update-product-content'
import type { UpsertContentSchema } from '../../../../../middlewares'
import {
  filterPimContentRecords,
  normalizeSupplierSpecifications,
} from '../../../../../../lib/specifications'

type ProductContentQuery = {
  locale?: string
  channel?: string
}

// GET /admin/pim/products/:id/content?locale=fr-FR&channel=storefront
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const pim = req.scope.resolve<PimModuleService>(PIM_MODULE)
  const { id: product_id } = req.params
  const validatedQuery = req.validatedQuery as ProductContentQuery
  const locale = validatedQuery.locale
  const channel = validatedQuery.channel

  const filters: Record<string, unknown> = { product_id }
  if (channel) filters.channel = channel

  const [records] = await pim.listAndCountProductContents(filters, {
    order: { updated_at: 'DESC' },
  })
  const contents = locale
    ? filterPimContentRecords(records as unknown as Array<Record<string, unknown>>, { locale })
    : records

  const query = req.scope.resolve('query')
  const productQuery = {
    entity: 'product',
    filters: { id: product_id },
    fields: ['id', 'title', 'description', 'metadata', 'variants.id', 'variants.title'],
  }
  const { data: products } = locale
    ? await query.graph(productQuery, { locale })
    : await query.graph(productQuery)
  const product = products[0] as Record<string, unknown> | undefined
  const metadata =
    product?.metadata && typeof product.metadata === 'object'
      ? (product.metadata as Record<string, unknown>)
      : {}

  res.json({
    content: contents,
    product: product
      ? {
          id: product.id,
          title: product.title ?? null,
          description: product.description ?? null,
        }
      : null,
    supplier_specifications: normalizeSupplierSpecifications(metadata.attributes),
    variants: (Array.isArray(product?.variants) ? product.variants : [])
      .filter((variant): variant is Record<string, unknown> => {
        return Boolean(variant) && typeof variant === 'object' && typeof variant.id === 'string'
      })
      .map((variant) => ({
        id: variant.id,
        title: typeof variant.title === 'string' ? variant.title : '',
      })),
  })
}

// POST /admin/pim/products/:id/content - create or update draft
export async function POST(
  req: AuthenticatedMedusaRequest<UpsertContentSchema>,
  res: MedusaResponse,
) {
  const { id: product_id } = req.params
  const actor_id = req.auth_context.actor_id

  const { result } = await createOrUpdateProductContentWorkflow(req.scope).run({
    input: {
      ...req.validatedBody,
      product_id,
      updated_by: actor_id,
      created_by: actor_id,
    },
  })

  res.json({ content: result.content })
}
