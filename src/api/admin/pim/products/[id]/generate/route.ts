import { AuthenticatedMedusaRequest, MedusaResponse } from '@medusajs/framework/http'
import { MedusaError } from '@medusajs/framework/utils'
import { generateProductContentWorkflow } from '../../../../../../workflows/generate-product-content'
import { PIM_MODULE } from '../../../../../../modules/pim'
import type PimModuleService from '../../../../../../modules/pim/service'
import type { GenerateContentSchema } from '../../../../../middlewares'
import {
  PIM_ACTIVE_STATUSES,
  buildPimGenerationSource,
  resolveBestPimContentRecord,
} from '../../../../../../lib/specifications'
import { resolveDefaultPimChannel } from '../../../../../../lib/channels'

// POST /admin/pim/products/:id/generate
export async function POST(
  req: AuthenticatedMedusaRequest<GenerateContentSchema>,
  res: MedusaResponse,
) {
  const { id: product_id } = req.params
  const actor_id = req.auth_context.actor_id
  const sourceLocale = req.validatedBody.source_locale ?? req.validatedBody.target_locale
  const defaultChannel = resolveDefaultPimChannel()

  // Verify product exists
  const query = req.scope.resolve('query')
  const { data: products } = await query.graph(
    {
      entity: 'product',
      filters: { id: product_id },
      fields: [
        'id',
        'title',
        'description',
        'metadata',
        'variants.id',
        'variants.title',
        'variants.sku',
      ],
    },
    { locale: sourceLocale },
  )
  if (!products.length) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, `Product ${product_id} not found`)
  }

  // Fetch existing content for the exact source locale to enrich rather than overwrite.
  const pim = req.scope.resolve<PimModuleService>(PIM_MODULE)
  const activeStatuses = [...PIM_ACTIVE_STATUSES]
  const [existingRecords] = await pim.listAndCountProductContents(
    {
      product_id,
      status: activeStatuses,
    },
    { take: 100, order: { updated_at: 'DESC' } },
  )

  const sourceProduct = products[0] as Record<string, unknown>
  const storedContent =
    resolveBestPimContentRecord(existingRecords as unknown as Array<Record<string, unknown>>, {
      locale: sourceLocale,
      channel: req.validatedBody.channel ?? defaultChannel,
      defaultChannel,
      statuses: PIM_ACTIVE_STATUSES,
      preferSpecifications: true,
    }) ?? undefined
  const existingContent = buildPimGenerationSource(sourceProduct, storedContent)

  const { result } = await generateProductContentWorkflow(req.scope).run({
    input: {
      ...req.validatedBody,
      product_id,
      created_by: actor_id,
      existing_content: existingContent,
    },
  })

  res.json({ job: result.job, generated: result.generated, content: result.content })
}
