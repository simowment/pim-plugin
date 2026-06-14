import { AuthenticatedMedusaRequest, MedusaResponse } from '@medusajs/framework/http'
import { PIM_MODULE } from '../../../../modules/pim'
import type PimModuleService from '../../../../modules/pim/service'
import { createMetadataFieldWorkflow } from '../../../../workflows/create-metadata-field'
import type { CreateMetadataFieldSchema } from '../../../middlewares'

// GET /admin/pim/metadata-fields
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const pim = req.scope.resolve<PimModuleService>(PIM_MODULE)
  const fields = await pim.listProductMetadataFields({}, { order: { sort_order: 'ASC' } })
  res.json({ metadata_fields: fields })
}

// POST /admin/pim/metadata-fields
export async function POST(
  req: AuthenticatedMedusaRequest<CreateMetadataFieldSchema>,
  res: MedusaResponse,
) {
  const { result: field } = await createMetadataFieldWorkflow(req.scope).run({
    input: req.validatedBody,
  })

  res.json({ metadata_field: field })
}
