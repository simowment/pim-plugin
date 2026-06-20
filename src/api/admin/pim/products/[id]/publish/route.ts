import { AuthenticatedMedusaRequest, MedusaResponse } from '@medusajs/framework/http'
import { publishProductContentWorkflow } from '../../../../../../workflows/publish-product-content'
import type { PublishContentSchema } from '../../../../../middlewares'

// POST /admin/pim/products/:id/publish
export async function POST(
  req: AuthenticatedMedusaRequest<PublishContentSchema>,
  res: MedusaResponse,
) {
  const actor_id = req.auth_context.actor_id

  const { result } = await publishProductContentWorkflow(req.scope).run({
    input: {
      ...req.validatedBody,
      product_id: req.params.id,
      actor_id,
    },
  })

  res.json({ content: result.content })
}
