import { AuthenticatedMedusaRequest, MedusaResponse } from '@medusajs/framework/http'
import { MedusaError } from '@medusajs/framework/utils'
import { listKiloModels } from '../../../../../lib/kilo-models'
import type { ListPimAiModelsQuery } from '../../../../middlewares'

const KILO_PROVIDER_NAMES = new Set(['kilo', 'kilocode'])

function normalizeProvider(provider?: string): string {
  const normalized = provider?.trim().toLowerCase()
  return normalized ? normalized : 'kilo'
}

// GET /admin/pim/ai-settings/models?provider=kilo
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const query = req.validatedQuery as ListPimAiModelsQuery
  const provider = normalizeProvider(query.provider)

  if (!KILO_PROVIDER_NAMES.has(provider)) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      `Model discovery is not available for provider "${provider}".`,
    )
  }

  const models = await listKiloModels({ baseUrl: query.base_url })

  return res.json({ models })
}
