import { AuthenticatedMedusaRequest, MedusaResponse } from '@medusajs/framework/http'
import { MedusaError } from '@medusajs/framework/utils'
import { PIM_MODULE } from '../../../../../modules/pim'
import type PimModuleService from '../../../../../modules/pim/service'
import { archiveProductContentWorkflow } from '../../../../../workflows/archive-product-content'

// GET /admin/pim/content/:id
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const pim = req.scope.resolve<PimModuleService>(PIM_MODULE)
  const { id } = req.params

  const content = await pim.retrieveProductContent(id)
  if (!content) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, `PIM content ${id} not found`)
  }

  res.json({ content })
}

// DELETE /admin/pim/content/:id — archives, does not hard-delete
export async function DELETE(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const { id } = req.params

  const { result } = await archiveProductContentWorkflow(req.scope).run({
    input: {
      id,
      actor_id: req.auth_context.actor_id,
    },
  })

  res.json(result)
}
