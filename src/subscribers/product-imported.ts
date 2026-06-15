import type { SubscriberArgs, SubscriberConfig } from '@medusajs/framework'
import {
  buildImportedProductContentInput,
  PIM_PRODUCT_IMPORTED_EVENT,
} from '../lib/imported-product-content'
import { createOrUpdateProductContentWorkflow } from '../workflows/create-or-update-product-content'

function eventProductId(data: Record<string, unknown>): string {
  return typeof data.product_id === 'string' && data.product_id ? data.product_id : 'unknown'
}

export default async function productImportedHandler({
  event: { data },
  container,
}: SubscriberArgs<Record<string, unknown>>) {
  const logger = container.resolve('logger')
  const productId = eventProductId(data)

  try {
    const input = buildImportedProductContentInput(data)
    await createOrUpdateProductContentWorkflow(container).run({ input })

    logger.info(`[PIM] Created imported product draft for product ${input.product_id}`)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    logger.error(`[PIM] Failed to ingest imported product for product ${productId}: ${message}`)
    throw error
  }
}

export const config: SubscriberConfig = {
  event: PIM_PRODUCT_IMPORTED_EVENT,
}
