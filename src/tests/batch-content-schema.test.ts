import { afterEach, describe, expect, it, vi } from 'vitest'
import { BATCH_CONTENT_PRODUCT_LIMIT, BatchContentSchema } from '../api/middlewares'
import { POST } from '../api/store/pim/content/batch/route'

const RECORDS_PER_CHANNEL_LIMIT = 2

describe('BatchContentSchema', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('caps product_ids to prevent unbounded store batch requests', () => {
    const product_ids = Array.from(
      { length: BATCH_CONTENT_PRODUCT_LIMIT + 1 },
      (_, index) => `prod_${index}`,
    )

    const result = BatchContentSchema.safeParse({
      product_ids,
      locale: 'en-US',
    })

    expect(result.success).toBe(false)
  })

  it('queries batch content by exact locale and candidate channels', async () => {
    vi.stubEnv('PIM_DEFAULT_CHANNEL', 'web')

    const records = [
      {
        id: 'cnt_1',
        product_id: 'prod_1',
        locale: 'fr-FR',
        channel: 'mobile',
        status: 'published',
        title: 'French mobile',
      },
    ]
    const listAndCountProductContents = vi.fn().mockResolvedValue([records, records.length])
    const listProductMetadataFields = vi.fn().mockResolvedValue([])
    const response = {
      json: vi.fn(),
    }
    const request = {
      headers: {},
      validatedBody: {
        product_ids: ['prod_1'],
        locale: 'fr-FR',
        channel: 'mobile',
      },
      scope: {
        resolve: vi.fn().mockReturnValue({
          listAndCountProductContents,
          listProductMetadataFields,
        }),
      },
    }
    const expectedChannels = ['mobile', 'web', 'storefront', 'default', 'google', 'meta']

    await POST(request as never, response as never)

    expect(listAndCountProductContents).toHaveBeenCalledWith(
      {
        product_id: 'prod_1',
        locale: 'fr-FR',
        channel: expectedChannels,
        status: 'published',
      },
      {
        take: expectedChannels.length * RECORDS_PER_CHANNEL_LIMIT,
        order: { published_at: 'DESC' },
      },
    )
    expect(response.json).toHaveBeenCalledWith({
      contents: [expect.objectContaining({ product_id: 'prod_1', source: 'pim' })],
    })
  })
})
