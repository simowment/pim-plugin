import { AuthenticatedMedusaRequest, MedusaResponse } from '@medusajs/framework/http'
import { PIM_MODULE } from '../../../../modules/pim'
import type PimModuleService from '../../../../modules/pim/service'

export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const pim = req.scope.resolve<PimModuleService>(PIM_MODULE)
  const { status, type, product_id } = req.validatedQuery as any
  const { pagination } = req.queryConfig as any

  const filters: Record<string, unknown> = {}
  if (status) filters.status = status
  if (type) filters.type = type
  if (product_id) filters.product_id = product_id

  const [jobs, count] = await pim.listAndCountProductContentJobs(filters, {
    take: pagination?.take ?? 50,
    skip: pagination?.skip ?? 0,
    order: { created_at: 'DESC' },
  })

  res.json({
    jobs,
    count,
    limit: pagination?.take ?? 50,
    offset: pagination?.skip ?? 0,
  })
}
