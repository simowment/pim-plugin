import { createWorkflow, WorkflowResponse } from '@medusajs/framework/workflows-sdk'
import {
  deleteMetadataFieldStep,
  type DeleteMetadataFieldInput,
} from './steps/delete-metadata-field'

export type { DeleteMetadataFieldInput }

export const deleteMetadataFieldWorkflow = createWorkflow(
  'delete-metadata-field',
  function (input: DeleteMetadataFieldInput) {
    const result = deleteMetadataFieldStep(input)

    return new WorkflowResponse(result)
  },
)
