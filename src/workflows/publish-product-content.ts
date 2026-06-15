import {
  createWorkflow,
  type ReturnWorkflow,
  transform,
  WorkflowResponse,
} from '@medusajs/framework/workflows-sdk'
import { publishProductContentStep } from './steps/publish-product-content'
import { appendContentVersionStep } from './steps/create-or-update-product-content'
import { getRecordId } from '../lib/records'

export interface PublishProductContentInput {
  content_id: string
  archive_previous?: boolean
  actor_id?: string | null
}

type PublishProductContentWorkflowOutput = {
  content: unknown
  version: unknown
}

export const publishProductContentWorkflow: ReturnWorkflow<
  PublishProductContentInput,
  PublishProductContentWorkflowOutput,
  []
> = createWorkflow(
  'publish-product-content',
  function (input: PublishProductContentInput) {
    const published = publishProductContentStep(input)

    const versionInput = transform({ published, input }, ({ published, input }) => ({
      content_id: getRecordId(published, 'Published PIM content'),
      snapshot: published as Record<string, unknown>,
      actor_type: 'admin' as const,
      actor_id: input.actor_id ?? null,
      change_reason: 'Published',
    }))

    const version = appendContentVersionStep(versionInput)

    return new WorkflowResponse({ content: published, version })
  },
)
