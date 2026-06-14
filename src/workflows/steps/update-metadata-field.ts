import { createStep, StepResponse } from '@medusajs/framework/workflows-sdk'
import { MedusaError } from '@medusajs/framework/utils'
import { PIM_MODULE } from '../../modules/pim'
import type PimModuleService from '../../modules/pim/service'
import {
  INVALID_METADATA_FIELD_KEY_MESSAGE,
  normalizeMetadataFieldUpdateData,
  type MetadataFieldUpdateData,
} from '../../lib/metadata-fields'

export interface UpdateMetadataFieldInput extends MetadataFieldUpdateData {
  id: string
}

export const updateMetadataFieldStep = createStep(
  'update-metadata-field',
  async (input: UpdateMetadataFieldInput, { container }) => {
    const pim = container.resolve<PimModuleService>(PIM_MODULE)
    const previous = await pim.retrieveProductMetadataField(input.id)
    const data = normalizeMetadataFieldUpdateData(input.id, input)

    if (input.key !== undefined && !data.key) {
      throw new MedusaError(MedusaError.Types.INVALID_DATA, INVALID_METADATA_FIELD_KEY_MESSAGE)
    }

    if (data.key && data.key !== previous.key) {
      const [existing] = await pim.listAndCountProductMetadataFields({ key: data.key }, { take: 2 })
      const conflicting = existing.find((field) => (field as any).id !== input.id)

      if (conflicting) {
        throw new MedusaError(
          MedusaError.Types.DUPLICATE_ERROR,
          `Metadata field key "${data.key}" already exists`,
        )
      }
    }

    const updated = await pim.updateProductMetadataFields(data as any)

    return new StepResponse(updated, previous)
  },
  async (previous, { container }) => {
    if (!previous) return

    const pim = container.resolve<PimModuleService>(PIM_MODULE)
    await pim.updateProductMetadataFields(previous as any)
  },
)
