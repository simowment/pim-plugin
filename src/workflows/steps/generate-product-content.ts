import { createStep, StepResponse } from '@medusajs/framework/workflows-sdk'
import { MedusaError } from '@medusajs/framework/utils'
import { PIM_MODULE } from '../../modules/pim'
import type PimModuleService from '../../modules/pim/service'
import { resolvePimAiConfigFromContainer } from '../../lib/ai-config'
import { getErrorMessage } from '../../lib/error-messages'
import { getKiloModelOption } from '../../lib/kilo-models'
import { getRecordId } from '../../lib/records'
import { ProductContentFieldsSchema } from '../../lib/product-content-schema'
import type {
  ProductContentJobStatus,
  ProductContentJobType,
} from '../../modules/pim/models/product-content-job'

const GENERATION_MODES = ['translate', 'rewrite', 'extract_specs', 'seo', 'full'] as const
const TONES = ['neutral', 'luxury', 'technical', 'seo'] as const
const JSON_CONTENT_TYPE = 'application/json'
const ROLLBACK_FAILURE_MESSAGE = 'Generation workflow rolled back before completion.'
const GENERATED_DESCRIPTION_MAX_CHARACTERS = 700
const GENERATED_SHORT_DESCRIPTION_MAX_CHARACTERS = 180
const GENERATED_VARIANT_TITLE_LIMIT = 24
const GENERATED_SPECIFICATION_LIMIT = 20
const GENERATED_SEO_KEYWORD_LIMIT = 8
const LENGTH_FINISH_REASON = 'length'
const AI_CONTENT_LOG_PREVIEW_LIMIT = 500
const SPECIFICATION_PASS_SIZE = 10
const DEFAULT_TRANSLATE_FIELDS = ['title', 'description', 'short_description', 'specifications'] as const
type TranslateField = (typeof DEFAULT_TRANSLATE_FIELDS)[number]

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
      generated: Record<string, unknown>
      error_message: string
    }

type AiPassResult =
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

type GenerationProgressStep = {
  key: string
  status: 'completed' | 'failed' | 'skipped'
  generated_keys: string[]
  error_message: string | null
  completed_at: string
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
      job_id: string
      locale: string
      mode: string
      tone: string
      content_scope: 'full' | 'copy_specs'
      translate_fields?: TranslateField[]
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
        generated: {},
        error_message:
          'AI provider API key is not configured. Configure the shared AI gateway key or a PIM AI override.',
      })
    }

    logger.info(
      `[PIM] Calling AI provider for product=${input.product_id} locale=${input.locale} mode=${input.mode}`,
    )

    const modelSupportError = await validateModelSupportsJsonOutput(aiConfig)
    if (modelSupportError) {
      return new StepResponse<AiProviderStepResult>({
        status: 'failed',
        generated: {},
        error_message: modelSupportError,
      })
    }

    if (input.mode === 'translate') {
      return new StepResponse<AiProviderStepResult>(
        await runTranslatePasses({
          input,
          aiConfig,
          pim: container.resolve<PimModuleService>(PIM_MODULE),
          logger,
        }),
      )
    }

    const existingContent = compactContentForScope(input.existing_content, input.content_scope, input.mode)
    const result = await callAiPass({
      aiConfig,
      logger,
      systemPrompt: buildSystemPrompt(input.mode, input.tone, input.locale, input.content_scope),
      userPrompt: buildUserPrompt(input.mode, existingContent),
    })

    if (result.status === 'completed') {
      return new StepResponse<AiProviderStepResult>(result)
    }

    return new StepResponse<AiProviderStepResult>({
      status: 'failed',
      generated: {},
      error_message: result.error_message,
    })
  },
)

async function callAiPass(input: {
  aiConfig: Awaited<ReturnType<typeof resolvePimAiConfigFromContainer>>
  logger: {
    error: (message: string) => void
  }
  systemPrompt: string
  userPrompt: string
}): Promise<AiPassResult> {
  const abortController = new AbortController()
  const timeout = setTimeout(() => abortController.abort(), input.aiConfig.request_timeout_ms)
  let response: Response

  try {
    response = await fetch(`${input.aiConfig.base_url}/chat/completions`, {
      method: 'POST',
      headers: {
        ...input.aiConfig.headers,
        'Content-Type': JSON_CONTENT_TYPE,
        Authorization: `Bearer ${input.aiConfig.api_key}`,
      },
      body: JSON.stringify({
        model: input.aiConfig.model,
        messages: [
          { role: 'system', content: input.systemPrompt },
          { role: 'user', content: input.userPrompt },
        ],
        response_format: { type: 'json_object' },
        temperature: input.aiConfig.temperature,
        max_tokens: input.aiConfig.max_tokens,
      }),
      signal: abortController.signal,
    })
  } catch (error) {
    const errorMessage = getErrorMessage(error)
    input.logger.error(
      `[PIM] AI provider request failed provider=${input.aiConfig.provider} base_url=${input.aiConfig.base_url} model=${input.aiConfig.model}: ${errorMessage}`,
    )
    return {
      status: 'failed',
      generated: null,
      error_message: `AI provider request failed: ${errorMessage}`,
    }
  } finally {
    clearTimeout(timeout)
  }

  if (!response.ok) {
    const errorText = await response.text()
    return {
      status: 'failed',
      generated: null,
      error_message: formatAiProviderError(response.status, errorText, input.aiConfig.model),
    }
  }

  const responseBody = await response.text()
  let data: AiChatCompletionResponse
  try {
    data = JSON.parse(responseBody) as typeof data
  } catch {
    input.logger.error(`[PIM] AI response is not valid JSON for model=${input.aiConfig.model}`)
    return {
      status: 'failed',
      generated: null,
      error_message: 'AI provider returned invalid JSON response',
    }
  }

  const finishReason = getFinishReason(data)
  if (finishReason === LENGTH_FINISH_REASON) {
    input.logger.error(`[PIM] AI response hit token limit: choices=${data.choices?.length ?? 0}`)
    return {
      status: 'failed',
      generated: null,
      error_message: `AI provider stopped because max_tokens was reached for model "${input.aiConfig.model}". Increase PIM_AI_MAX_TOKENS, reduce product input size, or choose a model with a larger output limit.`,
    }
  }

  const raw = normalizeMessageContent(data.choices?.[0]?.message?.content)
  if (!raw) {
    const hasChoices = data.choices && data.choices.length > 0
    input.logger.error(
      `[PIM] AI returned empty content: choices=${data.choices?.length ?? 0} finish_reason=${finishReason}`,
    )
    return {
      status: 'failed',
      generated: null,
      error_message: `AI provider returned empty content (finish_reason=${finishReason}, has_choices=${hasChoices}). Check model "${input.aiConfig.model}" supports JSON output.`,
    }
  }

  const generated = parseGeneratedContent(
    raw,
    (message) => input.logger.error(message),
    input.aiConfig.model,
  )
  if (!generated) {
    input.logger.error(`[PIM] AI returned non-JSON message content model=${input.aiConfig.model}`)
    return {
      status: 'failed',
      generated: null,
      error_message: `AI provider returned non-JSON message content for model "${input.aiConfig.model}"`,
    }
  }

  return { status: 'completed', generated, error_message: null }
}

async function runTranslatePasses(input: {
  input: {
    product_id: string
    job_id: string
    locale: string
    mode: string
    tone: string
    content_scope: 'full' | 'copy_specs'
    translate_fields?: TranslateField[]
    existing_content: Record<string, unknown> | null
  }
  aiConfig: Awaited<ReturnType<typeof resolvePimAiConfigFromContainer>>
  pim: PimModuleService
  logger: {
    error: (message: string) => void
  }
}): Promise<AiProviderStepResult> {
  const source = compactContentForScope(input.input.existing_content, 'copy_specs', 'translate') ?? {}
  const translateFields = input.input.translate_fields?.length
    ? input.input.translate_fields
    : [...DEFAULT_TRANSLATE_FIELDS]
  const generated: Record<string, unknown> = {}
  const steps: GenerationProgressStep[] = []

  const copyFields = translateFields.filter((field) => field !== 'specifications')
  const copyInput = pickTranslateInput(source, copyFields)

  if (copyFields.length) {
    const copyResult = await callAiPass({
      aiConfig: input.aiConfig,
      logger: input.logger,
      systemPrompt: buildTranslatePassSystemPrompt(input.input.locale, input.input.tone, 'copy', copyFields),
      userPrompt: `Translate this JSON content:\n${JSON.stringify(copyInput, null, 2)}`,
    })

    if (copyResult.status === 'failed') {
      steps.push(progressStep('copy', 'failed', [], copyResult.error_message))
      await persistGenerationProgress(input.pim, input.input.job_id, generated, steps)
      return {
        status: 'failed',
        generated: withGenerationProgress(generated, steps),
        error_message: copyResult.error_message,
      }
    }

    mergeGeneratedFields(generated, copyResult.generated, copyFields)
    steps.push(progressStep('copy', 'completed', Object.keys(copyResult.generated), null))
    await persistGenerationProgress(input.pim, input.input.job_id, generated, steps)
  } else {
    steps.push(progressStep('copy', 'skipped', [], null))
    await persistGenerationProgress(input.pim, input.input.job_id, generated, steps)
  }

  const specifications = Array.isArray(source.specifications_json) ? source.specifications_json : []
  if (!translateFields.includes('specifications') || !specifications.length) {
    steps.push(progressStep('specifications', 'skipped', [], null))
    await persistGenerationProgress(input.pim, input.input.job_id, generated, steps)
    return {
      status: 'completed',
      generated: withGenerationProgress(generated, steps),
      error_message: null,
    }
  }

  const translatedSpecs: unknown[] = []
  for (let index = 0; index < specifications.length; index += SPECIFICATION_PASS_SIZE) {
    const passNumber = Math.floor(index / SPECIFICATION_PASS_SIZE) + 1
    const chunk = specifications.slice(index, index + SPECIFICATION_PASS_SIZE)
    const key = `specifications_${passNumber}`
    const specsResult = await callAiPass({
      aiConfig: input.aiConfig,
      logger: input.logger,
      systemPrompt: buildTranslatePassSystemPrompt(input.input.locale, input.input.tone, 'specifications'),
      userPrompt: `Translate this JSON content:\n${JSON.stringify({ specifications_json: chunk }, null, 2)}`,
    })

    if (specsResult.status === 'failed') {
      steps.push(progressStep(key, 'failed', [], specsResult.error_message))
      generated.specifications_json = translatedSpecs
      await persistGenerationProgress(input.pim, input.input.job_id, generated, steps)
      return {
        status: 'failed',
        generated: withGenerationProgress(generated, steps),
        error_message: specsResult.error_message,
      }
    }

    if (Array.isArray(specsResult.generated.specifications_json)) {
      translatedSpecs.push(...specsResult.generated.specifications_json)
      generated.specifications_json = translatedSpecs
    }
    steps.push(progressStep(key, 'completed', Object.keys(specsResult.generated), null))
    await persistGenerationProgress(input.pim, input.input.job_id, generated, steps)
  }

  return {
    status: 'completed',
    generated: withGenerationProgress(generated, steps),
    error_message: null,
  }
}

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

  const fieldInstruction = mode === 'seo'
    ? 'Fields may include only: seo_json ({title,description,keywords}). Do not return title, description, short_description, variant_titles_json, bullets_json, or specifications_json.'
    : contentScope === 'copy_specs'
      ? 'Fields may include only: title, description, short_description, specifications_json (array of {key,label,value,unit,group}). Do not return variant_titles_json, bullets_json, or seo_json.'
      : 'Fields may include: title, description, short_description, variant_titles_json (array of {variant_id,title}), specifications_json (array of {key,label,value,unit,group}), seo_json ({title,description,keywords}). Do not return bullets_json.'
  const compactInstruction = contentScope === 'copy_specs'
    ? `Keep the JSON compact: description under ${GENERATED_DESCRIPTION_MAX_CHARACTERS} characters, short_description under ${GENERATED_SHORT_DESCRIPTION_MAX_CHARACTERS} characters, and specifications_json up to ${GENERATED_SPECIFICATION_LIMIT} customer-relevant items.`
    : `Use only variant_id values present in native_product_json.variants.
Keep the JSON compact: description under ${GENERATED_DESCRIPTION_MAX_CHARACTERS} characters, short_description under ${GENERATED_SHORT_DESCRIPTION_MAX_CHARACTERS} characters, variant_titles_json up to ${GENERATED_VARIANT_TITLE_LIMIT} items, specifications_json up to ${GENERATED_SPECIFICATION_LIMIT} customer-relevant items, and seo_json.keywords up to ${GENERATED_SEO_KEYWORD_LIMIT} items.
If the product has many variants or the answer may exceed the token limit, omit variant_titles_json instead of truncating JSON.`

  return `You are a professional e-commerce content writer. ${modeDesc[mode] ?? modeDesc.full}
Target locale: ${locale}.
Tone: ${toneDesc}
Respond with a single JSON object containing only the fields you generated.
${fieldInstruction}
${compactInstruction}
Return valid JSON only, with no markdown or commentary.`
}

function buildTranslatePassSystemPrompt(
  locale: string,
  tone: string,
  pass: 'copy' | 'specifications',
  fields: TranslateField[] = [],
): string {
  const passInstruction = pass === 'copy'
    ? `Return only these translated fields when present in the input: ${fields.join(', ')}. Do not return specifications_json, variant_titles_json, bullets_json, or seo_json.`
    : 'Return only specifications_json. Keep the same item order. Preserve each specification key, unit, group, brand names, model numbers, and numeric measurements. Translate labels and natural-language values only.'

  return `You are translating product content to ${locale}.
Tone: ${tone}.
${passInstruction}
Return valid JSON only, with no markdown or commentary.`
}

function pickDefined(input: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(input).filter(([, value]) => value !== undefined && value !== null),
  )
}

function pickTranslateInput(source: Record<string, unknown>, fields: TranslateField[]) {
  const input = Object.fromEntries(fields.map((field) => [field, source[field]]))
  return pickDefined({ ...input, native_product_json: source.native_product_json })
}

function mergeGeneratedFields(
  target: Record<string, unknown>,
  source: Record<string, unknown>,
  keys: readonly string[],
): void {
  for (const key of keys) {
    if (key in source) {
      target[key] = source[key]
    }
  }
}

function progressStep(
  key: string,
  status: GenerationProgressStep['status'],
  generatedKeys: string[],
  errorMessage: string | null,
): GenerationProgressStep {
  return {
    key,
    status,
    generated_keys: generatedKeys,
    error_message: errorMessage,
    completed_at: new Date().toISOString(),
  }
}

function withGenerationProgress(
  generated: Record<string, unknown>,
  steps: GenerationProgressStep[],
): Record<string, unknown> {
  return {
    ...generated,
    generation_steps: steps,
  }
}

async function persistGenerationProgress(
  pim: PimModuleService,
  jobId: string,
  generated: Record<string, unknown>,
  steps: GenerationProgressStep[],
): Promise<void> {
  await pim.updateProductContentJobs({
    id: jobId,
    result_json: withGenerationProgress(generated, steps),
  })
}

function compactContentForScope(
  existing: Record<string, unknown> | null,
  contentScope: 'full' | 'copy_specs',
  mode: string,
): Record<string, unknown> | null {
  if (!existing) {
    return existing
  }

  const nativeProduct = isRecord(existing.native_product_json)
    ? existing.native_product_json
    : {}

  if (mode === 'seo') {
    return {
      title: existing.title ?? nativeProduct.title ?? null,
      short_description: existing.short_description ?? null,
      description: existing.description ?? nativeProduct.description ?? null,
      specifications_json: Array.isArray(existing.specifications_json)
        ? existing.specifications_json.slice(0, GENERATED_SPECIFICATION_LIMIT)
        : null,
      native_product_json: {
        title: nativeProduct.title ?? null,
        description: nativeProduct.description ?? null,
      },
    }
  }

  if (contentScope !== 'copy_specs') {
    return existing
  }

  return {
    title: existing.title ?? nativeProduct.title ?? null,
    short_description: existing.short_description ?? null,
    description: existing.description ?? nativeProduct.description ?? null,
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

function parseGeneratedContent(
  raw: string,
  logError: (message: string) => void,
  model: string,
): Record<string, unknown> | null {
  const direct = parseJsonRecord(raw.trim())
  if (direct) {
    return parseGeneratedRecord(direct, logError, model, raw)
  }

  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i)
  if (fenced?.[1]) {
    const parsed = parseJsonRecord(fenced[1].trim())
    if (parsed) {
      return parseGeneratedRecord(parsed, logError, model, raw)
    }
  }

  const embedded = findFirstJsonObject(raw)
  const parsed = embedded ? parseJsonRecord(embedded) : null
  return parsed ? parseGeneratedRecord(parsed, logError, model, raw) : null
}

function parseGeneratedRecord(
  value: Record<string, unknown>,
  logError: (message: string) => void,
  model: string,
  raw: string,
): Record<string, unknown> | null {
  try {
    return ProductContentFieldsSchema.parse(value)
  } catch (error) {
    logError(
      `[PIM] AI JSON failed content schema model=${model}: ${getErrorMessage(error)} preview=${raw.slice(0, AI_CONTENT_LOG_PREVIEW_LIMIT)}`,
    )
    return null
  }
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
    return `AI provider returned ${status} for model "${model}"`
  }
}
