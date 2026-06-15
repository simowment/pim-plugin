import { createStep, StepResponse } from '@medusajs/framework/workflows-sdk'
import { MedusaError } from '@medusajs/framework/utils'
import { PIM_MODULE } from '../../modules/pim'
import type PimModuleService from '../../modules/pim/service'
import type { ProductContentStatus } from '../../modules/pim/models/product-content'

export interface ArchiveProductContentInput {
  id: string
  actor_id?: string | null
}

const ARCHIVED_STATUS: ProductContentStatus = 'archived'

export const archiveProductContentStep = createStep(
  'archive-product-content',
  async (input: ArchiveProductContentInput, { container }) => {
    const pim = container.resolve<PimModuleService>(PIM_MODULE)
    const content = await pim.retrieveProductContent(input.id)

    if (content.status === 'published') {
      throw new MedusaError(
        MedusaError.Types.NOT_ALLOWED,
        'Cannot archive a published content record. Unpublish or replace it first.',
      )
    }

    await pim.updateProductContents({
      id: input.id,
      status: ARCHIVED_STATUS,
      updated_by: input.actor_id ?? null,
    })

    return new StepResponse(
      { id: input.id, archived: true, deleted: true },
      {
        id: input.id,
        previous_status: content.status,
        previous_updated_by: content.updated_by ?? null,
      },
    )
  },
  async (previous, { container }) => {
    if (!previous) return

    const pim = container.resolve<PimModuleService>(PIM_MODULE)
    await pim.updateProductContents({
      id: previous.id,
      status: previous.previous_status as ProductContentStatus,
      updated_by: previous.previous_updated_by,
    })
  },
)
