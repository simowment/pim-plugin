import { createStep, StepResponse } from '@medusajs/framework/workflows-sdk'
import { MedusaError } from '@medusajs/framework/utils'
import { PIM_MODULE } from '../../modules/pim'
import type PimModuleService from '../../modules/pim/service'
import {
  INVALID_METADATA_FIELD_KEY_MESSAGE,
  normalizeMetadataFieldData,
  type MetadataFieldData,
} from '../../lib/metadata-fields'
import { getRecordId } from '../../lib/records'

export interface CreateMetadataFieldInput extends MetadataFieldData {}
type MetadataFieldPersistenceData = Omit<MetadataFieldData, 'options_json'> & {
  options_json?: Record<string, unknown> | null
}

export const createMetadataFieldStep = createStep(
  'create-metadata-field',
  async (input: CreateMetadataFieldInput, { container }) => {
    const pim = container.resolve<PimModuleService>(PIM_MODULE)
    const data = normalizeMetadataFieldData(input)

    if (!data.key) {
      throw new MedusaError(MedusaError.Types.INVALID_DATA, INVALID_METADATA_FIELD_KEY_MESSAGE)
    }

    const [existing] = await pim.listAndCountProductMetadataFields({ key: data.key }, { take: 1 })

    if (existing.length > 0) {
      throw new MedusaError(
        MedusaError.Types.DUPLICATE_ERROR,
        `Metadata field key "${data.key}" already exists`,
      )
    }

    const field = await pim.createProductMetadataFields(data as MetadataFieldPersistenceData)

    return new StepResponse(field, getRecordId(field, 'PIM metadata field'))
  },
  async (fieldId, { container }) => {
    if (!fieldId) return

    const pim = container.resolve<PimModuleService>(PIM_MODULE)
    await pim.deleteProductMetadataFields(fieldId)
  },
)
