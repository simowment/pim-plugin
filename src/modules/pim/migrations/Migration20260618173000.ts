import { Migration } from '@medusajs/framework/mikro-orm/migrations'

export class Migration20260618173000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`DROP INDEX IF EXISTS "IDX_product_content_published_unique";`)
    this.addSql(`DROP INDEX IF EXISTS "IDX_product_content_active_status_unique";`)

    this.addSql(`
      DO $$
      DECLARE
        collision_count integer;
      BEGIN
        SELECT count(*)
        INTO collision_count
        FROM (
          SELECT
            product_id,
            CASE lower(locale)
              WHEN 'en' THEN 'en-US'
              WHEN 'fr' THEN 'fr-FR'
              WHEN 'es' THEN 'es-ES'
              ELSE locale
            END AS normalized_locale,
            channel,
            status
          FROM "product_content"
          WHERE deleted_at IS NULL
            AND status <> 'archived'
          GROUP BY product_id, normalized_locale, channel, status
          HAVING count(*) > 1
        ) collisions;

        IF collision_count > 0 THEN
          RAISE EXCEPTION 'PIM locale migration found % active content locale collision(s). Resolve duplicate product_id/locale/channel/status records before running this migration.', collision_count;
        END IF;
      END $$;
    `)

    this.addSql(`
      UPDATE "product_content"
      SET
        locale = CASE lower(locale)
          WHEN 'en' THEN 'en-US'
          WHEN 'fr' THEN 'fr-FR'
          WHEN 'es' THEN 'es-ES'
          ELSE locale
        END,
        updated_at = now()
      WHERE lower(locale) IN ('en', 'fr', 'es');
    `)

    this.addSql(`
      UPDATE "product_content_job"
      SET
        locale = CASE lower(locale)
          WHEN 'en' THEN 'en-US'
          WHEN 'fr' THEN 'fr-FR'
          WHEN 'es' THEN 'es-ES'
          ELSE locale
        END,
        updated_at = now()
      WHERE locale IS NOT NULL
        AND lower(locale) IN ('en', 'fr', 'es');
    `)

    this.addSql(`
      UPDATE "product_content_job"
      SET
        input_json = jsonb_set(
          input_json,
          '{source_locale}',
          to_jsonb(
            CASE lower(input_json->>'source_locale')
              WHEN 'en' THEN 'en-US'
              WHEN 'fr' THEN 'fr-FR'
              WHEN 'es' THEN 'es-ES'
              ELSE input_json->>'source_locale'
            END
          ),
          false
        ),
        updated_at = now()
      WHERE input_json ? 'source_locale'
        AND lower(input_json->>'source_locale') IN ('en', 'fr', 'es');
    `)

    this.addSql(`
      UPDATE "product_content_job"
      SET
        input_json = jsonb_set(
          input_json,
          '{target_locale}',
          to_jsonb(
            CASE lower(input_json->>'target_locale')
              WHEN 'en' THEN 'en-US'
              WHEN 'fr' THEN 'fr-FR'
              WHEN 'es' THEN 'es-ES'
              ELSE input_json->>'target_locale'
            END
          ),
          false
        ),
        updated_at = now()
      WHERE input_json ? 'target_locale'
        AND lower(input_json->>'target_locale') IN ('en', 'fr', 'es');
    `)

    this.addSql(`
      UPDATE "product_content_version"
      SET
        snapshot_json = jsonb_set(
          snapshot_json,
          '{locale}',
          to_jsonb(
            CASE lower(snapshot_json->>'locale')
              WHEN 'en' THEN 'en-US'
              WHEN 'fr' THEN 'fr-FR'
              WHEN 'es' THEN 'es-ES'
              ELSE snapshot_json->>'locale'
            END
          ),
          false
        ),
        updated_at = now()
      WHERE snapshot_json ? 'locale'
        AND lower(snapshot_json->>'locale') IN ('en', 'fr', 'es');
    `)

    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_product_content_active_status_unique" ON "product_content" ("product_id", "locale", "channel", "status") WHERE deleted_at IS NULL AND status <> 'archived';`,
    )
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_product_content_published_unique" ON "product_content" ("product_id", "locale", "channel") WHERE deleted_at IS NULL AND status = 'published';`,
    )
  }

  override async down(): Promise<void> {}
}
