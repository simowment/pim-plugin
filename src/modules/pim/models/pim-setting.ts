import { model } from '@medusajs/framework/utils'

/**
 * Settings saved on Product content > Settings (one row per key). A stored value wins over
 * the plugin option and the PIM_* environment variable, which stay the defaults. Never holds
 * secrets: API keys live in `pim_ai_setting` (encrypted) or the shared AI gateway.
 */
export const PimSetting = model
  .define('pim_setting', {
    id: model.id({ prefix: 'pimset' }).primaryKey(),
    key: model.text(),
    value: model.json().nullable(),
  })
  .indexes([
    {
      on: ['key'],
      unique: true,
    },
  ])

export default PimSetting
