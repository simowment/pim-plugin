import { Migration } from '@medusajs/framework/mikro-orm/migrations'

export class Migration20260614090000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `create table if not exists "pim_ai_setting" ("id" text not null, "key" text not null default 'default', "provider" text not null, "encrypted_api_key" text null, "base_url" text not null, "model" text not null, "headers_json" jsonb null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "pim_ai_setting_pkey" primary key ("id"));`,
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_pim_ai_setting_deleted_at" ON "pim_ai_setting" ("deleted_at") WHERE deleted_at IS NULL;`,
    )
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_pim_ai_setting_key_unique" ON "pim_ai_setting" ("key") WHERE deleted_at IS NULL;`,
    )
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "pim_ai_setting" cascade;`)
  }
}
