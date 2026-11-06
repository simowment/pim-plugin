import { AuthenticatedMedusaRequest, MedusaResponse } from '@medusajs/framework/http'
import { resolveDefaultPimChannel, resolvePimChannels } from '../../../../lib/channels'
import { resolveDefaultLocaleOption, resolveLocalesOption } from '../../../../lib/config'

// GET /admin/pim/config
export async function GET(_req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  res.json({
    config: {
      default_channel: resolveDefaultPimChannel(),
      channels: resolvePimChannels(),
      default_locale: resolveDefaultLocaleOption(),
      locales: resolveLocalesOption(),
    },
  })
}
