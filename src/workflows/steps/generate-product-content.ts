import { createStep, StepResponse } from '@medusajs/framework/workflows-sdk'
import { MedusaError } from '@medusajs/framework/utils'
import { PIM_MODULE } from '../../modules/pim'
import type PimModuleService from '../../modules/pim/service'
import { resolvePimAiConfigFromContainer } from '../../lib/ai-config'
import { getErrorMessage, truncateErrorMessage } from '../../lib/error-messages'
import { getKiloModelOption } from '../../lib/kilo-models'
import { getRecordId } from '../../lib/records'
import type {
  ProductContentJobStatus,
  ProductContentJobType,
} from '../../modules/pim/models/product-content-job'

const GENERATION_MODES = ['translate', 'rewrite', 'extract_specs', 'seo', 'full'] as const
const TONES = ['neutral', 'luxury', 'technical', 'seo'] as const
const JSON_CONTENT_TYPE = 'application/json'
const ROLLBACK_FAILURE_MESSAGE = 'Generation workflow rolled back before completion.'
const AI_PROVIDER_ERROR_PREVIEW_LENGTH = 1000
const GENERATED_DESCRIPTION_MAX_CHARACTERS = 700
const GENERATED_SHORT_DESCRIPTION_MAX_CHARACTERS = 180
const GENERATED_VARIANT_TITLE_LIMIT = 24
const GENERATED_BULLET_LIMIT = 5
const GENERATED_SPECIFICATION_LIMIT = 20
const GENERATED_SEO_KEYWORD_LIMIT = 8
const NON_JSON_MESSAGE_PREVIEW_LENGTH = 500
const LENGTH_FINISH_REASON = 'length'

export interface GenerateContentInput {
  product_id: string
  source_locale?: string
  target_locale: string
  channel?: string
  mode: (typeof GENERATION_MODES)[number]
  tone?: (typeof TONES)[number]
  save_as?: 'draft' | 'job_only'
  created_by?: string | null
}

export type AiProviderStepResult =
  | {
      status: 'completed'
      generated: Record<string, unknown>
      error_message: null
    }
  | {
      status: 'failed'
      generated: null
      error_message: string
    }

export interface GenerateContentOutput {
  job_id: string
  content_id: string | null
  generated: Record<string, unknown>
}

type AiChatCompletionResponse = {
  choices?: Array<{
    finish_reason?: unknown
    message?: {
      content?: unknown
    }
  }>
}

export const createJobStep = createStep(
  'create-content-job',
  async (
    input: {
      type: ProductContentJobType
      product_id: string | null
      locale: string
      input_json: Record<string, unknown>
      created_by?: string | null
    },
    { container },
  ) => {
    const pim = container.resolve<PimModuleService>(PIM_MODULE)
    const job = await pim.createProductContentJobs({
      type: input.type,
      product_id: input.product_id ?? undefined,
      locale: input.locale,
      status: 'running',
      input_json: input.input_json,
      result_json: null,
      error_message: null,
      created_by: input.created_by ?? null,
      started_at: new Date(),
      completed_at: null,
    })
    return new StepResponse(job, getRecordId(job, 'PIM generation job'))
  },
  async (jobId, { container }) => {
    if (!jobId) return
    const pim = container.resolve<PimModuleService>(PIM_MODULE)
    const job = await pim.retrieveProductContentJob(jobId)
    await pim.updateProductContentJobs({
      id: jobId,
      status: 'failed',
      error_message: job.error_message ?? ROLLBACK_FAILURE_MESSAGE,
      result_json: job.result_json ?? null,
      completed_at: job.completed_at ?? new Date(),
    })
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
      content_scope: 'full' | 'copy_specs'
      existing_content: Record<string, unknown> | null
    },
    { container },
  ) => {
    const logger = container.resolve<{
      info: (message: string) => void
      error: (message: string) => void
    }>('logger')
    const aiConfig = await resolvePimAiConfigFromContainer(container)

    if (!aiConfig.api_key) {
      return new StepResponse<AiProviderStepResult>({
        status: 'failed',
        generated: null,
        error_message:
          'AI provider API key is not configured. Configure the shared AI gateway key or a PIM AI override.',
      })
    }

    logger.info(
      `[PIM] Calling AI provider for product=${input.product_id} locale=${input.locale} mode=${input.mode}`,
    )

    const existingContent = compactContentForScope(input.existing_content, input.content_scope)
    const systemPrompt = buildSystemPrompt(input.mode, input.tone, input.locale, input.content_scope)
    const userPrompt = buildUserPrompt(input.mode, existingContent)
    const modelSupportError = await validateModelSupportsJsonOutput(aiConfig)
    if (modelSupportError) {
      return new StepResponse<AiProviderStepResult>({
        status: 'failed',
        generated: null,
        error_message: modelSupportError,
      })
    }

    const abortController = new AbortController()
    const timeout = setTimeout(() => abortController.abort(), aiConfig.request_timeout_ms)
    let response: Response
    try {
      response = await fetch(`${aiConfig.base_url}/chat/completions`, {
        method: 'POST',
        headers: {
          ...aiConfig.headers,
          'Content-Type': JSON_CONTENT_TYPE,
          Authorization: `Bearer ${aiConfig.api_key}`,
        },
        body: JSON.stringify({
          model: aiConfig.model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          response_format: { type: 'json_object' },
          temperature: aiConfig.temperature,
          max_tokens: aiConfig.max_tokens,
        }),
        signal: abortController.signal,
      })
    } catch (error) {
      const errorMessage = getErrorMessage(error)
      logger.error(
        `[PIM] AI provider request failed provider=${aiConfig.provider} base_url=${aiConfig.base_url} model=${aiConfig.model}: ${errorMessage}`,
      )
      return new StepResponse<AiProviderStepResult>({
        status: 'failed',
        generated: null,
        error_message: `AI provider request failed: ${errorMessage}`,
      })
    } finally {
      clearTimeout(timeout)
    }

    if (!response.ok) {
      const errorText = await response.text()
      return new StepResponse<AiProviderStepResult>({
        status: 'failed',
        generated: null,
        error_message: formatAiProviderError(response.status, errorText, aiConfig.model),
      })
    }

    const responseBody = await response.text()
    let data: AiChatCompletionResponse
    try {
      data = JSON.parse(responseBody) as typeof data
    } catch {
      logger.error(`[PIM] AI response is not valid JSON: ${responseBody.slice(0, 500)}`)
      return new StepResponse<AiProviderStepResult>({
        status: 'failed',
        generated: null,
        error_message: 'AI provider returned invalid JSON response',
      })
    }

    const raw = normalizeMessageContent(data.choices?.[0]?.message?.content)
    const finishReason = getFinishReason(data)

    if (finishReason === LENGTH_FINISH_REASON) {
      logger.error(
        `[PIM] AI response hit token limit: choices=${data.choices?.length ?? 0} body_preview=${responseBody.slice(0, 300)}`,
      )
      return new StepResponse<AiProviderStepResult>({
        status: 'failed',
        generated: null,
        error_message: `AI provider stopped because max_tokens was reached for model "${aiConfig.model}". Increase PIM_AI_MAX_TOKENS, reduce product input size, or choose a model with a larger output limit.`,
      })
    }

    if (!raw) {
      const hasChoices = data.choices && data.choices.length > 0
      logger.error(
        `[PIM] AI returned empty content: choices=${data.choices?.length ?? 0} finish_reason=${finishReason} body_preview=${responseBody.slice(0, 300)}`,
      )
      return new StepResponse<AiProviderStepResult>({
        status: 'failed',
        generated: null,
        error_message: `AI provider returned empty content (finish_reason=${finishReason}, has_choices=${hasChoices}). Check model "${aiConfig.model}" supports JSON output.`,
      })
    }

    const generated = parseGeneratedContent(raw)
    if (generated) {
      return new StepResponse<AiProviderStepResult>({
        status: 'completed',
        generated,
        error_message: null,
      })
    }

    logger.error(
      `[PIM] AI returned non-JSON message content model=${aiConfig.model} raw_preview=${raw.slice(0, NON_JSON_MESSAGE_PREVIEW_LENGTH)}`,
    )
    return new StepResponse<AiProviderStepResult>({
      status: 'failed',
      generated: null,
      error_message: `AI provider returned non-JSON message content for model "${aiConfig.model}": ${truncateErrorMessage(raw, NON_JSON_MESSAGE_PREVIEW_LENGTH)}`,
    })
  },
)

export const throwGenerationFailureStep = createStep(
  'throw-generation-failure',
  async (input: { error_message: string | null }) => {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      input.error_message ?? 'AI generation failed',
    )
  },
)

export const finalizeJobStep = createStep(
  'finalize-content-job',
  async (
    input: {
      job_id: string
      status: Extract<ProductContentJobStatus, 'completed' | 'failed'>
      result: Record<string, unknown> | null
      error_message: string | null
    },
    { container },
  ) => {
    const pim = container.resolve<PimModuleService>(PIM_MODULE)
    const updated = await pim.updateProductContentJobs({
      id: input.job_id,
      status: input.status,
      result_json: input.result ?? null,
      error_message: input.error_message ?? null,
      completed_at: new Date(),
    })
    return new StepResponse(updated)
  },
)

// ─── prompt helpers ────────────────────────────────────────────────────────

function buildSystemPrompt(
  mode: string,
  tone: string,
  locale: string,
  contentScope: 'full' | 'copy_specs',
): string {
  const toneDesc =
    tone === 'luxury'
      ? 'Premium, aspirational, evocative language.'
      : tone === 'technical'
        ? 'Precise, feature-focused, specification-rich language.'
        : tone === 'seo'
          ? 'SEO-optimized with natural keyword integration.'
          : 'Clear, informative, neutral language.'

  const modeDesc: Record<string, string> = {
    translate:
      'Translate the provided product content to the target locale. Preserve specification keys, meaning, measurements, model numbers, and certification names exactly. Translate specification labels and natural-language values.',
    rewrite: 'Rewrite the product content to be engaging and clear.',
    extract_specs: 'Extract structured specifications from the description as JSON array.',
    seo: 'Generate SEO metadata (title, description, keywords) from the product content.',
    full: 'Generate complete product content: title, description, specifications, and SEO fields.',
  }

  const fieldInstruction = contentScope === 'copy_specs'
    ? 'Fields may include only: title, description, short_description, bullets_json (array), specifications_json (array of {key,label,value,unit,group}). Do not return variant_titles_json or seo_json.'
    : 'Fields may include: title, description, short_description, variant_titles_json (array of {variant_id,title}), bullets_json (array), specifications_json (array of {key,label,value,unit,group}), seo_json ({title,description,keywords}).'
  const compactInstruction = contentScope === 'copy_specs'
    ? `Keep the JSON compact: description under ${GENERATED_DESCRIPTION_MAX_CHARACTERS} characters, short_description under ${GENERATED_SHORT_DESCRIPTION_MAX_CHARACTERS} characters, bullets_json up to ${GENERATED_BULLET_LIMIT} items, and specifications_json up to ${GENERATED_SPECIFICATION_LIMIT} customer-relevant items.`
    : `Use only variant_id values present in native_product_json.variants.
Keep the JSON compact: description under ${GENERATED_DESCRIPTION_MAX_CHARACTERS} characters, short_description under ${GENERATED_SHORT_DESCRIPTION_MAX_CHARACTERS} characters, variant_titles_json up to ${GENERATED_VARIANT_TITLE_LIMIT} items, bullets_json up to ${GENERATED_BULLET_LIMIT} items, specifications_json up to ${GENERATED_SPECIFICATION_LIMIT} customer-relevant items, and seo_json.keywords up to ${GENERATED_SEO_KEYWORD_LIMIT} items.
If the product has many variants or the answer may exceed the token limit, omit variant_titles_json instead of truncating JSON.`

  return `You are a professional e-commerce content writer. ${modeDesc[mode] ?? modeDesc.full}
Target locale: ${locale}.
Tone: ${toneDesc}
Respond with a single JSON object containing only the fields you generated.
${fieldInstruction}
${compactInstruction}
Return valid JSON only, with no markdown or commentary.`
}

function compactContentForScope(
  existing: Record<string, unknown> | null,
  contentScope: 'full' | 'copy_specs',
): Record<string, unknown> | null {
  if (!existing || contentScope !== 'copy_specs') {
    return existing
  }

  const nativeProduct = isRecord(existing.native_product_json)
    ? existing.native_product_json
    : {}

  return {
    title: existing.title ?? nativeProduct.title ?? null,
    short_description: existing.short_description ?? null,
    description: existing.description ?? nativeProduct.description ?? null,
    bullets_json: existing.bullets_json ?? null,
    specifications_json: existing.specifications_json ?? null,
    native_product_json: {
      title: nativeProduct.title ?? null,
      description: nativeProduct.description ?? null,
    },
  }
}

function buildUserPrompt(mode: string, existing: Record<string, unknown> | null): string {
  if (!existing)
    return 'No existing content available. Generate from scratch based on the product context.'
  return `Existing content:\n${JSON.stringify(existing, null, 2)}`
}

function normalizeMessageContent(content: unknown): string | null {
  if (typeof content === 'string') {
    const trimmed = content.trim()
    return trimmed ? trimmed : null
  }

  if (!Array.isArray(content)) {
    return null
  }

  const parts = content
    .map((item) => {
      if (typeof item === 'string') {
        return item
      }

      if (!isRecord(item)) {
        return ''
      }

      if (typeof item.text === 'string') {
        return item.text
      }

      if (typeof item.content === 'string') {
        return item.content
      }

      return ''
    })
    .map((part) => part.trim())
    .filter((part) => Boolean(part))

  return parts.length ? parts.join('\n') : null
}

function isKiloProvider(provider: string): boolean {
  const normalized = provider.trim().toLowerCase()
  return normalized === 'kilo' || normalized === 'kilocode'
}

function getFinishReason(data: AiChatCompletionResponse): unknown {
  return data.choices?.[0] && 'finish_reason' in data.choices[0]
    ? (data.choices[0] as Record<string, unknown>).finish_reason
    : 'unknown'
}

async function validateModelSupportsJsonOutput(aiConfig: {
  provider: string
  base_url: string
  model: string
}): Promise<string | null> {
  if (!isKiloProvider(aiConfig.provider)) {
    return null
  }

  let model: Awaited<ReturnType<typeof getKiloModelOption>>
  try {
    model = await getKiloModelOption({
      baseUrl: aiConfig.base_url,
      model: aiConfig.model,
    })
  } catch (error) {
    return `Unable to verify Kilo model JSON support: ${getErrorMessage(error)}`
  }

  if (!model) {
    return `Selected Kilo model "${aiConfig.model}" is not available from the Kilo models endpoint. Pick an available model in AI Setup.`
  }

  if (!model.supports_response_format) {
    return `Selected Kilo model "${aiConfig.model}" does not advertise JSON output support. Pick a Kilo model marked JSON in AI Setup before generating PIM content.`
  }

  return null
}

function parseGeneratedContent(raw: string): Record<string, unknown> | null {
  const direct = parseJsonRecord(raw.trim())
  if (direct) {
    return direct
  }

  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i)
  if (fenced?.[1]) {
    const parsed = parseJsonRecord(fenced[1].trim())
    if (parsed) {
      return parsed
    }
  }

  const embedded = findFirstJsonObject(raw)
  return embedded ? parseJsonRecord(embedded) : null
}

function parseJsonRecord(value: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(value) as unknown
    return isRecord(parsed) ? parsed : null
  } catch {
    return null
  }
}

function findFirstJsonObject(value: string): string | null {
  let start = -1
  let depth = 0
  let inString = false
  let escaped = false

  for (let index = 0; index < value.length; index += 1) {
    const character = value[index]

    if (inString) {
      if (escaped) {
        escaped = false
      } else if (character === '\\') {
        escaped = true
      } else if (character === '"') {
        inString = false
      }
      continue
    }

    if (character === '"') {
      inString = true
      continue
    }

    if (character === '{') {
      if (depth === 0) {
        start = index
      }
      depth += 1
      continue
    }

    if (character === '}' && depth > 0) {
      depth -= 1
      if (depth === 0 && start >= 0) {
        return value.slice(start, index + 1)
      }
    }
  }

  return null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function formatAiProviderError(status: number, body: string, model: string): string {
  try {
    const parsed = JSON.parse(body) as unknown
    return `AI provider returned ${status} for model "${model}": ${getErrorMessage(parsed)}`
  } catch {
    return `AI provider returned ${status} for model "${model}": ${truncateErrorMessage(
      body,
      AI_PROVIDER_ERROR_PREVIEW_LENGTH,
    )}`
  }
}
