import { Migration } from '@medusajs/framework/mikro-orm/migrations'

export class Migration20260611120000 extends Migration {
  override async up(): Promise<void> {
    // Drop old check constraint and recreate with 'full' added to JOB_TYPES
    this.addSql(
      `ALTER TABLE "product_content_job" DROP CONSTRAINT IF EXISTS "product_content_job_type_check";`,
    )
    this.addSql(
      `ALTER TABLE "product_content_job" ADD CONSTRAINT "product_content_job_type_check" CHECK ("type" IN ('translate', 'rewrite', 'extract_specs', 'seo', 'full', 'bulk_import_cleanup'));`,
    )
  }

  override async down(): Promise<void> {
    this.addSql(
      `ALTER TABLE "product_content_job" DROP CONSTRAINT IF EXISTS "product_content_job_type_check";`,
    )
    this.addSql(
      `ALTER TABLE "product_content_job" ADD CONSTRAINT "product_content_job_type_check" CHECK ("type" IN ('translate', 'rewrite', 'extract_specs', 'seo', 'bulk_import_cleanup'));`,
    )
  }
}
