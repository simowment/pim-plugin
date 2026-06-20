import { AuthenticatedMedusaRequest, MedusaResponse } from '@medusajs/framework/http'
import { MedusaError } from '@medusajs/framework/utils'
import { getPimAiSettings } from '../../../../lib/ai-config'
import { getErrorMessage } from '../../../../lib/error-messages'
import { updatePimAiSettingsWorkflow } from '../../../../workflows/update-pim-ai-settings'
import type { UpdatePimAiSettingsSchema } from '../../../middlewares'

// GET /admin/pim/ai-settings
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const settings = await getPimAiSettings(req.scope)
  return res.json({ settings })
}

// POST /admin/pim/ai-settings
export async function POST(
  req: AuthenticatedMedusaRequest<UpdatePimAiSettingsSchema>,
  res: MedusaResponse,
) {
  try {
    const { result: settings } = await updatePimAiSettingsWorkflow(req.scope).run({
      input: {
        provider: req.validatedBody.provider,
        api_key: req.validatedBody.api_key,
        base_url: req.validatedBody.base_url,
        model: req.validatedBody.model,
      },
    })
    return res.json({ settings })
  } catch (error) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      `Unable to save PIM AI settings: ${getErrorMessage(error)}`,
    )
  }
}
