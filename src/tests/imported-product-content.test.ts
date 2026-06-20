import { describe, expect, it } from 'vitest'
import { buildImportedProductContentInput } from '../lib/imported-product-content'

describe('imported product content contract', () => {
  it('converts supplier import events into PIM draft content input', () => {
    expect(
      buildImportedProductContentInput({
        version: 1,
        product_id: 'prod_123',
        external_product_id: 'ext_123',
        supplier_id: 'aliexpress',
        supplier_product_id: '100500',
        locale: 'fr-FR',
        channel: 'storefront',
        title: 'Imported title',
        description: 'Imported description',
        attributes: {
          Materiau: 'PU',
          Certification: 'CE',
        },
        variant_titles: [{ variant_id: 'variant_123', title: 'Black' }],
        raw_source: {
          source_url: 'https://supplier.example/100500',
        },
      }),
    ).toEqual({
      product_id: 'prod_123',
      locale: 'fr-FR',
      channel: 'storefront',
      title: 'Imported title',
      description: 'Imported description',
      short_description: null,
      variant_titles_json: [{ variant_id: 'variant_123', title: 'Black' }],
      specifications_json: [
        {
          key: 'materiau',
          label: 'Materiau',
          value: 'PU',
          group: 'supplier',
        },
        {
          key: 'certification',
          label: 'Certification',
          value: 'CE',
          group: 'supplier',
        },
      ],
      raw_source_json: {
        source_url: 'https://supplier.example/100500',
        supplier: 'aliexpress',
        supplier_product_id: '100500',
        external_product_id: 'ext_123',
        attributes: {
          Materiau: 'PU',
          Certification: 'CE',
        },
      },
      source: 'import',
      status: 'draft',
      created_by: null,
      updated_by: null,
      change_reason: 'supplier_import',
    })
  })
})
