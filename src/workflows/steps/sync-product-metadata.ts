import { createStep, StepResponse } from '@medusajs/framework/workflows-sdk'
import { MedusaError } from '@medusajs/framework/utils'
import { updateProductsWorkflow } from '@medusajs/medusa/core-flows'
import { PIM_MODULE } from '../../modules/pim'
import type PimModuleService from '../../modules/pim/service'
import type {
  ProductMetadataFieldScope,
  ProductMetadataFieldType,
} from '../../modules/pim/models/product-metadata-field'
import { assertCanonicalPimLocale } from '../../lib/locales'
import { resolveDefaultPimChannel } from '../../lib/channels'
import { PIM_MUTABLE_STATUSES, resolveBestPimContentRecord } from '../../lib/specifications'

export interface SyncMetadataInput {
  product_id: string
  scope: Extract<ProductMetadataFieldScope, 'product' | 'content'>
  locale?: string
  channel?: string
  metadata: Record<string, unknown>
  allow_unknown_keys?: boolean
}

type MetadataFieldRecord = {
  key: string
  type: ProductMetadataFieldType
}

type ContentMetadataRecord = {
  id: string
  custom_metadata_json?: Record<string, unknown> | null
}

type ProductMetadataRecord = {
  id: string
  metadata?: Record<string, unknown> | null
}

type QueryService = {
  graph: (
    query: {
      entity: string
      fields: string[]
      filters: Record<string, unknown>
    },
    options?: Record<string, unknown>,
  ) => Promise<{ data: ProductMetadataRecord[] }>
}

type SyncMetadataCompensation =
  | {
      scope: 'content'
      content_id: string
      previousMetadata: Record<string, unknown>
    }
  | {
      scope: 'product'
      product_id: string
      previousMetadata: Record<string, unknown>
    }

export const syncProductMetadataStep = createStep<
  SyncMetadataInput,
  Record<string, unknown>,
  SyncMetadataCompensation
>(
  'sync-product-metadata',
  async (input: SyncMetadataInput, { container }) => {
    const pim = container.resolve<PimModuleService>(PIM_MODULE)

    const fieldDefs = (await pim.listProductMetadataFields({
      scope: input.scope,
    })) as MetadataFieldRecord[]

    const allowedKeys = new Set(fieldDefs.map((field) => field.key))
    const unknownKeys = Object.keys(input.metadata).filter((key) => !allowedKeys.has(key))

    if (unknownKeys.length > 0 && !input.allow_unknown_keys) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        `Unknown metadata keys: ${unknownKeys.join(', ')}. Define them in ProductMetadataField first, or pass allow_unknown_keys=true.`,
      )
    }

    for (const field of fieldDefs) {
      const value = input.metadata[field.key]
      if (value === undefined) continue
      validateFieldValue(field.key, field.type, value)
    }

    if (input.scope === 'content') {
      const locale = assertCanonicalPimLocale(input.locale, 'locale')
      const defaultChannel = resolveDefaultPimChannel()
      const channel = input.channel ?? defaultChannel
      const [records] = await pim.listAndCountProductContents(
        {
          product_id: input.product_id,
          status: [...PIM_MUTABLE_STATUSES],
        },
        { take: 100, order: { updated_at: 'DESC' } },
      )
      const existing = resolveBestPimContentRecord(records as Array<Record<string, unknown>>, {
        locale,
        channel,
        defaultChannel,
        statuses: PIM_MUTABLE_STATUSES,
      }) as ContentMetadataRecord | null

      if (!existing) {
        throw new MedusaError(
          MedusaError.Types.NOT_FOUND,
          `No active draft found for product ${input.product_id} locale=${locale} channel=${channel}`,
        )
      }

      const previousMetadata = existing.custom_metadata_json ?? {}
      const merged = {
        ...previousMetadata,
        ...input.metadata,
      }

      const updated = await pim.updateProductContents({
        id: existing.id,
        custom_metadata_json: merged,
      })

      return new StepResponse(updated as unknown as Record<string, unknown>, {
        scope: 'content',
        content_id: existing.id,
        previousMetadata,
      } satisfies SyncMetadataCompensation)
    }

    const query = container.resolve<QueryService>('query')
    const { data: products } = await query.graph({
      entity: 'product',
      fields: ['id', 'metadata'],
      filters: { id: input.product_id },
    })
    const product = products[0]

    if (!product) {
      throw new MedusaError(
        MedusaError.Types.NOT_FOUND,
        `Product ${input.product_id} not found`,
      )
    }

    const previousMetadata = product.metadata ?? {}
    const metadata = {
      ...previousMetadata,
      ...input.metadata,
    }

    await updateProductsWorkflow(container).run({
      input: {
        products: [
          {
            id: input.product_id,
            metadata,
          },
        ],
      },
    })

    return new StepResponse(
      { product_id: input.product_id, metadata } as Record<string, unknown>,
      {
        scope: 'product',
        product_id: input.product_id,
        previousMetadata,
      } satisfies SyncMetadataCompensation,
    )
  },
  async (previous, { container }) => {
    if (!previous) return

    if (previous.scope === 'content') {
      const pim = container.resolve<PimModuleService>(PIM_MODULE)
      await pim.updateProductContents({
        id: previous.content_id,
        custom_metadata_json: previous.previousMetadata,
      })
      return
    }

    await updateProductsWorkflow(container).run({
      input: {
        products: [
          {
            id: previous.product_id,
            metadata: previous.previousMetadata,
          },
        ],
      },
    })
  },
)

function validateFieldValue(key: string, type: string, value: unknown): void {
  if (value === null) {
    return
  }

  if (type === 'number' && typeof value !== 'number') {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      `Metadata field "${key}" must be a number`,
    )
  }
  if (type === 'boolean' && typeof value !== 'boolean') {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      `Metadata field "${key}" must be a boolean`,
    )
  }
  if (
    (type === 'string' || type === 'text' || type === 'url' || type === 'select') &&
    typeof value !== 'string'
  ) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      `Metadata field "${key}" must be a string`,
    )
  }
  if (
    type === 'multiselect' &&
    (!Array.isArray(value) || value.some((item) => typeof item !== 'string'))
  ) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      `Metadata field "${key}" must be an array of strings`,
    )
  }
}
