import { createWorkflow, WorkflowResponse } from '@medusajs/framework/workflows-sdk'
import {
  updateMetadataFieldStep,
  type UpdateMetadataFieldInput,
} from './steps/update-metadata-field'

export type { UpdateMetadataFieldInput }

export const updateMetadataFieldWorkflow = createWorkflow(
  'update-metadata-field',
  function (input: UpdateMetadataFieldInput) {
    const field = updateMetadataFieldStep(input)

    return new WorkflowResponse(field)
  },
)
