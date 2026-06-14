/**
 * metadata-validation.test.ts
 *
 * Unit tests for metadata key validation against field definitions.
 */

import { describe, it, expect } from 'vitest'

// ─── Inline validation logic ───────────────────────────────────────────────

interface MetadataField {
  key: string
  type: string
}

interface ValidationError {
  field: string
  message: string
}

function validateMetadata(
  metadata: Record<string, unknown>,
  fields: MetadataField[],
  allowUnknownKeys = false,
): ValidationError[] {
  const errors: ValidationError[] = []
  const allowedKeys = new Set(fields.map((f) => f.key))

  // Check for unknown keys
  for (const key of Object.keys(metadata)) {
    if (!allowedKeys.has(key)) {
      if (!allowUnknownKeys) {
        errors.push({ field: key, message: `Unknown metadata key: ${key}` })
      }
    }
  }

  // Check type constraints for known keys
  for (const field of fields) {
    const value = metadata[field.key]
    if (value === undefined || value === null) continue

    if (field.type === 'number' && typeof value !== 'number') {
      errors.push({ field: field.key, message: `Must be a number` })
    }
    if (field.type === 'boolean' && typeof value !== 'boolean') {
      errors.push({ field: field.key, message: `Must be a boolean` })
    }
    if (['string', 'text', 'url'].includes(field.type) && typeof value !== 'string') {
      errors.push({ field: field.key, message: `Must be a string` })
    }
  }

  return errors
}

// ─── Tests ────────────────────────────────────────────────────────────────

describe('Metadata field validation', () => {
  const fields: MetadataField[] = [
    { key: 'material', type: 'string' },
    { key: 'sort_order', type: 'number' },
    { key: 'is_featured', type: 'boolean' },
    { key: 'care_instructions', type: 'text' },
    { key: 'product_url', type: 'url' },
  ]

  it('passes valid metadata', () => {
    const errors = validateMetadata(
      { material: 'cotton', sort_order: 1, is_featured: true },
      fields,
    )
    expect(errors).toHaveLength(0)
  })

  it('rejects unknown keys by default', () => {
    const errors = validateMetadata({ unknown_key: 'value' }, fields)
    expect(errors).toHaveLength(1)
    expect(errors[0].field).toBe('unknown_key')
  })

  it('allows unknown keys when allowUnknownKeys=true', () => {
    const errors = validateMetadata({ unknown_key: 'value' }, fields, true)
    expect(errors).toHaveLength(0)
  })

  it('rejects wrong type for number field', () => {
    const errors = validateMetadata({ sort_order: 'not-a-number' }, fields)
    expect(errors.some((e) => e.field === 'sort_order')).toBe(true)
  })

  it('rejects wrong type for boolean field', () => {
    const errors = validateMetadata({ is_featured: 'yes' }, fields)
    expect(errors.some((e) => e.field === 'is_featured')).toBe(true)
  })

  it('rejects wrong type for string fields', () => {
    const errors = validateMetadata({ material: 123 }, fields)
    expect(errors.some((e) => e.field === 'material')).toBe(true)
  })

  it('skips validation for null/undefined values', () => {
    const errors = validateMetadata({ material: null }, fields)
    expect(errors).toHaveLength(0)
  })

  it('validates multiple fields and collects all errors', () => {
    const errors = validateMetadata(
      { sort_order: 'bad', is_featured: 'bad', unknown_xyz: 1 },
      fields,
    )
    expect(errors.length).toBeGreaterThanOrEqual(3)
  })
})
