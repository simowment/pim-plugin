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
export const INVALID_METADATA_FIELD_KEY_MESSAGE =
  'Metadata field key must contain at least one letter, number, or underscore'

export interface MetadataFieldOption {
  label: string
  value: string
}

export interface MetadataFieldData {
  key: string
  label: string
  description?: string | null
  type?: (typeof METADATA_FIELD_TYPES)[number]
  scope?: (typeof METADATA_FIELD_SCOPES)[number]
  group?: string | null
  options_json?: MetadataFieldOption[] | null
  required?: boolean
  localized?: boolean
  channel_specific?: boolean
  visible_in_admin?: boolean
  visible_in_storefront?: boolean
  write_policy?: (typeof METADATA_FIELD_WRITE_POLICIES)[number]
  validation_json?: Record<string, unknown> | null
  sort_order?: number
}

export interface MetadataFieldUpdateData extends Partial<MetadataFieldData> {}

export function normalizeMetadataFieldKey(key: string): string {
  return key
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

export function normalizeMetadataFieldData<T extends MetadataFieldUpdateData>(input: T): T {
  const scope = input.scope

  return {
    ...input,
    key: input.key ? normalizeMetadataFieldKey(input.key) : input.key,
    ...(scope ? { localized: scope === 'content' } : {}),
    channel_specific: false,
    write_policy: 'admin',
    validation_json: null,
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
