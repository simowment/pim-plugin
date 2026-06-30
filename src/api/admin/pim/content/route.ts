import { AuthenticatedMedusaRequest, MedusaResponse } from '@medusajs/framework/http'
import { PIM_MODULE } from '../../../../modules/pim'
import type PimModuleService from '../../../../modules/pim/service'
import type { ListContentQuery } from '../../../middlewares'

interface QueryConfigWithPagination {
  pagination?: {
    take?: number
    skip?: number
  }
}

// GET /admin/pim/content
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const pim = req.scope.resolve<PimModuleService>(PIM_MODULE)

  const { product_id, locale, status, channel } = req.validatedQuery as ListContentQuery
  const { pagination } = req.queryConfig as QueryConfigWithPagination

  const filters: Record<string, unknown> = {}
  if (product_id) filters.product_id = product_id
  if (locale) filters.locale = locale
  if (status) {
    filters.status = status
  } else {
    filters.status = ['draft', 'reviewed', 'published']
  }
  if (channel) filters.channel = channel

  const [contents, count] = await pim.listAndCountProductContents(filters, {
    take: pagination?.take ?? 50,
    skip: pagination?.skip ?? 0,
    order: { updated_at: 'DESC' },
  })

  res.json({
    content: contents,
    count,
    limit: pagination?.take ?? 50,
    offset: pagination?.skip ?? 0,
  })
}
