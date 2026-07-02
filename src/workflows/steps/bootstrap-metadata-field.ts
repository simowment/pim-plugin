import { createStep, StepResponse } from '@medusajs/framework/workflows-sdk'
import { PIM_MODULE } from '../../modules/pim'
import type {
  ProductMetadataFieldScope,
  ProductMetadataFieldType,
  ProductMetadataFieldWritePolicy,
} from '../../modules/pim/models/product-metadata-field'
import type PimModuleService from '../../modules/pim/service'
import { getRecordId } from '../../lib/records'

export type BootstrapMetadataFieldInput = {
  key: string
  label: string
  description?: string | null
  type: ProductMetadataFieldType
  scope: ProductMetadataFieldScope
  group: string
  required: boolean
  localized: boolean
  channel_specific: boolean
  visible_in_admin: boolean
  visible_in_storefront: boolean
  write_policy: ProductMetadataFieldWritePolicy
  sort_order: number
}

export const bootstrapMetadataFieldStep = createStep(
  'bootstrap-metadata-field',
  async (input: BootstrapMetadataFieldInput, { container }) => {
    const pim = container.resolve<PimModuleService>(PIM_MODULE)
    const field = await pim.createProductMetadataFields(input)

    return new StepResponse(field, getRecordId(field, 'PIM metadata field'))
  },
  async (fieldId, { container }) => {
    if (!fieldId) return

    const pim = container.resolve<PimModuleService>(PIM_MODULE)
    await pim.deleteProductMetadataFields(fieldId)
  },
)
