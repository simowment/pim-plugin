import { AuthenticatedMedusaRequest, MedusaResponse } from '@medusajs/framework/http'
import { MedusaError } from '@medusajs/framework/utils'
import { PIM_MODULE } from '../../../../../modules/pim'
import type PimModuleService from '../../../../../modules/pim/service'
import { deleteMetadataFieldWorkflow } from '../../../../../workflows/delete-metadata-field'
import { updateMetadataFieldWorkflow } from '../../../../../workflows/update-metadata-field'
import type { CreateMetadataFieldSchema } from '../../../../middlewares'

// GET /admin/pim/metadata-fields/:id
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const pim = req.scope.resolve<PimModuleService>(PIM_MODULE)
  const field = await pim.retrieveProductMetadataField(req.params.id)
  if (!field) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, `Metadata field ${req.params.id} not found`)
  }
  res.json({ metadata_field: field })
}

// POST /admin/pim/metadata-fields/:id
export async function POST(
  req: AuthenticatedMedusaRequest<Partial<CreateMetadataFieldSchema>>,
  res: MedusaResponse,
) {
  const { result: updated } = await updateMetadataFieldWorkflow(req.scope).run({
    input: {
      id: req.params.id,
      ...req.validatedBody,
    },
  })

  res.json({ metadata_field: updated })
}

// DELETE /admin/pim/metadata-fields/:id
export async function DELETE(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const { result } = await deleteMetadataFieldWorkflow(req.scope).run({
    input: { id: req.params.id },
  })

  res.json(result)
}
