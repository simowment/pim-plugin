import { describe, expect, it } from 'vitest'
import {
  normalizeMetadataFieldData,
  normalizeMetadataFieldKey,
  normalizeMetadataFieldUpdateData,
} from '../lib/metadata-fields'

describe('metadata field helpers', () => {
  it('normalizes keys to lowercase snake case', () => {
    expect(normalizeMetadataFieldKey(' Product Material ')).toBe('product_material')
    expect(normalizeMetadataFieldKey('Feature / Décor')).toBe('feature_d_cor')
    expect(normalizeMetadataFieldKey('__Already_OK__')).toBe('already_ok')
  })

  it('normalizes field data without mutating the input', () => {
    const input = {
      key: 'Care Instructions',
      label: 'Care Instructions',
      visible_in_storefront: true,
    }

    const result = normalizeMetadataFieldData(input)

    expect(result).toEqual({
      key: 'care_instructions',
      label: 'Care Instructions',
      visible_in_storefront: true,
    })
    expect(input.key).toBe('Care Instructions')
  })

  it('leaves partial updates without key untouched', () => {
    expect(normalizeMetadataFieldData({ label: 'Material' })).toEqual({ label: 'Material' })
  })

  it('prepares partial updates with id and without undefined fields', () => {
    expect(
      normalizeMetadataFieldUpdateData('pmf_123', {
        label: 'Material',
        key: undefined,
        description: null,
      }),
    ).toEqual({
      id: 'pmf_123',
      label: 'Material',
      description: null,
    })
  })
})
