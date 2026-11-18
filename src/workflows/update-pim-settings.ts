import {
  createStep,
  createWorkflow,
  StepResponse,
  WorkflowResponse,
} from '@medusajs/framework/workflows-sdk'
import {
  PIM_EDITABLE_KEYS,
  readStoredPimSettings,
  writeStoredPimSettings,
  clearPimSettingsCache,
  type PimEditableSettingsInput,
  type PimStoredSettings,
} from '../lib/pim-settings'

export const updatePimSettingsStep = createStep(
  'update-pim-settings',
  async (input: PimEditableSettingsInput, { container }) => {
    clearPimSettingsCache()
    const previous = await readStoredPimSettings(container)
    const next = await writeStoredPimSettings(container, input)
    return new StepResponse(next, { previous, keys: PIM_EDITABLE_KEYS.filter((key) => input[key] !== undefined) })
  },
  async (snapshot, { container }) => {
    if (!snapshot) return
    const restore: PimEditableSettingsInput = {}
    for (const key of snapshot.keys) restore[key] = (snapshot.previous as PimStoredSettings)[key] ?? null
    await writeStoredPimSettings(container, restore)
  },
)

export const updatePimSettingsWorkflow = createWorkflow(
  'update-pim-settings',
  (input: PimEditableSettingsInput) => {
    const settings = updatePimSettingsStep(input)
    return new WorkflowResponse(settings)
  },
)
