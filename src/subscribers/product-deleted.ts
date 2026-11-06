import type { SubscriberArgs, SubscriberConfig } from '@medusajs/framework'
import { PIM_MODULE } from '../modules/pim'
import type PimModuleService from '../modules/pim/service'
import { archiveProductContentWorkflow } from '../workflows/archive-product-content'

const PAGE_SIZE = 200

/**
 * A deleted product leaves no PIM content behind: every non-archived record is
 * archived (published ones also drop the translations their publish mirrored),
 * and AI jobs still marked running for it are closed as failed. Records are
 * kept as archived history rather than hard-deleted, matching the Unpublish
 * button.
 */
export default async function productDeletedHandler({
  event: { data },
  container,
}: SubscriberArgs<{ id: string }>) {
  const logger = container.resolve('logger')
  const productId = typeof data?.id === 'string' ? data.id : ''
  if (!productId) return

  const pim = container.resolve<PimModuleService>(PIM_MODULE)

  let archived = 0
  let failed = 0
  try {
    const contents = await pim.listProductContents(
      { product_id: productId, status: ['draft', 'reviewed', 'published'] },
      { select: ['id'], take: PAGE_SIZE },
    )
    for (const content of contents) {
      try {
        await archiveProductContentWorkflow(container).run({
          input: { id: content.id, actor_id: null },
        })
        archived += 1
      } catch (error) {
        failed += 1
        const message = error instanceof Error ? error.message : String(error)
        logger.error(`[PIM] Could not archive content ${content.id} of deleted product ${productId}: ${message}`)
      }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    logger.error(`[PIM] Could not list content of deleted product ${productId}: ${message}`)
  }

  let closedJobs = 0
  try {
    const jobs = await pim.listProductContentJobs(
      { product_id: productId, status: 'running' },
      { select: ['id'], take: PAGE_SIZE },
    )
    if (jobs.length > 0) {
      const now = new Date()
      await pim.updateProductContentJobs(
        jobs.map((job) => ({
          id: job.id,
          status: 'failed' as const,
          error_message: 'Product was deleted',
          completed_at: now,
        })),
      )
      closedJobs = jobs.length
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    logger.error(`[PIM] Could not close AI jobs of deleted product ${productId}: ${message}`)
  }

  if (archived || failed || closedJobs) {
    logger.info(
      `[PIM] Product ${productId} deleted: archived ${archived} content record(s)` +
        (failed ? `, ${failed} failed` : '') +
        `, closed ${closedJobs} running AI job(s)`,
    )
  }
}

export const config: SubscriberConfig = {
  event: 'product.deleted',
}
