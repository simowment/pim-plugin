import { Migration } from '@medusajs/framework/mikro-orm/migrations'

export class Migration20260614043000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`
      WITH ranked_fields AS (
        SELECT
          id,
          ROW_NUMBER() OVER (
            PARTITION BY "key"
            ORDER BY created_at ASC, id ASC
          ) AS row_number
        FROM "product_metadata_field"
        WHERE deleted_at IS NULL
      )
      UPDATE "product_metadata_field" field
      SET deleted_at = now(), updated_at = now()
      FROM ranked_fields
      WHERE field.id = ranked_fields.id
        AND ranked_fields.row_number > 1;
    `)

    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_product_metadata_field_key_unique" ON "product_metadata_field" ("key") WHERE deleted_at IS NULL;`,
    )
  }

  override async down(): Promise<void> {
    this.addSql(`DROP INDEX IF EXISTS "IDX_product_metadata_field_key_unique";`)
  }
}
