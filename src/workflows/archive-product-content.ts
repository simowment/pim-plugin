import { createWorkflow, WorkflowResponse } from '@medusajs/framework/workflows-sdk'
import {
  archiveProductContentStep,
  type ArchiveProductContentInput,
} from './steps/archive-product-content'

export type { ArchiveProductContentInput }

export const archiveProductContentWorkflow = createWorkflow(
  'archive-product-content',
  function (input: ArchiveProductContentInput) {
    const result = archiveProductContentStep(input)

    return new WorkflowResponse(result)
  },
)
