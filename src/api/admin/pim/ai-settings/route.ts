import { MedusaRequest, MedusaResponse } from '@medusajs/framework/http'
import { getPimAiSettings, updatePimAiProviderConfig } from '../../../../lib/ai-config'
import type { UpdatePimAiSettingsSchema } from '../../../middlewares'

// GET /admin/pim/ai-settings
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const settings = await getPimAiSettings(req.scope)
  return res.json({ settings })
}

// POST /admin/pim/ai-settings
export async function POST(
  req: MedusaRequest<UpdatePimAiSettingsSchema>,
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
