import {
  createWorkflow,
  type ReturnWorkflow,
  transform,
  WorkflowResponse,
} from '@medusajs/framework/workflows-sdk'
import {
  createOrUpdateProductContentStep,
  appendContentVersionStep,
  type CreateOrUpdateContentInput,
} from './steps/create-or-update-product-content'
import { getRecordId } from '../lib/records'

type CreateOrUpdateProductContentWorkflowOutput = {
  content: unknown
  version: unknown
}

export const createOrUpdateProductContentWorkflow: ReturnWorkflow<
  CreateOrUpdateContentInput,
  CreateOrUpdateProductContentWorkflowOutput,
  []
> = createWorkflow(
  'create-or-update-product-content',
  function (input: CreateOrUpdateContentInput) {
    const result = createOrUpdateProductContentStep(input)

    const versionInput = transform({ result, input }, ({ result, input }) => ({
      content_id: getRecordId(result.content, 'PIM content'),
      snapshot: result.content as Record<string, unknown>,
      actor_type: 'admin' as const,
      actor_id: input.updated_by ?? input.created_by ?? null,
      change_reason: input.change_reason,
    }))

    const version = appendContentVersionStep(versionInput)

    return new WorkflowResponse({ content: result.content, version })
  },
)
