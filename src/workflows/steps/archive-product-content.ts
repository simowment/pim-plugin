import { createStep, StepResponse } from '@medusajs/framework/workflows-sdk'
import { Modules } from '@medusajs/framework/utils'
import type { ITranslationModuleService } from '@medusajs/types'
import { PIM_MODULE } from '../../modules/pim'
import type PimModuleService from '../../modules/pim/service'
import type { ProductContentStatus } from '../../modules/pim/models/product-content'
import {
  buildNativeTranslationInputs,
  shouldMirrorNativeTranslations,
} from '../../lib/native-translations'
import { parseCanonicalPimLocale } from '../../lib/locales'

const PUBLISHED_STATUS: ProductContentStatus = 'published'
const ARCHIVED_STATUS: ProductContentStatus = 'archived'

export interface ArchiveProductContentInput {
  id: string
  actor_id?: string | null
}

export interface ArchiveProductContentOutput {
  content: Record<string, unknown>
  was_published: boolean
  already_archived: boolean
}

/** Sets any PIM record (draft, reviewed or published) to `archived`. */
export const archiveProductContentStep = createStep(
  'archive-product-content',
  async (input: ArchiveProductContentInput, { container }) => {
    const pim = container.resolve<PimModuleService>(PIM_MODULE)
    const content = await pim.retrieveProductContent(input.id)

    if (content.status === ARCHIVED_STATUS) {
      return new StepResponse<ArchiveProductContentOutput, null>(
        {
          content: content as unknown as Record<string, unknown>,
          was_published: false,
          already_archived: true,
        },
        null,
      )
    }

    const updated = await pim.updateProductContents({
      id: input.id,
      status: ARCHIVED_STATUS,
      updated_by: input.actor_id ?? null,
    })

    return new StepResponse<ArchiveProductContentOutput, Record<string, unknown>>(
      {
        content: updated as unknown as Record<string, unknown>,
        was_published: content.status === PUBLISHED_STATUS,
        already_archived: false,
      },
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

type RemovedTranslationSnapshot = {
  id: string
  reference: string
  reference_id: string
  locale_code: string
  previous_translations: Record<string, unknown>
  deleted: boolean
}

type StepContainer = {
  hasRegistration?: (key: string) => boolean
  resolve: <T>(key: string, options?: { allowUnregistered?: boolean }) => T | undefined
}

function resolveOptionalTranslationService(
  container: StepContainer,
): ITranslationModuleService | null {
  if (
    typeof container.hasRegistration === 'function' &&
    !container.hasRegistration(Modules.TRANSLATION)
  ) {
    return null
  }
  return (
    container.resolve<ITranslationModuleService>(Modules.TRANSLATION, {
      allowUnregistered: true,
    }) ?? null
  )
}

/**
 * Undoes the Translation-module mirror written when the record was published.
 * Only fields whose current value is still the value the PIM published are
 * removed, so later edits made in the native translation editor are kept. A
 * translation row left with no fields is deleted.
 */
export const removeNativeTranslationsStep = createStep(
  'remove-native-translations',
  async (
    input: { content: Record<string, unknown>; was_published: boolean },
    { container },
  ) => {
    const none = new StepResponse({ removed: 0 }, [] as RemovedTranslationSnapshot[])
    if (!input.was_published || !shouldMirrorNativeTranslations(input.content.channel)) {
      return none
    }

    const localeCode = parseCanonicalPimLocale(input.content.locale)
    if (!localeCode) {
      return none
    }

    const translationService = resolveOptionalTranslationService(container as StepContainer)
    if (!translationService) {
      return none
    }

    const mirrored = buildNativeTranslationInputs(input.content, localeCode)
    const snapshots: RemovedTranslationSnapshot[] = []

    for (const item of mirrored) {
      const [existing] = await translationService.listTranslations(
        {
          reference: item.reference,
          reference_id: item.reference_id,
          locale_code: item.locale_code,
        },
        { take: 1 },
      )
      if (!existing) {
        continue
      }

      const current = { ...(existing.translations ?? {}) } as Record<string, unknown>
      let changed = false
      for (const [field, value] of Object.entries(item.translations)) {
        if (current[field] === value) {
          delete current[field]
          changed = true
        }
      }
      if (!changed) {
        continue
      }

      const deleted = Object.keys(current).length === 0
      if (deleted) {
        await translationService.deleteTranslations(existing.id)
      } else {
        await translationService.updateTranslations({ id: existing.id, translations: current })
      }

      snapshots.push({
        id: existing.id,
        reference: item.reference,
        reference_id: item.reference_id,
        locale_code: item.locale_code,
        previous_translations: (existing.translations ?? {}) as Record<string, unknown>,
        deleted,
      })
    }

    return new StepResponse({ removed: snapshots.length }, snapshots)
  },
  async (snapshots, { container }) => {
    if (!snapshots?.length) return
    const translationService = resolveOptionalTranslationService(container as StepContainer)
    if (!translationService) return

    for (const snapshot of snapshots) {
      if (snapshot.deleted) {
        await translationService.createTranslations({
          reference: snapshot.reference,
          reference_id: snapshot.reference_id,
          locale_code: snapshot.locale_code,
          translations: snapshot.previous_translations,
        })
      } else {
        await translationService.updateTranslations({
          id: snapshot.id,
          translations: snapshot.previous_translations,
        })
      }
    }
  },
)
