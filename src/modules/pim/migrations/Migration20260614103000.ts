import { Migration } from '@medusajs/framework/mikro-orm/migrations'

export class Migration20260614103000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`
      WITH ranked_content AS (
        SELECT
          id,
          ROW_NUMBER() OVER (
            PARTITION BY product_id, locale, channel, status
            ORDER BY
              COALESCE(published_at, updated_at, created_at) DESC,
              updated_at DESC,
              id DESC
          ) AS row_number
        FROM "product_content"
        WHERE deleted_at IS NULL
          AND status <> 'archived'
      )
      UPDATE "product_content" content
      SET deleted_at = now(), updated_at = now()
      FROM ranked_content
      WHERE content.id = ranked_content.id
        AND ranked_content.row_number > 1;
    `)

    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_product_content_lookup" ON "product_content" ("product_id", "status", "locale", "channel") WHERE deleted_at IS NULL;`,
    )
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_product_content_active_status_unique" ON "product_content" ("product_id", "locale", "channel", "status") WHERE deleted_at IS NULL AND status <> 'archived';`,
    )
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_product_content_published_unique" ON "product_content" ("product_id", "locale", "channel") WHERE deleted_at IS NULL AND status = 'published';`,
    )
  }

  override async down(): Promise<void> {
    this.addSql(`DROP INDEX IF EXISTS "IDX_product_content_published_unique";`)
    this.addSql(`DROP INDEX IF EXISTS "IDX_product_content_active_status_unique";`)
    this.addSql(`DROP INDEX IF EXISTS "IDX_product_content_lookup";`)
  }
}
