import { Migration } from '@medusajs/framework/mikro-orm/migrations'

export class Migration20260622193000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`update "product_content" set "status" = 'draft' where "status" = 'ai_generated';`)
    this.addSql(`alter table "product_content" drop constraint if exists "product_content_status_check";`)
    this.addSql(
      `alter table "product_content" add constraint "product_content_status_check" check ("status" in ('draft', 'reviewed', 'published', 'archived'));`,
    )
  }

  override async down(): Promise<void> {
    this.addSql(`alter table "product_content" drop constraint if exists "product_content_status_check";`)
    this.addSql(
      `alter table "product_content" add constraint "product_content_status_check" check ("status" in ('draft', 'ai_generated', 'reviewed', 'published', 'archived'));`,
    )
  }
}
