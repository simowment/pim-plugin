import { AuthenticatedMedusaRequest, MedusaResponse } from '@medusajs/framework/http'
import { MedusaError } from '@medusajs/framework/utils'
import { generateProductContentWorkflow } from '../../../../../../workflows/generate-product-content'
import type { GenerateContentSchema } from '../../../../../middlewares'
import { getErrorMessage } from '../../../../../../lib/error-messages'

// POST /admin/pim/products/:id/generate
export async function POST(
  req: AuthenticatedMedusaRequest<GenerateContentSchema>,
  res: MedusaResponse,
) {
  const { id: product_id } = req.params
  const actor_id = req.auth_context.actor_id

  try {
    const { result } = await generateProductContentWorkflow(req.scope).run({
      input: {
        ...req.validatedBody,
        product_id,
        created_by: actor_id,
      },
    })

    res.json({ job: result.job, generated: result.generated, content: result.content })
  } catch (error) {
    if (error instanceof MedusaError) {
      throw error
    }

    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      `Unable to generate PIM content: ${getErrorMessage(error)}`,
    )
  }
}
