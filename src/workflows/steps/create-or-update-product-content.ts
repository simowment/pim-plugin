import { createStep, StepResponse } from '@medusajs/framework/workflows-sdk'
import { PIM_MODULE } from '../../modules/pim'
import type PimModuleService from '../../modules/pim/service'
import { PIM_MUTABLE_STATUSES, resolveBestPimContentRecord } from '../../lib/specifications'
import { assertCanonicalPimLocale } from '../../lib/locales'
import { resolveDefaultPimChannel } from '../../lib/channels'
import { getRecordId, type IdentifiableRecord } from '../../lib/records'
import type {
  ProductContentSource,
  ProductContentStatus,
} from '../../modules/pim/models/product-content'
import type { ProductContentVersionActorType } from '../../modules/pim/models/product-content-version'

const DRAFT_STATUS: ProductContentStatus = 'draft'

export interface CreateOrUpdateContentInput {
  product_id: string
  locale: string
  channel?: string
  title?: string | null
  description?: string | null
  short_description?: string | null
  variant_titles_json?: unknown[] | null
  bullets_json?: unknown[] | null
  specifications_json?: unknown[] | null
  seo_json?: Record<string, unknown> | null
  custom_metadata_json?: Record<string, unknown> | null
  raw_source_json?: Record<string, unknown> | null
  source?: ProductContentSource
  status?: ProductContentStatus
  created_by?: string | null
  updated_by?: string | null
  change_reason?: string
}

export interface CreateOrUpdateContentOutput {
  content: Record<string, unknown>
  is_new: boolean
  previous_snapshot: Record<string, unknown> | null
}

type ProductContentRecord = IdentifiableRecord & {
  custom_metadata_json?: Record<string, unknown> | null
}

export const createOrUpdateProductContentStep = createStep(
  'create-or-update-product-content',
  async (input: CreateOrUpdateContentInput, { container }) => {
    const pim = container.resolve<PimModuleService>(PIM_MODULE)

    const defaultChannel = resolveDefaultPimChannel()
    const channel = input.channel ?? defaultChannel
    const locale = assertCanonicalPimLocale(input.locale, 'locale')

    // Find the existing mutable draft for this product/locale/channel.
    const [existingRecords] = await pim.listAndCountProductContents(
      {
        product_id: input.product_id,
        channel,
        status: [...PIM_MUTABLE_STATUSES] as ProductContentStatus[],
      },
      { take: 100, order: { updated_at: 'DESC' } },
    )

    const existing =
      (resolveBestPimContentRecord(existingRecords as unknown as Array<Record<string, unknown>>, {
        locale,
        channel,
        defaultChannel,
        statuses: PIM_MUTABLE_STATUSES,
      }) as ProductContentRecord | null) ?? null
    const previousSnapshot: Record<string, unknown> | null = existing ? { ...existing } : null

    const contentData = {
      product_id: input.product_id,
      locale,
      channel,
      title: input.title ?? null,
      description: input.description ?? null,
      short_description: input.short_description ?? null,
      variant_titles_json: (input.variant_titles_json ?? null) as unknown as Record<
        string,
        unknown
      > | null,
      bullets_json: (input.bullets_json ?? null) as unknown as Record<string, unknown> | null,
      specifications_json: (input.specifications_json ?? null) as unknown as Record<
        string,
        unknown
      > | null,
      seo_json: input.seo_json ?? null,
      custom_metadata_json: input.custom_metadata_json ?? null,
      raw_source_json: (input.raw_source_json ?? null) as unknown as Record<string, unknown> | null,
      source: input.source ?? 'manual',
      updated_by: input.updated_by ?? null,
    }
    const contentUpdateData = input.status
      ? {
          ...contentData,
          status: input.status,
        }
      : contentData

    let content: Record<string, unknown>
    let isNew = false

    if (existing) {
      const updated = await pim.updateProductContents({
        id: existing.id,
        ...contentUpdateData,
      })
      content = updated as unknown as Record<string, unknown>
    } else {
      const created = await pim.createProductContents({
        ...contentData,
        status: input.status ?? DRAFT_STATUS,
        created_by: input.created_by ?? null,
      })
      content = created as unknown as Record<string, unknown>
      isNew = true
    }

    return new StepResponse(
      { content, is_new: isNew, previous_snapshot: previousSnapshot },
      { contentId: getRecordId(content, 'PIM content'), isNew, previousSnapshot },
    )
  },
  // Compensation: restore or delete on rollback
  async (compensationData, { container }) => {
    if (!compensationData) return
    const pim = container.resolve<PimModuleService>(PIM_MODULE)
    const { contentId, isNew, previousSnapshot } = compensationData

    if (isNew) {
      await pim.deleteProductContents(contentId)
    } else if (previousSnapshot) {
      await pim.updateProductContents({
        id: contentId,
        ...previousSnapshot,
      })
    }
  },
)

export const appendContentVersionStep = createStep(
  'append-content-version',
  async (
    input: {
      content_id: string
      snapshot: Record<string, unknown>
      actor_type?: ProductContentVersionActorType
      actor_id?: string | null
      change_reason?: string
    },
    { container },
  ) => {
    const pim = container.resolve<PimModuleService>(PIM_MODULE)

    // Determine the next version number
    const [existingVersions] = await pim.listAndCountProductContentVersions(
      { content_id: input.content_id },
      { order: { version: 'DESC' }, take: 1 },
    )

    const nextVersion =
      existingVersions.length > 0 ? (existingVersions[0].version as number) + 1 : 1

    const version = await pim.createProductContentVersions({
      content_id: input.content_id,
      version: nextVersion,
      snapshot_json: input.snapshot,
      change_reason: input.change_reason ?? null,
      actor_type: input.actor_type ?? 'admin',
      actor_id: input.actor_id ?? null,
    })

    return new StepResponse(version, getRecordId(version, 'PIM content version'))
  },
  async (versionId, { container }) => {
    if (!versionId) return
    const pim = container.resolve<PimModuleService>(PIM_MODULE)
    await pim.deleteProductContentVersions(versionId)
  },
)
