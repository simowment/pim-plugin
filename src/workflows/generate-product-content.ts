import { createWorkflow, transform, WorkflowResponse, when } from '@medusajs/framework/workflows-sdk'
import {
  createJobStep,
  callAiProviderStep,
  finalizeJobStep,
} from './steps/generate-product-content'
import {
  createOrUpdateProductContentStep,
  appendContentVersionStep,
} from './steps/create-or-update-product-content'
import { PIM_MODULE } from '../modules/pim'

export type GenerateProductContentInput = {
  product_id: string
  source_locale?: string
  target_locale: string
  channel?: string
  mode: 'translate' | 'rewrite' | 'extract_specs' | 'seo' | 'full'
  tone?: 'neutral' | 'luxury' | 'technical' | 'seo'
  save_as?: 'draft' | 'job_only'
  created_by?: string | null
  // AI provider config — passed from route using module options
  ai_provider?: string
  ai_api_key?: string
  ai_base_url?: string
  ai_model?: string
  ai_temperature?: number
  ai_max_tokens?: number
  ai_request_timeout_ms?: number
  ai_headers?: Record<string, string>
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
      ai_provider: input.ai_provider ?? 'openrouter',
      ai_api_key: input.ai_api_key ?? '',
      ai_base_url: input.ai_base_url ?? 'https://openrouter.ai/api/v1',
      ai_model: input.ai_model ?? 'openai/gpt-4o-mini',
      ai_temperature: input.ai_temperature ?? 0.4,
      ai_max_tokens: input.ai_max_tokens ?? 1200,
      ai_request_timeout_ms: input.ai_request_timeout_ms ?? 30000,
      ai_headers: input.ai_headers ?? {},
    }))
    const generated = callAiProviderStep(aiInput)

    // 3. Finalize job as completed
    const finalizeInput = transform({ job, generated }, ({ job, generated }) => ({
      job_id: (job as any).id as string,
      status: 'completed' as const,
      result: generated as Record<string, unknown>,
      error_message: null,
    }))
    finalizeJobStep(finalizeInput)

    // 4. Save as draft if requested
    const contentInput = transform({ generated, input }, ({ generated, input }) => ({
      product_id: input.product_id,
      locale: input.target_locale,
      channel: input.channel ?? 'storefront',
      title: (generated as any).title ?? null,
      description: (generated as any).description ?? null,
      short_description: (generated as any).short_description ?? null,
      bullets_json: (generated as any).bullets_json ?? null,
      specifications_json: (generated as any).specifications_json ?? null,
      seo_json: (generated as any).seo_json ?? null,
      source: 'ai' as const,
      status: 'ai_generated' as const,
      created_by: input.created_by ?? null,
      change_reason: `AI generated (mode=${input.mode})`,
    }))

    const savedContent = when(input, (i) => (i.save_as ?? 'draft') === 'draft').then(() => {
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
