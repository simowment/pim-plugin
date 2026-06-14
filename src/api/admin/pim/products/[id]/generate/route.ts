import { AuthenticatedMedusaRequest, MedusaResponse } from '@medusajs/framework/http'
import { MedusaError } from '@medusajs/framework/utils'
import { generateProductContentWorkflow } from '../../../../../../workflows/generate-product-content'
import { PIM_MODULE } from '../../../../../../modules/pim'
import type PimModuleService from '../../../../../../modules/pim/service'
import type { GenerateContentSchema } from '../../../../../middlewares'
import { resolvePimAiConfigFromContainer } from '../../../../../../lib/ai-config'
import {
  PIM_ACTIVE_STATUSES,
  buildPimGenerationSource,
  resolveBestPimContentRecord,
} from '../../../../../../lib/specifications'

// POST /admin/pim/products/:id/generate
export async function POST(
  req: AuthenticatedMedusaRequest<GenerateContentSchema>,
  res: MedusaResponse,
) {
  const { id: product_id } = req.params
  const actor_id = req.auth_context.actor_id

  // Verify product exists
  const query = req.scope.resolve('query')
  const { data: products } = await query.graph({
    entity: 'product',
    filters: { id: product_id },
    fields: ['id', 'title', 'description', 'metadata'],
  })
  if (!products.length) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, `Product ${product_id} not found`)
  }

  // Fetch existing content for the source language to enrich rather than overwrite.
  // Locale matching is language-normalized so "fr", "FR_fr", and "fr-FR" share specs.
  const pim = req.scope.resolve<PimModuleService>(PIM_MODULE)
  const [existingRecords] = await pim.listAndCountProductContents(
    {
      product_id,
      status: [...PIM_ACTIVE_STATUSES] as any,
    },
    { take: 100, order: { updated_at: 'DESC' } },
  )

  const aiConfig = await resolvePimAiConfigFromContainer(req.scope)
  const sourceProduct = products[0] as Record<string, unknown>
  const storedContent = resolveBestPimContentRecord(
    existingRecords as unknown as Array<Record<string, unknown>>,
    {
      locale: req.validatedBody.source_locale ?? req.validatedBody.target_locale,
      channel: req.validatedBody.channel ?? 'storefront',
      defaultChannel: 'storefront',
      statuses: PIM_ACTIVE_STATUSES,
      preferSpecifications: true,
    },
  ) ?? undefined
  const existingContent = buildPimGenerationSource(sourceProduct, storedContent)

  const logger = req.scope.resolve<{ info: (msg: string) => void; warn: (msg: string) => void }>('logger')
  logger.info(
    `[PIM Generate] provider=${aiConfig.provider} model=${aiConfig.model} base_url=${aiConfig.base_url} has_key=${Boolean(aiConfig.api_key)} headers=${Object.keys(aiConfig.headers ?? {}).join(',')}`,
  )

  if (!aiConfig.api_key) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      'AI provider is not configured. Set PIM ai.api_key module option or PIM_AI_API_KEY in your environment.',
    )
  }

  const { result } = await generateProductContentWorkflow(req.scope).run({
    input: {
      ...req.validatedBody,
      product_id,
      created_by: actor_id,
      existing_content: existingContent,
      ai_provider: aiConfig.provider,
      ai_api_key: aiConfig.api_key,
      ai_base_url: aiConfig.base_url,
      ai_model: aiConfig.model,
      ai_temperature: aiConfig.temperature,
      ai_max_tokens: aiConfig.max_tokens,
      ai_request_timeout_ms: aiConfig.request_timeout_ms,
      ai_headers: aiConfig.headers,
    },
  })

  res.json({ job: result.job, generated: result.generated, content: result.content })
}
