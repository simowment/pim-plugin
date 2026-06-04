import { AuthenticatedMedusaRequest, MedusaResponse } from '@medusajs/framework/http'
import { MedusaError } from '@medusajs/framework/utils'
import { PIM_MODULE } from '../../../../../../modules/pim'
import type PimModuleService from '../../../../../../modules/pim/service'
import { createOrUpdateProductContentWorkflow } from '../../../../../../workflows/create-or-update-product-content'
import type { UpsertContentSchema } from '../../../../../middlewares'

// GET /admin/pim/products/:id/content?locale=fr&channel=storefront
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const pim = req.scope.resolve<PimModuleService>(PIM_MODULE)
  const { id: product_id } = req.params
  const { locale, channel } = req.validatedQuery as { locale?: string; channel?: string }

  const filters: Record<string, unknown> = { product_id }
  if (locale) filters.locale = locale
  if (channel) filters.channel = channel

  const [contents] = await pim.listAndCountProductContents(filters, {
    order: { updated_at: 'DESC' },
  })

  res.json({ content: contents })
}

// POST /admin/pim/products/:id/content — create or update draft
export async function POST(req: AuthenticatedMedusaRequest<UpsertContentSchema>, res: MedusaResponse) {
  const { id: product_id } = req.params
  const actor_id = req.auth_context.actor_id

  // Verify the product exists via query
  const query = req.scope.resolve('query')
  const { data: products } = await query.graph({
    entity: 'product',
    filters: { id: product_id },
    fields: ['id'],
  })
  if (!products.length) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, `Product ${product_id} not found`)
  }

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
