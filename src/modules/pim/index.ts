import { Module } from '@medusajs/framework/utils'
import PimModuleService from './service'

export const PIM_MODULE = 'pim'

export default Module(PIM_MODULE, {
  service: PimModuleService,
})

export { PimModuleService } from './service'
export { ProductContent } from './models/product-content'
export { ProductMetadataField } from './models/product-metadata-field'
export { ProductContentVersion } from './models/product-content-version'
export { ProductContentJob } from './models/product-content-job'
export { PimAiSetting } from './models/pim-ai-setting'
