import { z } from '@medusajs/framework/zod'
import { MedusaError } from '@medusajs/framework/utils'
import { KILO_BASE_URL } from './ai-config'
import { getErrorMessage, truncateErrorMessage } from './error-messages'

const KILO_MODELS_PATH = '/models'
const KILO_MODELS_REQUEST_TIMEOUT_MS = 10000
const KILO_MODELS_RESPONSE_PREVIEW_LENGTH = 500
const JSON_CONTENT_TYPE = 'application/json'
const RESPONSE_FORMAT_PARAMETER = 'response_format'

const KiloModelSchema = z.object({
  id: z.string().min(1),
  name: z.string().nullable().optional(),
  owned_by: z.string().nullable().optional(),
  context_length: z.number().int().positive().nullable().optional(),
  supported_parameters: z.array(z.string()).nullable().optional(),
})

const KiloModelsResponseSchema = z.object({
  data: z.array(KiloModelSchema),
})

export interface PimAiModelOption {
  id: string
  name: string | null
  owned_by: string | null
  context_length: number | null
  supports_response_format: boolean
}

function trimTrailingSlashes(value: string): string {
  return value.replace(/\/+$/, '')
}

function buildKiloModelsUrl(baseUrl: string): string {
  return `${trimTrailingSlashes(baseUrl)}${KILO_MODELS_PATH}`
}

function providerFailureMessage(status: number, body: string): string {
  try {
    const parsed = JSON.parse(body) as unknown
    return `Kilo models endpoint returned ${status}: ${getErrorMessage(parsed)}`
  } catch {
    return `Kilo models endpoint returned ${status}: ${truncateErrorMessage(
      body,
      KILO_MODELS_RESPONSE_PREVIEW_LENGTH,
    )}`
  }
}

export async function listKiloModels(input: { baseUrl?: string } = {}): Promise<PimAiModelOption[]> {
  const trimmedBaseUrl = input.baseUrl?.trim()
  const baseUrl = trimmedBaseUrl ? trimmedBaseUrl : KILO_BASE_URL
  const abortController = new AbortController()
  const timeout = setTimeout(() => abortController.abort(), KILO_MODELS_REQUEST_TIMEOUT_MS)
  let response: Response

  try {
    response = await fetch(buildKiloModelsUrl(baseUrl), {
      headers: { Accept: JSON_CONTENT_TYPE },
      signal: abortController.signal,
    })
  } catch (error) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      `Unable to fetch Kilo models: ${getErrorMessage(error)}`,
    )
  } finally {
    clearTimeout(timeout)
  }

  const responseBody = await response.text()
  if (!response.ok) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      providerFailureMessage(response.status, responseBody),
    )
  }

  let parsedBody: unknown
  try {
    parsedBody = JSON.parse(responseBody)
  } catch {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      'Kilo models endpoint returned invalid JSON.',
    )
  }

  const parsedModels = KiloModelsResponseSchema.safeParse(parsedBody)
  if (!parsedModels.success) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      'Kilo models endpoint returned an unexpected response shape.',
    )
  }

  return parsedModels.data.data.map((model): PimAiModelOption => ({
    id: model.id,
    name: model.name ?? null,
    owned_by: model.owned_by ?? null,
    context_length: model.context_length ?? null,
    supports_response_format: model.supported_parameters?.includes(RESPONSE_FORMAT_PARAMETER) ?? false,
  }))
}

export async function getKiloModelOption(input: {
  baseUrl?: string
  model: string
}): Promise<PimAiModelOption | null> {
  const models = await listKiloModels({ baseUrl: input.baseUrl })

  return models.find((model) => model.id === input.model) ?? null
}
