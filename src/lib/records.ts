import { MedusaError } from '@medusajs/framework/utils'

export type IdentifiableRecord = Record<string, unknown> & {
  id: string
}

export function assertRecord(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object') {
    throw new MedusaError(MedusaError.Types.UNEXPECTED_STATE, `${label} is not a record`)
  }

  return value as Record<string, unknown>
}

export function assertIdentifiableRecord(value: unknown, label: string): IdentifiableRecord {
  const record = assertRecord(value, label)
  const id = record.id

  if (typeof id !== 'string' || id.length === 0) {
    throw new MedusaError(MedusaError.Types.UNEXPECTED_STATE, `${label} is missing an id`)
  }

  return record as IdentifiableRecord
}

export function getRecordId(value: unknown, label: string): string {
  return assertIdentifiableRecord(value, label).id
}
