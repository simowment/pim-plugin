import { Migration } from '@medusajs/framework/mikro-orm/migrations'

/** Product content > Settings: values saved in the admin, one row per key. */
export class Migration20261118151742 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `create table if not exists "pim_setting" ("id" text not null, "key" text not null, "value" jsonb null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "pim_setting_pkey" primary key ("id"));`,
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_pim_setting_deleted_at" ON "pim_setting" ("deleted_at") WHERE deleted_at IS NULL;`,
    )
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_pim_setting_key_unique" ON "pim_setting" ("key") WHERE deleted_at IS NULL;`,
    )
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "pim_setting" cascade;`)
  }
}
