import { describe, expect, it } from 'vitest'
import {
  buildPimGenerationSource,
  normalizeSupplierSpecifications,
  resolveBestPimContentRecord,
} from '../lib/specifications'

describe('supplier specification normalization', () => {
  it('converts supplier attributes into stable PIM specifications', () => {
    expect(
      normalizeSupplierSpecifications({
        'Mat\u00e9Riau': 'PU',
        '\u00c2Ge Recommand\u00e9': '14 ans et plus',
        Feature: ['Decorative knives', 'Room d\u00e9cor'],
      }),
    ).toEqual([
      {
        key: 'materiau',
        label: 'Mat\u00e9Riau',
        value: 'PU',
        group: 'supplier',
      },
      {
        key: 'age_recommande',
        label: '\u00c2Ge Recommand\u00e9',
        value: '14 ans et plus',
        group: 'supplier',
      },
      {
        key: 'feature',
        label: 'Feature',
        value: 'Decorative knives, Room d\u00e9cor',
        group: 'supplier',
      },
    ])
  })

  it('ignores empty and duplicate normalized attributes', () => {
    expect(
      normalizeSupplierSpecifications({
        Material: 'PU',
        ' material ': 'PVC',
        Empty: '',
      }),
    ).toEqual([
      {
        key: 'material',
        label: 'Material',
        value: 'PU',
        group: 'supplier',
      },
    ])
  })

  it('returns an empty list for unsupported input', () => {
    expect(normalizeSupplierSpecifications(null)).toEqual([])
    expect(normalizeSupplierSpecifications(['Material', 'PU'])).toEqual([])
  })

  it('uses supplier specifications when no PIM content exists', () => {
    const source = buildPimGenerationSource({
      title: 'Supplier title',
      description: 'Supplier description',
      metadata: {
        supplier: 'aliexpress',
        supplier_product_id: '100500',
        attributes: { Matériau: 'PU' },
      },
    })

    expect(source.title).toBe('Supplier title')
    expect(source.specifications_json).toEqual([
      {
        key: 'materiau',
        label: 'Mat\u00e9riau',
        value: 'PU',
        group: 'supplier',
      },
    ])
  })

  it('fills empty stored specifications without replacing stored copy', () => {
    const source = buildPimGenerationSource(
      {
        title: 'Supplier title',
        metadata: { attributes: { Certification: 'CE' } },
      },
      {
        title: 'Reviewed title',
        specifications_json: [],
      },
    )

    expect(source.title).toBe('Reviewed title')
    expect(source.specifications_json).toEqual([
      {
        key: 'certification',
        label: 'Certification',
        value: 'CE',
        group: 'supplier',
      },
    ])
  })

  it('preserves stored specifications when they exist', () => {
    const storedSpecifications = [{ key: 'material', label: 'Material', value: 'Polyurethane' }]
    const source = buildPimGenerationSource(
      {
        metadata: { attributes: { Material: 'PU' } },
      },
      {
        specifications_json: storedSpecifications,
      },
    )

    expect(source.specifications_json).toEqual(storedSpecifications)
  })

  it('resolves existing content by normalized language locale', () => {
    const records = [
      {
        id: 'cnt_en',
        product_id: 'prod_1',
        locale: 'en',
        channel: 'storefront',
        status: 'published',
        title: 'English',
      },
      {
        id: 'cnt_fr',
        product_id: 'prod_1',
        locale: 'fr',
        channel: 'storefront',
        status: 'published',
        title: 'French',
      },
    ]

    expect(
      resolveBestPimContentRecord(records, {
        locale: 'FR_fr',
        channel: 'storefront',
        statuses: ['published'],
      })?.id,
    ).toBe('cnt_fr')
  })

  it('prefers existing content with specifications for the same language', () => {
    const records = [
      {
        id: 'cnt_empty_exact',
        product_id: 'prod_1',
        locale: 'fr-FR',
        channel: 'storefront',
        status: 'reviewed',
        specifications_json: [],
      },
      {
        id: 'cnt_specs_language',
        product_id: 'prod_1',
        locale: 'fr',
        channel: 'storefront',
        status: 'reviewed',
        specifications_json: [{ key: 'material', label: 'Material', value: 'PU' }],
      },
    ]

    expect(
      resolveBestPimContentRecord(records, {
        locale: 'fr_FR',
        channel: 'storefront',
        statuses: ['reviewed'],
        preferSpecifications: true,
      })?.id,
    ).toBe('cnt_specs_language')
  })
})
