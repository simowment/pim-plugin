import { Migration } from "@medusajs/framework/mikro-orm/migrations"

export class Migration20260604151936 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `create table if not exists "product_content" ("id" text not null, "product_id" text not null, "locale" text not null, "channel" text not null, "status" text check ("status" in ('draft', 'ai_generated', 'reviewed', 'published', 'archived')) not null default 'draft', "source" text check ("source" in ('supplier', 'manual', 'ai', 'import', 'directus', 'agent')) not null default 'manual', "title" text null, "subtitle" text null, "description" text null, "short_description" text null, "bullets_json" jsonb null, "specifications_json" jsonb null, "seo_json" jsonb null, "custom_metadata_json" jsonb null, "raw_source_json" jsonb null, "quality_json" jsonb null, "published_at" timestamptz null, "created_by" text null, "updated_by" text null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "product_content_pkey" primary key ("id"));`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_product_content_deleted_at" ON "product_content" ("deleted_at") WHERE deleted_at IS NULL;`
    )

    this.addSql(
      `create table if not exists "product_content_job" ("id" text not null, "type" text check ("type" in ('translate', 'rewrite', 'extract_specs', 'seo', 'bulk_import_cleanup')) not null, "product_id" text null, "locale" text null, "status" text check ("status" in ('queued', 'running', 'completed', 'failed', 'cancelled')) not null default 'queued', "input_json" jsonb not null, "result_json" jsonb null, "error_message" text null, "created_by" text null, "started_at" timestamptz null, "completed_at" timestamptz null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "product_content_job_pkey" primary key ("id"));`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_product_content_job_deleted_at" ON "product_content_job" ("deleted_at") WHERE deleted_at IS NULL;`
    )

    this.addSql(
      `create table if not exists "product_content_version" ("id" text not null, "content_id" text not null, "version" integer not null, "snapshot_json" jsonb not null, "change_reason" text null, "actor_type" text check ("actor_type" in ('admin', 'agent', 'system')) not null default 'admin', "actor_id" text null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "product_content_version_pkey" primary key ("id"));`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_product_content_version_deleted_at" ON "product_content_version" ("deleted_at") WHERE deleted_at IS NULL;`
    )

    this.addSql(
      `create table if not exists "product_metadata_field" ("id" text not null, "key" text not null, "label" text not null, "description" text null, "type" text check ("type" in ('string', 'text', 'number', 'boolean', 'select', 'multiselect', 'json', 'url')) not null default 'string', "scope" text check ("scope" in ('product', 'variant', 'content')) not null default 'product', "group" text null, "options_json" jsonb null, "required" boolean not null default false, "localized" boolean not null default false, "channel_specific" boolean not null default false, "visible_in_admin" boolean not null default true, "visible_in_storefront" boolean not null default false, "write_policy" text check ("write_policy" in ('admin', 'agent', 'system')) not null default 'admin', "validation_json" jsonb null, "sort_order" integer not null default 0, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "product_metadata_field_pkey" primary key ("id"));`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_product_metadata_field_deleted_at" ON "product_metadata_field" ("deleted_at") WHERE deleted_at IS NULL;`
    )
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "product_content" cascade;`)
    this.addSql(`drop table if exists "product_content_job" cascade;`)
    this.addSql(`drop table if exists "product_content_version" cascade;`)
    this.addSql(`drop table if exists "product_metadata_field" cascade;`)
  }
}
