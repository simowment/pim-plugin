import { createWorkflow, WorkflowResponse } from '@medusajs/framework/workflows-sdk'
import {
  deleteProductContentStep,
  type DeleteProductContentInput,
} from './steps/delete-product-content'

export type { DeleteProductContentInput }

export const deleteProductContentWorkflow = createWorkflow(
  'delete-product-content',
  function (input: DeleteProductContentInput) {
    const result = deleteProductContentStep(input)

    return new WorkflowResponse(result)
  },
)
