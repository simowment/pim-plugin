import { MedusaService } from '@medusajs/framework/utils'
import ProductContent from './models/product-content'
import ProductMetadataField from './models/product-metadata-field'
import ProductContentVersion from './models/product-content-version'
import ProductContentJob from './models/product-content-job'
import PimAiSetting from './models/pim-ai-setting'

export class PimModuleService extends MedusaService({
  ProductContent,
  ProductMetadataField,
  ProductContentVersion,
  ProductContentJob,
  PimAiSetting,
}) {}

export default PimModuleService
