import { createWorkflow, WorkflowResponse } from '@medusajs/framework/workflows-sdk'
import {
  bootstrapMetadataFieldStep,
  type BootstrapMetadataFieldInput,
} from './steps/bootstrap-metadata-field'

export type { BootstrapMetadataFieldInput }

export const bootstrapMetadataFieldWorkflow = createWorkflow(
  'bootstrap-metadata-field',
  function (input: BootstrapMetadataFieldInput) {
    const field = bootstrapMetadataFieldStep(input)

    return new WorkflowResponse(field)
  },
)
