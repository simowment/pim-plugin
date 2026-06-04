import { createWorkflow, WorkflowResponse } from '@medusajs/framework/workflows-sdk'
import { syncProductMetadataStep, type SyncMetadataInput } from './steps/sync-product-metadata'

export const syncProductMetadataWorkflow = createWorkflow(
  'sync-product-metadata',
  function (input: SyncMetadataInput) {
    const result = syncProductMetadataStep(input)
    return new WorkflowResponse(result)
  },
)
