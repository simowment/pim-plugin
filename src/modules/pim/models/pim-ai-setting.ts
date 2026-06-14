import { model } from '@medusajs/framework/utils'

export const PimAiSetting = model
  .define('pim_ai_setting', {
    id: model.id().primaryKey(),
    key: model.text().default('default'),
    provider: model.text(),
    encrypted_api_key: model.text().nullable(),
    base_url: model.text(),
    model: model.text(),
    headers_json: model.json().nullable(),
  })
  .indexes([
    {
      on: ['key'],
      unique: true,
    },
  ])

export default PimAiSetting
