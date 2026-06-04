import { createWorkflow, transform, WorkflowResponse } from '@medusajs/framework/workflows-sdk'
import {
  createOrUpdateProductContentStep,
  appendContentVersionStep,
  type CreateOrUpdateContentInput,
} from './steps/create-or-update-product-content'

export type CreateOrUpdateProductContentInput = CreateOrUpdateContentInput

export const createOrUpdateProductContentWorkflow: any = createWorkflow(
  'create-or-update-product-content',
  function (input: CreateOrUpdateProductContentInput) {
    const result = createOrUpdateProductContentStep(input)

    const versionInput = transform({ result, input }, ({ result, input }) => ({
      content_id: (result.content as any).id as string,
      snapshot: result.content as Record<string, unknown>,
      actor_type: 'admin' as const,
      actor_id: input.updated_by ?? input.created_by ?? null,
      change_reason: input.change_reason,
    }))

    const version = appendContentVersionStep(versionInput)

    return new WorkflowResponse({ content: result.content, version })
  },
)
