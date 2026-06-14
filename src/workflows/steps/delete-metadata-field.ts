import { createStep, StepResponse } from '@medusajs/framework/workflows-sdk'
import { PIM_MODULE } from '../../modules/pim'
import type PimModuleService from '../../modules/pim/service'

export type DeleteMetadataFieldInput = {
  id: string
}

export const deleteMetadataFieldStep = createStep(
  'delete-metadata-field',
  async (input: DeleteMetadataFieldInput, { container }) => {
    const pim = container.resolve<PimModuleService>(PIM_MODULE)

    await pim.retrieveProductMetadataField(input.id)
    await pim.deleteProductMetadataFields(input.id)

    return new StepResponse({ id: input.id, deleted: true })
  },
)
