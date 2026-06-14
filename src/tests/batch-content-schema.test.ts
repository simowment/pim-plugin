import { describe, expect, it } from 'vitest'
import { BATCH_CONTENT_PRODUCT_LIMIT, BatchContentSchema } from '../api/middlewares'

describe('BatchContentSchema', () => {
  it('caps product_ids to prevent unbounded store batch requests', () => {
    const product_ids = Array.from(
      { length: BATCH_CONTENT_PRODUCT_LIMIT + 1 },
      (_, index) => `prod_${index}`,
    )

    const result = BatchContentSchema.safeParse({
      product_ids,
      locale: 'en',
    })

    expect(result.success).toBe(false)
  })
})
