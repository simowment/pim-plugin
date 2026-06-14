import { Migration } from '@medusajs/framework/mikro-orm/migrations'

export class Migration20260614043000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_product_metadata_field_key_unique" ON "product_metadata_field" ("key") WHERE deleted_at IS NULL;`,
    )
  }

  override async down(): Promise<void> {
    this.addSql(
      `DROP INDEX IF EXISTS "IDX_product_metadata_field_key_unique";`,
    )
  }
}
