import {
  createStep,
  createWorkflow,
  StepResponse,
  WorkflowResponse,
} from '@medusajs/framework/workflows-sdk'
import {
  getPimAiProviderConfigSnapshot,
  updatePimAiProviderConfig,
  type PimAiSettingsResponse,
} from '../lib/ai-config'

export interface UpdatePimAiSettingsInput {
  provider?: string
  api_key?: string
  base_url?: string
  model?: string
}

export const updatePimAiSettingsStep = createStep(
  'update-pim-ai-settings',
  async (input: UpdatePimAiSettingsInput, { container }) => {
    const previousSettings = await getPimAiProviderConfigSnapshot(container, {
      includeApiKey: typeof input.api_key !== 'string',
    })
    const settings = await updatePimAiProviderConfig(container, input)

    return new StepResponse(settings, previousSettings)
  },
  async (previousSettings, { container }) => {
    if (!previousSettings) return

    await updatePimAiProviderConfig(container, {
      provider: previousSettings.provider,
      api_key: previousSettings.api_key,
      base_url: previousSettings.base_url,
      model: previousSettings.model,
      headers: previousSettings.headers,
    })
  },
)

export const updatePimAiSettingsWorkflow = createWorkflow(
  'update-pim-ai-settings',
  function (input: UpdatePimAiSettingsInput) {
    const settings = updatePimAiSettingsStep(input)

    return new WorkflowResponse<PimAiSettingsResponse>(settings)
  },
)
