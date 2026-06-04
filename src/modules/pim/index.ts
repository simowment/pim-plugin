import { Module } from '@medusajs/framework/utils'
import PimModuleService from './service'

export const PIM_MODULE = 'pim'

export default Module(PIM_MODULE, {
  service: PimModuleService,
})

export { default as PimModuleService } from './service'
export { default as ProductContent } from './models/product-content'
export { default as ProductMetadataField } from './models/product-metadata-field'
export { default as ProductContentVersion } from './models/product-content-version'
export { default as ProductContentJob } from './models/product-content-job'
