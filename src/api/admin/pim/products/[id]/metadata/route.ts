import { AuthenticatedMedusaRequest, MedusaResponse } from '@medusajs/framework/http'
import { syncProductMetadataWorkflow } from '../../../../../../workflows/sync-product-metadata'
import type { UpdateMetadataSchema } from '../../../../../middlewares'

// POST /admin/pim/products/:id/metadata
export async function POST(
  req: AuthenticatedMedusaRequest<UpdateMetadataSchema>,
  res: MedusaResponse,
) {
  const { id: product_id } = req.params

  const { result } = await syncProductMetadataWorkflow(req.scope).run({
    input: {
      ...req.validatedBody,
      product_id,
    },
  })

  res.json({ result })
}
