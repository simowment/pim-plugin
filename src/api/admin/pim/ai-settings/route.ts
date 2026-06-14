import { AuthenticatedMedusaRequest, MedusaResponse } from '@medusajs/framework/http'
import { getPimAiSettings, updatePimAiProviderConfig } from '../../../../lib/ai-config'
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
  const settings = await updatePimAiProviderConfig(req.scope, {
    provider: req.validatedBody.provider,
    api_key: req.validatedBody.api_key,
    base_url: req.validatedBody.base_url,
    model: req.validatedBody.model,
  })

  return res.json({ settings })
}
