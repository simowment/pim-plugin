export const METADATA_FIELD_TYPES = [
  'string',
  'text',
  'number',
  'boolean',
  'select',
  'multiselect',
  'json',
  'url',
] as const

export const METADATA_FIELD_SCOPES = ['product', 'variant', 'content'] as const
export const METADATA_FIELD_WRITE_POLICIES = ['admin', 'agent', 'system'] as const

export type MetadataFieldType = typeof METADATA_FIELD_TYPES[number]
export type MetadataFieldScope = typeof METADATA_FIELD_SCOPES[number]
export type MetadataFieldWritePolicy = typeof METADATA_FIELD_WRITE_POLICIES[number]

export type MetadataFieldOptions = Array<{
  label: string
  value: string
}>

export type MetadataFieldData = {
  key: string
  label: string
  description?: string | null
  type?: MetadataFieldType
  scope?: MetadataFieldScope
  group?: string | null
  options_json?: MetadataFieldOptions | null
  required?: boolean
  localized?: boolean
  channel_specific?: boolean
  visible_in_admin?: boolean
  visible_in_storefront?: boolean
  write_policy?: MetadataFieldWritePolicy
  validation_json?: Record<string, unknown> | null
  sort_order?: number
}

export type MetadataFieldUpdateData = Partial<MetadataFieldData>

export function normalizeMetadataFieldKey(key: string): string {
  return key.trim().toLowerCase().replace(/[^a-z0-9_]+/g, '_').replace(/^_+|_+$/g, '')
}

export function normalizeMetadataFieldData<T extends MetadataFieldUpdateData>(input: T): T {
  return {
    ...input,
    key: input.key ? normalizeMetadataFieldKey(input.key) : input.key,
  }
}

export function normalizeMetadataFieldUpdateData(
  id: string,
  input: MetadataFieldUpdateData,
): MetadataFieldUpdateData & { id: string } {
  const normalized = normalizeMetadataFieldData(input)
  const definedEntries = Object.entries(normalized).filter(([, value]) => value !== undefined)

  return {
    id,
    ...Object.fromEntries(definedEntries),
  }
}
