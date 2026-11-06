import { MedusaService } from '@medusajs/framework/utils'
import ProductContent from './models/product-content'
import ProductMetadataField from './models/product-metadata-field'
import ProductContentVersion from './models/product-content-version'
import ProductContentJob from './models/product-content-job'
import PimAiSetting from './models/pim-ai-setting'
import { setPimPluginOptions, type PimPluginOptions } from '../../lib/config'

export class PimModuleService extends MedusaService({
  ProductContent,
  ProductMetadataField,
  ProductContentVersion,
  ProductContentJob,
  PimAiSetting,
}) {
  // Medusa passes plugin / module options as the second constructor argument.
  constructor(container: Record<string, unknown>, options?: PimPluginOptions) {
    // eslint-disable-next-line prefer-rest-params
    super(...(arguments as unknown as [Record<string, unknown>, PimPluginOptions?]))
    setPimPluginOptions(options)
  }
}

export default PimModuleService
