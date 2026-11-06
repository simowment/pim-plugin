import {
  createWorkflow,
  type ReturnWorkflow,
  transform,
  when,
  WorkflowResponse,
} from '@medusajs/framework/workflows-sdk'
import {
  archiveProductContentStep,
  removeNativeTranslationsStep,
  type ArchiveProductContentInput,
} from './steps/archive-product-content'
import { appendContentVersionStep } from './steps/create-or-update-product-content'

export type { ArchiveProductContentInput }

type ArchiveProductContentWorkflowOutput = {
  content: Record<string, unknown>
  was_published: boolean
  already_archived: boolean
  removed_translations: number
}

/**
 * Unpublish / archive one PIM record. When the record was published, the
 * translations its publish mirrored into the Medusa Translation module are
 * removed too, so the storefront falls back to the product's own text.
 */
export const archiveProductContentWorkflow: ReturnWorkflow<
  ArchiveProductContentInput,
  ArchiveProductContentWorkflowOutput,
  []
> = createWorkflow('archive-product-content', function (input: ArchiveProductContentInput) {
  const archived = archiveProductContentStep(input)
  const removeInput = transform({ archived }, ({ archived }) => ({
    content: archived.content,
    was_published: archived.was_published,
  }))
  const removed = removeNativeTranslationsStep(removeInput)

  const versionInput = transform({ archived, input }, ({ archived, input }) => ({
    content_id: input.id,
    snapshot: archived.content,
    actor_type: 'admin' as const,
    actor_id: input.actor_id ?? null,
    change_reason: archived.was_published ? 'Unpublished' : 'Archived',
  }))
  when({ archived }, ({ archived }) => !archived.already_archived).then(() => {
    appendContentVersionStep(versionInput)
  })

  const result = transform({ archived, removed }, ({ archived, removed }) => ({
    content: archived.content,
    was_published: archived.was_published,
    already_archived: archived.already_archived,
    removed_translations: removed.removed,
  }))

  return new WorkflowResponse(result)
})
