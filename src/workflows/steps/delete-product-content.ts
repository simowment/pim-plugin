import { createStep, StepResponse } from '@medusajs/framework/workflows-sdk'
import { MedusaError } from '@medusajs/framework/utils'
import { PIM_MODULE } from '../../modules/pim'
import type PimModuleService from '../../modules/pim/service'
import type { ProductContentStatus } from '../../modules/pim/models/product-content'

export interface DeleteProductContentInput {
  id: string
  actor_id?: string | null
}

const PUBLISHED_STATUS: ProductContentStatus = 'published'
const ARCHIVED_STATUS: ProductContentStatus = 'archived'

export const deleteProductContentStep = createStep(
  'delete-product-content',
  async (input: DeleteProductContentInput, { container }) => {
    const pim = container.resolve<PimModuleService>(PIM_MODULE)
    const content = await pim.retrieveProductContent(input.id)

    if (content.status === PUBLISHED_STATUS) {
      throw new MedusaError(
        MedusaError.Types.UNEXPECTED_STATE,
        'Published PIM content cannot be deleted. Archive or replace it by publishing another draft first.',
      )
    }

    if (content.status === ARCHIVED_STATUS) {
      return new StepResponse(
        { id: input.id, archived: true },
        null,
      )
    }

    await pim.updateProductContents({
      id: input.id,
      status: ARCHIVED_STATUS,
      updated_by: input.actor_id ?? null,
    })

    return new StepResponse(
      { id: input.id, archived: true },
      {
        id: input.id,
        status: content.status as ProductContentStatus,
        published_at: content.published_at ?? null,
        updated_by: content.updated_by ?? null,
      },
    )
  },
  async (previous, { container }) => {
    if (!previous) return

    const pim = container.resolve<PimModuleService>(PIM_MODULE)
    await pim.updateProductContents(previous)
  },
)
