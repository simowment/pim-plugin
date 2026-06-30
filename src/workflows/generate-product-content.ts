import {
  createWorkflow,
  type ReturnWorkflow,
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
  type CreateOrUpdateContentInput,
} from './steps/create-or-update-product-content'
import { hasUsableSpecifications } from '../lib/specifications'
import { getRecordId } from '../lib/records'
import { resolveDefaultPimChannel } from '../lib/channels'

export interface GenerateProductContentInput {
  product_id: string
  source_locale?: string
  target_locale: string
  channel?: string
  mode: 'translate' | 'rewrite' | 'extract_specs' | 'seo' | 'full'
  tone?: 'neutral' | 'luxury' | 'technical' | 'seo'
  content_scope?: 'full' | 'copy_specs'
  save_as?: 'draft' | 'job_only'
  translate_fields?: Array<'title' | 'description' | 'short_description' | 'specifications'>
  created_by?: string | null
  // Existing content to enrich (pre-fetched by route)
  existing_content?: Record<string, unknown> | null
}

type GeneratedProductContentFields = {
  title?: string | null
  description?: string | null
  short_description?: string | null
  variant_titles_json?: unknown[] | null
  specifications_json?: unknown[] | null
  seo_json?: Record<string, unknown> | null
}

type GenerateProductContentWorkflowOutput = {
  job: unknown
  generated: Record<string, unknown>
  content: unknown
}

function resolveGenerationContentScope(
  input: GenerateProductContentInput,
): NonNullable<GenerateProductContentInput['content_scope']> {
  return input.content_scope ?? (input.mode === 'translate' ? 'copy_specs' : 'full')
}

export const generateProductContentWorkflow: ReturnWorkflow<
  GenerateProductContentInput,
  GenerateProductContentWorkflowOutput,
  []
> = createWorkflow(
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
        content_scope: resolveGenerationContentScope(input),
        translate_fields: input.translate_fields,
      },
      created_by: input.created_by ?? null,
    }))
    const job = createJobStep(jobInput)

    // 2. Call AI provider
    const aiInput = transform({ job, input }, ({ job, input }) => ({
      product_id: input.product_id,
      job_id: getRecordId(job, 'PIM generation job'),
      locale: input.target_locale,
      mode: input.mode,
      tone: input.tone ?? 'neutral',
      content_scope: resolveGenerationContentScope(input),
      translate_fields: input.translate_fields,
      existing_content: input.existing_content ?? null,
    }))
    const aiResult = callAiProviderStep(aiInput)
    const generated = transform({ aiResult }, ({ aiResult }) => aiResult.generated ?? {})

    // 3. Finalize job for both completed and failed outcomes.
    const finalizeInput = transform({ job, aiResult }, ({ job, aiResult }) => ({
      job_id: getRecordId(job, 'PIM generation job'),
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
      const generatedContent = generated as GeneratedProductContentFields
      const generatedSpecs = generatedContent.specifications_json
      const content: CreateOrUpdateContentInput = {
        product_id: input.product_id,
        locale: input.target_locale,
        channel: input.channel ?? resolveDefaultPimChannel(),
        source: 'ai' as const,
        status: 'draft' as const,
        created_by: input.created_by ?? null,
        change_reason: `AI generated (mode=${input.mode})`,
      }

      if ('title' in generatedContent) content.title = generatedContent.title ?? null
      if ('description' in generatedContent) content.description = generatedContent.description ?? null
      if ('short_description' in generatedContent) {
        content.short_description = generatedContent.short_description ?? null
      }
      if ('variant_titles_json' in generatedContent) {
        content.variant_titles_json = generatedContent.variant_titles_json ?? null
      }
      if (hasUsableSpecifications(generatedSpecs)) {
        content.specifications_json = generatedSpecs
      }
      if ('seo_json' in generatedContent) content.seo_json = generatedContent.seo_json ?? null

      return content
    })

    const savedContent = when(
      { input, aiResult },
      ({ input, aiResult }) =>
        aiResult.status === 'completed' && (input.save_as ?? 'draft') === 'draft',
    ).then(() => {
      const content = createOrUpdateProductContentStep(contentInput)
      const versionInput = transform({ content }, ({ content }) => ({
        content_id: getRecordId(content.content, 'Generated PIM content'),
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
