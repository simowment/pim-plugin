import { createWorkflow, WorkflowResponse } from '@medusajs/framework/workflows-sdk'
import {
  createMetadataFieldStep,
  type CreateMetadataFieldInput,
} from './steps/create-metadata-field'

export type { CreateMetadataFieldInput }

export const createMetadataFieldWorkflow = createWorkflow(
  'create-metadata-field',
  function (input: CreateMetadataFieldInput) {
    const field = createMetadataFieldStep(input)

    return new WorkflowResponse(field)
  },
)
