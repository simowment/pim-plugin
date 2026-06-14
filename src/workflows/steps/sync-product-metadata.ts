import { createStep, StepResponse } from '@medusajs/framework/workflows-sdk'
import { MedusaError } from '@medusajs/framework/utils'
import { PIM_MODULE } from '../../modules/pim'
import type PimModuleService from '../../modules/pim/service'

export interface SyncMetadataInput {
  product_id: string
  scope: 'product' | 'content'
  locale?: string
  channel?: string
  metadata: Record<string, unknown>
  allow_unknown_keys?: boolean
}

export const syncProductMetadataStep = createStep(
  'sync-product-metadata',
  async (input: SyncMetadataInput, { container }) => {
    const pim = container.resolve<PimModuleService>(PIM_MODULE)

    // Load field definitions for validation
    const fieldDefs = await pim.listProductMetadataFields({ scope: input.scope as any }, {})

    const allowedKeys = new Set(fieldDefs.map((f: any) => f.key as string))
    const unknownKeys = Object.keys(input.metadata).filter((k) => !allowedKeys.has(k))

    if (unknownKeys.length > 0 && !input.allow_unknown_keys) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        `Unknown metadata keys: ${unknownKeys.join(', ')}. Define them in ProductMetadataField first, or pass allow_unknown_keys=true.`,
      )
    }

    // Validate field types for known keys
    for (const field of fieldDefs as any[]) {
      const value = input.metadata[field.key]
      if (value === undefined) continue
      validateFieldValue(field.key, field.type, value)
    }

    // For content scope: find and update the draft content record
    if (input.scope === 'content') {
      const [records] = await pim.listAndCountProductContents(
        {
          product_id: input.product_id,
          locale: input.locale ?? 'en',
          channel: input.channel ?? 'storefront',
          status: ['draft', 'ai_generated', 'reviewed'] as any,
        },
        { take: 1 },
      )

      if (records.length === 0) {
        throw new MedusaError(
          MedusaError.Types.NOT_FOUND,
          `No active draft found for product ${input.product_id} locale=${input.locale} channel=${input.channel}`,
        )
      }

      const existing = records[0] as any
      const merged = {
        ...(existing.custom_metadata_json ?? {}),
        ...input.metadata,
      }

      const updated = await pim.updateProductContents({
        id: existing.id,
        custom_metadata_json: merged,
      })

      return new StepResponse(updated as unknown as Record<string, unknown>)
    }

    // For product scope: not stored in PIM — return the validated metadata for caller
    return new StepResponse({ product_id: input.product_id, metadata: input.metadata } as Record<
      string,
      unknown
    >)
  },
)

function validateFieldValue(key: string, type: string, value: unknown): void {
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
  if ((type === 'string' || type === 'text' || type === 'url') && typeof value !== 'string') {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      `Metadata field "${key}" must be a string`,
    )
  }
}
