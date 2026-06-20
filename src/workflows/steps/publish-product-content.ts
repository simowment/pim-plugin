import { createStep, StepResponse } from '@medusajs/framework/workflows-sdk'
import { MedusaError } from '@medusajs/framework/utils'
import { PIM_MODULE } from '../../modules/pim'
import type PimModuleService from '../../modules/pim/service'
import type { ProductContentStatus } from '../../modules/pim/models/product-content'

const PUBLISHABLE_STATUSES: ProductContentStatus[] = ['draft', 'ai_generated', 'reviewed']
const PUBLISHED_STATUS: ProductContentStatus = 'published'
const ARCHIVED_STATUS: ProductContentStatus = 'archived'

type PublishedContentRecord = {
  id: string
}

export interface PublishContentInput {
  content_id: string
  product_id?: string
  archive_previous?: boolean
  actor_id?: string | null
}

export const publishProductContentStep = createStep(
  'publish-product-content',
  async (input: PublishContentInput, { container }) => {
    const pim = container.resolve<PimModuleService>(PIM_MODULE)
    const content = await pim.retrieveProductContent(input.content_id)

    if (input.product_id && content.product_id !== input.product_id) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        `PIM content ${input.content_id} does not belong to product ${input.product_id}.`,
      )
    }

    if (!PUBLISHABLE_STATUSES.includes(content.status as ProductContentStatus)) {
      throw new MedusaError(
        MedusaError.Types.UNEXPECTED_STATE,
        `Cannot publish content with status "${content.status}". Must be one of: ${PUBLISHABLE_STATUSES.join(', ')}`,
      )
    }

    const previousPublished: string[] = []
    let currentWasPublished = false

    try {
      if (input.archive_previous !== false) {
        const [published] = await pim.listAndCountProductContents(
          {
            product_id: content.product_id,
            locale: content.locale,
            channel: content.channel,
            status: [PUBLISHED_STATUS],
          },
          {},
        )

        for (const prev of published as PublishedContentRecord[]) {
          if (prev.id !== input.content_id) {
            await pim.updateProductContents({
              id: prev.id,
              status: ARCHIVED_STATUS,
            })
            previousPublished.push(prev.id)
          }
        }
      }

      const updated = await pim.updateProductContents({
        id: input.content_id,
        status: PUBLISHED_STATUS,
        published_at: new Date(),
        updated_by: input.actor_id ?? null,
      })
      currentWasPublished = true

      return new StepResponse(updated, {
        content_id: input.content_id,
        previous_status: content.status,
        previously_published: previousPublished,
      })
    } catch (error) {
      await Promise.all(
        previousPublished.map((prevId) =>
          pim.updateProductContents({
            id: prevId,
            status: PUBLISHED_STATUS,
          }),
        ),
      )

      if (currentWasPublished) {
        await pim.updateProductContents({
          id: input.content_id,
          status: content.status as ProductContentStatus,
          published_at: null,
          updated_by: content.updated_by ?? null,
        })
      }

      throw error
    }
  },
  async (compensationData, { container }) => {
    if (!compensationData) return
    const pim = container.resolve<PimModuleService>(PIM_MODULE)

    await pim.updateProductContents({
      id: compensationData.content_id,
      status: compensationData.previous_status as ProductContentStatus,
      published_at: null,
    })

    await Promise.all(
      compensationData.previously_published.map((prevId) =>
        pim.updateProductContents({
          id: prevId,
          status: PUBLISHED_STATUS,
        }),
      ),
    )
  },
)
