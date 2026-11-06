import { AuthenticatedMedusaRequest, MedusaResponse } from '@medusajs/framework/http'
import { archiveProductContentWorkflow } from '../../../../../../workflows/archive-product-content'

// POST /admin/pim/content/:id/archive
// Unpublishes (archives) a PIM record and removes the translations its publish
// mirrored into the Medusa Translation module. Idempotent.
export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const { result } = await archiveProductContentWorkflow(req.scope).run({
    input: {
      id: req.params.id,
      actor_id: req.auth_context.actor_id,
    },
  })

  res.json(result)
}
