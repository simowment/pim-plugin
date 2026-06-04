import { AuthenticatedMedusaRequest, MedusaResponse } from '@medusajs/framework/http'
import { MedusaError } from '@medusajs/framework/utils'
import { generateProductContentWorkflow } from '../../../../../../workflows/generate-product-content'
import { PIM_MODULE } from '../../../../../../modules/pim'
import type PimModuleService from '../../../../../../modules/pim/service'
import type { GenerateContentSchema } from '../../../../../middlewares'

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
    fields: ['id', 'title', 'subtitle', 'description', 'metadata'],
  })
  if (!products.length) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, `Product ${product_id} not found`)
  }

  // Fetch existing content for the target locale to enrich rather than overwrite
  const pim = req.scope.resolve<PimModuleService>(PIM_MODULE)
  const sourceLocale = req.validatedBody.source_locale ?? req.validatedBody.target_locale
  const [existing] = await pim.listAndCountProductContents(
    {
      product_id,
      locale: sourceLocale,
      channel: [req.validatedBody.channel ?? 'storefront', 'default'] as any,
    },
    { take: 1 },
  )
  const sourceContent = (existing[0] as unknown as Record<string, unknown> | undefined) ?? {
    locale: 'product',
    title: products[0].title,
    subtitle: products[0].subtitle ?? null,
    description: products[0].description ?? null,
    metadata: products[0].metadata ?? null,
  }

  // Read AI config from environment — the route pulls these server-side so keys never reach the client
  const aiConfig = {
    ai_provider: process.env.PIM_AI_PROVIDER ?? 'openrouter',
    ai_api_key: process.env.PIM_AI_API_KEY ?? '',
    ai_base_url: process.env.PIM_AI_BASE_URL ?? 'https://openrouter.ai/api/v1',
    ai_model: process.env.PIM_AI_MODEL ?? 'openai/gpt-4o-mini',
  }

  if (!aiConfig.ai_api_key) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      'AI provider is not configured. Set PIM_AI_API_KEY in your environment.',
    )
  }

  const { result } = await generateProductContentWorkflow(req.scope).run({
    input: {
      ...req.validatedBody,
      product_id,
      created_by: actor_id,
      existing_content: sourceContent,
      ...aiConfig,
    },
  })

  res.json({ job: result.job, generated: result.generated, content: result.content })
}
