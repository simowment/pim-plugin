import {
  createWorkflow,
  transform,
  WorkflowResponse,
  when,
} from '@medusajs/framework/workflows-sdk'
import {
  createJobStep,
  callAiProviderStep,
  finalizeJobStep,
  throwGenerationFailureStep,
} from './steps/generate-product-content'
import {
  createOrUpdateProductContentStep,
  appendContentVersionStep,
} from './steps/create-or-update-product-content'
import { hasUsableSpecifications } from '../lib/specifications'

export interface GenerateProductContentInput {
  product_id: string
  source_locale?: string
  target_locale: string
  channel?: string
  mode: 'translate' | 'rewrite' | 'extract_specs' | 'seo' | 'full'
  tone?: 'neutral' | 'luxury' | 'technical' | 'seo'
  save_as?: 'draft' | 'job_only'
  created_by?: string | null
  // Existing content to enrich (pre-fetched by route)
  existing_content?: Record<string, unknown> | null
}

export const generateProductContentWorkflow: any = createWorkflow(
  'generate-product-content',
  function (input: GenerateProductContentInput) {
    // 1. Create the job record
    const jobInput = transform({ input }, ({ input }) => ({
      type: input.mode,
      product_id: input.product_id,
      locale: input.target_locale,
      input_json: {
        source_locale: input.source_locale,
        channel: input.channel,
        mode: input.mode,
        tone: input.tone,
      },
      created_by: input.created_by ?? null,
    }))
    const job = createJobStep(jobInput)

    // 2. Call AI provider
    const aiInput = transform({ job, input }, ({ job, input }) => ({
      product_id: input.product_id,
      locale: input.target_locale,
      mode: input.mode,
      tone: input.tone ?? 'neutral',
      existing_content: input.existing_content ?? null,
    }))
    const aiResult = callAiProviderStep(aiInput)
    const generated = transform({ aiResult }, ({ aiResult }) => aiResult.generated ?? {})

    // 3. Finalize job for both completed and failed outcomes.
    const finalizeInput = transform({ job, aiResult }, ({ job, aiResult }) => ({
      job_id: (job as any).id as string,
      status: aiResult.status,
      result: aiResult.generated,
      error_message: aiResult.error_message,
    }))
    finalizeJobStep(finalizeInput)

    when(aiResult, (result) => result.status === 'failed').then(() => {
      throwGenerationFailureStep(
        transform({ aiResult }, ({ aiResult }) => ({
          error_message: aiResult.error_message,
        })),
      )
    })

    // 4. Save as draft if requested
    const contentInput = transform({ generated, input }, ({ generated, input }) => {
      const generatedSpecs = (generated as any).specifications_json
      const existingSpecs = input.existing_content?.specifications_json

      return {
        product_id: input.product_id,
        locale: input.target_locale,
        channel: input.channel ?? 'storefront',
        title: (generated as any).title ?? null,
        description: (generated as any).description ?? null,
        short_description: (generated as any).short_description ?? null,
        bullets_json: (generated as any).bullets_json ?? null,
        specifications_json: hasUsableSpecifications(generatedSpecs)
          ? generatedSpecs
          : hasUsableSpecifications(existingSpecs)
            ? existingSpecs
            : null,
        seo_json: (generated as any).seo_json ?? null,
        source: 'ai' as const,
        status: 'ai_generated' as const,
        created_by: input.created_by ?? null,
        change_reason: `AI generated (mode=${input.mode})`,
      }
    })

    const savedContent = when(
      { input, aiResult },
      ({ input, aiResult }) =>
        aiResult.status === 'completed' && (input.save_as ?? 'draft') === 'draft',
    ).then(() => {
      const content = createOrUpdateProductContentStep(contentInput)
      const versionInput = transform({ content }, ({ content }) => ({
        content_id: (content.content as any).id as string,
        snapshot: content.content as Record<string, unknown>,
        actor_type: 'system' as const,
        actor_id: null,
        change_reason: 'AI generated',
      }))
      appendContentVersionStep(versionInput)
      return content
    })

    return new WorkflowResponse({ job, generated, content: savedContent })
  },
)
