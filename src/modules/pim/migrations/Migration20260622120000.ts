import { Migration } from '@medusajs/framework/mikro-orm/migrations'

export class Migration20260622120000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`UPDATE "product_content_job" SET status = 'running' WHERE status = 'queued';`)
    this.addSql(`UPDATE "product_content_job" SET status = 'failed' WHERE status = 'cancelled';`)
    this.addSql(`UPDATE "product_content_job" SET type = 'full' WHERE type = 'bulk_import_cleanup';`)

    this.addSql(`ALTER TABLE "product_content_job" DROP CONSTRAINT IF EXISTS "product_content_job_status_check";`)
    this.addSql(
      `ALTER TABLE "product_content_job" ADD CONSTRAINT "product_content_job_status_check" CHECK ("status" IN ('running', 'completed', 'failed'));`,
    )
    this.addSql(`ALTER TABLE "product_content_job" ALTER COLUMN "status" SET DEFAULT 'running';`)

    this.addSql(`ALTER TABLE "product_content_job" DROP CONSTRAINT IF EXISTS "product_content_job_type_check";`)
    this.addSql(
      `ALTER TABLE "product_content_job" ADD CONSTRAINT "product_content_job_type_check" CHECK ("type" IN ('translate', 'rewrite', 'extract_specs', 'seo', 'full'));`,
    )

    this.addSql(`ALTER TABLE "product_content" DROP COLUMN IF EXISTS "subtitle";`)
    this.addSql(`ALTER TABLE "product_content" DROP COLUMN IF EXISTS "quality_json";`)
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_product_content_version_number_unique" ON "product_content_version" ("content_id", "version") WHERE deleted_at IS NULL;`,
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_product_content_version_content_id" ON "product_content_version" ("content_id") WHERE deleted_at IS NULL;`,
    )
  }

  override async down(): Promise<void> {}
}
