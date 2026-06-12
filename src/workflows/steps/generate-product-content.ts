import { createStep, StepResponse } from '@medusajs/framework/workflows-sdk'
import { MedusaError } from '@medusajs/framework/utils'
import { PIM_MODULE } from '../../modules/pim'
import type PimModuleService from '../../modules/pim/service'

const GENERATION_MODES = ['translate', 'rewrite', 'extract_specs', 'seo', 'full'] as const
const TONES = ['neutral', 'luxury', 'technical', 'seo'] as const
const JSON_CONTENT_TYPE = 'application/json'

export type GenerateContentInput = {
  product_id: string
  source_locale?: string
  target_locale: string
  channel?: string
  mode: (typeof GENERATION_MODES)[number]
  tone?: (typeof TONES)[number]
  save_as?: 'draft' | 'job_only'
  created_by?: string | null
  // AI provider config (passed from module options)
  ai_provider?: string
  ai_api_key?: string
  ai_base_url?: string
  ai_model?: string
  ai_temperature?: number
  ai_max_tokens?: number
  ai_request_timeout_ms?: number
  ai_headers?: Record<string, string>
}

export type GenerateContentOutput = {
  job_id: string
  content_id: string | null
  generated: Record<string, unknown>
}

export const createJobStep = createStep(
  'create-content-job',
  async (
    input: { type: string; product_id: string | null; locale: string; input_json: Record<string, unknown>; created_by?: string | null },
    { container },
  ) => {
    const pim = container.resolve<PimModuleService>(PIM_MODULE)
    const job = await pim.createProductContentJobs({
      type: input.type as any,
      product_id: input.product_id ?? undefined,
      locale: input.locale,
      status: 'running',
      input_json: input.input_json,
      result_json: null,
      error_message: null,
      created_by: input.created_by ?? null,
      started_at: new Date() as any,
      completed_at: null,
    })
    return new StepResponse(job, (job as any).id)
  },
  async (jobId, { container }) => {
    if (!jobId) return
    const pim = container.resolve<PimModuleService>(PIM_MODULE)
    await pim.deleteProductContentJobs(jobId)
  },
)

export const callAiProviderStep = createStep(
  'call-ai-provider',
  async (
    input: {
      product_id: string
      locale: string
      mode: string
      tone: string
      existing_content: Record<string, unknown> | null
      ai_provider: string
      ai_api_key: string
      ai_base_url: string
      ai_model: string
      ai_temperature: number
      ai_max_tokens: number
      ai_request_timeout_ms: number
      ai_headers: Record<string, string>
    },
    { container },
  ) => {
    const logger = container.resolve<{ info: (message: string) => void; error: (message: string) => void }>('logger')

    if (!input.ai_api_key) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        'AI provider API key is not configured. Set PIM_AI_API_KEY in your environment.',
      )
    }

    logger.info(`[PIM] Calling AI provider for product=${input.product_id} locale=${input.locale} mode=${input.mode}`)

    const systemPrompt = buildSystemPrompt(input.mode, input.tone)
    const userPrompt = buildUserPrompt(input.mode, input.existing_content)

    const abortController = new AbortController()
    const timeout = setTimeout(() => abortController.abort(), input.ai_request_timeout_ms)
    let response: Response
    try {
      response = await fetch(`${input.ai_base_url}/chat/completions`, {
        method: 'POST',
        headers: {
          ...input.ai_headers,
          'Content-Type': JSON_CONTENT_TYPE,
          Authorization: `Bearer ${input.ai_api_key}`,
        },
        body: JSON.stringify({
          model: input.ai_model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          response_format: { type: 'json_object' },
          temperature: input.ai_temperature,
          max_tokens: input.ai_max_tokens,
        }),
        signal: abortController.signal,
      })
    } catch (error) {
      logger.error(
        `[PIM] AI provider request failed provider=${input.ai_provider} base_url=${input.ai_base_url} model=${input.ai_model}: ${error instanceof Error ? error.message : String(error)}`,
      )
      throw new MedusaError(
        MedusaError.Types.UNEXPECTED_STATE,
        `AI provider request failed: ${error instanceof Error ? error.message : String(error)}`,
      )
    } finally {
      clearTimeout(timeout)
    }

    if (!response.ok) {
      const errorText = await response.text()
      throw new MedusaError(
        MedusaError.Types.UNEXPECTED_STATE,
        `AI provider returned ${response.status}: ${errorText}`,
      )
    }

    const responseBody = await response.text()
    let data: { choices?: Array<{ message?: { content?: string } }> }
    try {
      data = JSON.parse(responseBody) as typeof data
    } catch {
      logger.error(`[PIM] AI response is not valid JSON: ${responseBody.slice(0, 500)}`)
      throw new MedusaError(
        MedusaError.Types.UNEXPECTED_STATE,
        'AI provider returned invalid JSON response',
      )
    }

    const raw = data.choices?.[0]?.message?.content

    if (!raw) {
      const hasChoices = data.choices && data.choices.length > 0
      const finishReason = data.choices?.[0] && 'finish_reason' in data.choices[0]
        ? (data.choices[0] as Record<string, unknown>).finish_reason
        : 'unknown'
      logger.error(
        `[PIM] AI returned empty content: choices=${data.choices?.length ?? 0} finish_reason=${finishReason} body_preview=${responseBody.slice(0, 300)}`,
      )
      throw new MedusaError(
        MedusaError.Types.UNEXPECTED_STATE,
        `AI provider returned empty content (finish_reason=${finishReason}, has_choices=${hasChoices}). Check model "${input.ai_model}" supports JSON output.`,
      )
    }

    const generated = JSON.parse(raw) as Record<string, unknown>
    return new StepResponse(generated)
  },
)

export const finalizeJobStep = createStep(
  'finalize-content-job',
  async (
    input: {
      job_id: string
      status: 'completed' | 'failed'
      result: Record<string, unknown> | null
      error_message: string | null
    },
    { container },
  ) => {
    const pim = container.resolve<PimModuleService>(PIM_MODULE)
    const updated = await pim.updateProductContentJobs({
      id: input.job_id,
      status: input.status as any,
      result_json: input.result ?? null,
      error_message: input.error_message ?? null,
      completed_at: new Date() as any,
    })
    return new StepResponse(updated)
  },
)

// ─── prompt helpers ────────────────────────────────────────────────────────

function buildSystemPrompt(mode: string, tone: string): string {
  const toneDesc =
    tone === 'luxury'
      ? 'Premium, aspirational, evocative language.'
      : tone === 'technical'
        ? 'Precise, feature-focused, specification-rich language.'
        : tone === 'seo'
          ? 'SEO-optimized with natural keyword integration.'
          : 'Clear, informative, neutral language.'

  const modeDesc: Record<string, string> = {
    translate: 'Translate the provided product content to the target locale. Preserve meaning exactly.',
    rewrite: 'Rewrite the product content to be engaging and clear.',
    extract_specs: 'Extract structured specifications from the description as JSON array.',
    seo: 'Generate SEO metadata (title, description, keywords) from the product content.',
    full: 'Generate complete product content: title, description, specifications, and SEO fields.',
  }

  return `You are a professional e-commerce content writer. ${modeDesc[mode] ?? modeDesc.full}
Tone: ${toneDesc}
Respond with a single JSON object containing only the fields you generated.
Fields may include: title, description, short_description, bullets_json (array), specifications_json (array of {key,label,value,unit,group}), seo_json ({title,description,keywords}).`
}

function buildUserPrompt(mode: string, existing: Record<string, unknown> | null): string {
  if (!existing) return 'No existing content available. Generate from scratch based on the product context.'
  return `Existing content:\n${JSON.stringify(existing, null, 2)}`
}
