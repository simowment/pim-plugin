import { Migration } from '@medusajs/framework/mikro-orm/migrations'

export class Migration20260615120000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`ALTER TABLE "product_content" ADD COLUMN IF NOT EXISTS "variant_titles_json" jsonb null;`)
  }

  override async down(): Promise<void> {
    this.addSql(`ALTER TABLE "product_content" DROP COLUMN IF EXISTS "variant_titles_json";`)
  }
}
