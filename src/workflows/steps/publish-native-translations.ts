import { createStep, StepResponse } from '@medusajs/framework/workflows-sdk'
import { Modules } from '@medusajs/framework/utils'
import type {
  ITranslationModuleService,
  TranslationDTO,
  TranslationSettingsDTO,
} from '@medusajs/types'
import {
  buildNativeTranslationInputs,
  medusaLocaleName,
  shouldMirrorNativeTranslations,
  type NativeTranslationInput,
} from '../../lib/native-translations'
import { assertCanonicalPimLocale } from '../../lib/locales'

const PRODUCT_ENTITY = 'product'
const PRODUCT_VARIANT_ENTITY = 'product_variant'
const PRODUCT_FIELDS = ['title', 'description', 'subtitle']
const PRODUCT_VARIANT_FIELDS = ['title']

type TranslationSnapshot = {
  id: string
  previous_translations: Record<string, unknown> | null
}

type TranslationSettingSnapshot = {
  id: string
  previous: Pick<TranslationSettingsDTO, 'fields' | 'is_active'> | null
}

type PublishNativeTranslationsCompensation = {
  snapshots: TranslationSnapshot[]
  locale_ids: string[]
  setting_snapshots: TranslationSettingSnapshot[]
}

type PublishNativeTranslationsInput = {
  content: Record<string, unknown>
}

type StepContainer = {
  hasRegistration?: (key: string) => boolean
  resolve: <T>(key: string, options?: { allowUnregistered?: boolean }) => T | undefined
}

function mergeFields(existingFields: string[], requiredFields: string[]): string[] {
  return Array.from(new Set([...existingFields, ...requiredFields]))
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

function settingNeedsUpdate(
  setting: TranslationSettingsDTO,
  requiredFields: string[],
): boolean {
  return !setting.is_active || requiredFields.some((field) => !setting.fields.includes(field))
}

async function ensureLocale(
  translationService: ITranslationModuleService,
  localeCode: string,
): Promise<string | null> {
  const existingLocales = await translationService.listLocales({ code: localeCode }, { take: 1 })
  if (existingLocales.length > 0) {
    return null
  }

  const created = await translationService.createLocales({
    code: localeCode,
    name: medusaLocaleName(localeCode),
  })
  return created.id
}

async function ensureTranslationSetting(
  translationService: ITranslationModuleService,
  entityType: string,
  fields: string[],
): Promise<TranslationSettingSnapshot | null> {
  const settings = await translationService.listTranslationSettings(
    { entity_type: entityType },
    { take: 1 },
  )
  const setting = settings[0]

  if (!setting) {
    await translationService.createTranslationSettings({
      entity_type: entityType,
      fields,
      is_active: true,
    })
    const created = await translationService.listTranslationSettings(
      { entity_type: entityType },
      { take: 1 },
    )
    return created[0] ? { id: created[0].id, previous: null } : null
  }

  if (!settingNeedsUpdate(setting, fields)) {
    return null
  }

  await translationService.updateTranslationSettings({
    id: setting.id,
    fields: mergeFields(setting.fields, fields),
    is_active: true,
  })
  return {
    id: setting.id,
    previous: {
      fields: setting.fields,
      is_active: setting.is_active,
    },
  }
}

async function upsertTranslation(
  translationService: ITranslationModuleService,
  input: NativeTranslationInput,
): Promise<TranslationSnapshot> {
  const existingTranslations = await translationService.listTranslations(
    {
      reference: input.reference,
      reference_id: input.reference_id,
      locale_code: input.locale_code,
    },
    { take: 1 },
  )
  const existingTranslation = existingTranslations[0]

  if (!existingTranslation) {
    const created = await translationService.createTranslations(input)
    return {
      id: created.id,
      previous_translations: null,
    }
  }

  await translationService.updateTranslations({
    id: existingTranslation.id,
    translations: {
      ...existingTranslation.translations,
      ...input.translations,
    },
  })

  return {
    id: existingTranslation.id,
    previous_translations: existingTranslation.translations,
  }
}

async function restoreTranslation(
  translationService: ITranslationModuleService,
  snapshot: TranslationSnapshot,
): Promise<void> {
  if (snapshot.previous_translations) {
    await translationService.updateTranslations({
      id: snapshot.id,
      translations: snapshot.previous_translations,
    })
    return
  }

  await translationService.deleteTranslations(snapshot.id)
}

async function restoreTranslationSetting(
  translationService: ITranslationModuleService,
  snapshot: TranslationSettingSnapshot,
): Promise<void> {
  if (!snapshot.previous) {
    await translationService.deleteTranslationSettings([snapshot.id])
    return
  }

  await translationService.updateTranslationSettings({
    id: snapshot.id,
    fields: snapshot.previous.fields,
    is_active: snapshot.previous.is_active,
  })
}

export const publishNativeTranslationsStep = createStep(
  'publish-native-translations',
  async (input: PublishNativeTranslationsInput, { container }) => {
    if (!shouldMirrorNativeTranslations(input.content.channel)) {
      return new StepResponse(
        { count: 0, skipped: 'non_native_channel' },
        { snapshots: [], locale_ids: [], setting_snapshots: [] },
      )
    }

    const localeCode = assertCanonicalPimLocale(input.content.locale, 'content.locale')
    const translationInputs = buildNativeTranslationInputs(input.content, localeCode)

    if (translationInputs.length === 0) {
      return new StepResponse(
        { count: 0 },
        { snapshots: [], locale_ids: [], setting_snapshots: [] },
      )
    }

    const translationService = resolveOptionalTranslationService(container as StepContainer)
    if (!translationService) {
      return new StepResponse(
        { count: 0, skipped: 'translation_module_missing' },
        { snapshots: [], locale_ids: [], setting_snapshots: [] },
      )
    }

    const localeCodes = Array.from(new Set(translationInputs.map((item) => item.locale_code)))
    const localeIds = (
      await Promise.all(localeCodes.map((localeCode) => ensureLocale(translationService, localeCode)))
    ).filter((id): id is string => Boolean(id))
    const settingSnapshots = (
      await Promise.all([
        ensureTranslationSetting(translationService, PRODUCT_ENTITY, PRODUCT_FIELDS),
        ensureTranslationSetting(translationService, PRODUCT_VARIANT_ENTITY, PRODUCT_VARIANT_FIELDS),
      ])
    ).filter((snapshot): snapshot is TranslationSettingSnapshot => Boolean(snapshot))

    const snapshots = await Promise.all(
      translationInputs.map((translationInput) =>
        upsertTranslation(translationService, translationInput),
      ),
    )

    return new StepResponse(
      { count: translationInputs.length },
      {
        snapshots,
        locale_ids: localeIds,
        setting_snapshots: settingSnapshots,
      } satisfies PublishNativeTranslationsCompensation,
    )
  },
  async (compensationData, { container }) => {
    if (!compensationData) {
      return
    }

    const translationService = resolveOptionalTranslationService(container as StepContainer)
    if (!translationService) {
      return
    }

    await Promise.all(
      compensationData.snapshots.map((snapshot) => restoreTranslation(translationService, snapshot)),
    )
    await Promise.all(
      compensationData.setting_snapshots.map((snapshot) =>
        restoreTranslationSetting(translationService, snapshot),
      ),
    )
    await Promise.all(
      compensationData.locale_ids.map((localeId) => translationService.deleteLocales(localeId)),
    )
  },
)
