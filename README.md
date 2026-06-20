# Medusa PIM Plugin

Medusa v2 plugin for lightweight Product Information Management: localized product copy, structured specifications, SEO fields, metadata schemas, AI generation jobs, and storefront content delivery.

> **Status:** This plugin is a work in progress. It is buggy, vibecoded, and not production-hardened. It is open source under MIT so people can fork it, fix it, simplify it, or build something better from it.

## Features

- Product content per product, locale, and channel.
- Fields for title, short description, description, bullet points, SEO, variant titles, specifications, and custom metadata.
- Strict canonical locale contract, for example `en-US`, `fr-FR`, and `es-ES`.
- Admin PIM page for content editing, AI settings, AI job review, and metadata field management.
- Optional OpenAI-compatible AI generation through environment config or encrypted admin-managed settings.
- Generic supplier import through the `pim.product_imported` event.
- Version snapshots for create, update, and publish actions.
- Publishing workflow that archives previous published records for the same product, locale, and channel.
- Storefront routes for single-product and batch published content lookup.
- Optional mirroring into Medusa's Translation Module when that module is registered.

## Installation

```bash
pnpm add @medusastore/medusa-plugin-pim
```

Register the plugin in `medusa-config.ts`:

```ts
{
  resolve: "@medusastore/medusa-plugin-pim",
  options: {},
}
```

Run Medusa migrations after installation:

```bash
pnpm medusa db:migrate
```

## Configuration

The plugin provides its own `pim` module. No extra provider registration is required.

AI generation requires one provider key:

- `PIM_AI_API_KEY`
- `OPENROUTER_API_KEY`
- `KILO_API_KEY`
- `KILOCODE_API_KEY`
- `OPENAI_API_KEY`

Admin-managed AI keys require:

- `PIM_AI_KEY_ENCRYPTION_KEY` - secret used to encrypt stored PIM AI keys at rest.

Optional values:

- `AI_GATEWAY_URL` - shared OpenAI-compatible gateway URL.
- `AI_GATEWAY_PROVIDER` - gateway provider route. Defaults to `openrouter`.
- `PIM_AI_PROVIDER` - provider name. Defaults to `openrouter`.
- `PIM_AI_BASE_URL` - provider base URL. Defaults to `https://openrouter.ai/api/v1`.
- `PIM_AI_MODEL` - model identifier. Defaults to `openai/gpt-4o-mini`.
- `PIM_AI_TEMPERATURE` - generation temperature. Defaults to `0.4`.
- `PIM_AI_MAX_TOKENS` - maximum response tokens. Defaults to `1200`.
- `PIM_AI_REQUEST_TIMEOUT_MS` - AI request timeout. Defaults to `30000`.
- `PIM_AI_HEADERS_JSON` - JSON object of extra headers for compatible gateways.
- `PIM_AI_GATEWAY_MODULE` - optional registered Medusa module name for a compatible AI gateway.
- `PIM_DEFAULT_CHANNEL` - content channel used when none is supplied. Defaults to `storefront`.

## Locale Contract

PIM only accepts canonical BCP 47 locale codes with a region, such as `en-US` or `fr-FR`. Short aliases like `en` and `fr` are rejected at API and import boundaries.

Store routes resolve locale in this order:

1. `locale` query parameter.
2. `x-medusa-locale` header.
3. Request locale when provided by Medusa.

The plugin does not silently default missing store locales to English.

## Translation Module

Publishing PIM content for the `storefront` or `default` channel can mirror native fields into Medusa's Translation Module:

- product `title`
- product `description`
- product `subtitle`
- variant `title`

This integration is optional. If the Translation Module is not registered, publishing still succeeds and the native translation mirror is skipped.

## Database

The plugin creates these tables:

- `product_content` - localized product content records per locale and channel.
- `product_content_version` - immutable content snapshots.
- `product_content_job` - AI generation job tracking.
- `product_metadata_field` - configurable metadata field definitions.

## Bootstrap

Seed default metadata field definitions:

```bash
npx medusa exec ./node_modules/@medusastore/medusa-plugin-pim/.medusa/server/src/scripts/bootstrap-pim.js
```

The bootstrap script is idempotent and skips existing fields.

## API Surface

Admin routes are authenticated.

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/admin/pim/content` | List content records. |
| `GET` | `/admin/pim/content/:id` | Retrieve one content record. |
| `DELETE` | `/admin/pim/content/:id` | Delete a content record. |
| `GET` | `/admin/pim/products/:id/content` | Get product content by locale and channel. |
| `POST` | `/admin/pim/products/:id/content` | Create or update draft content. |
| `POST` | `/admin/pim/products/:id/publish` | Publish a content record. |
| `POST` | `/admin/pim/products/:id/generate` | Trigger AI generation. |
| `POST` | `/admin/pim/products/:id/metadata` | Sync validated metadata to a draft. |
| `GET` | `/admin/pim/metadata-fields` | List metadata field definitions. |
| `POST` | `/admin/pim/metadata-fields` | Create a metadata field definition. |
| `GET` | `/admin/pim/metadata-fields/:id` | Retrieve a metadata field definition. |
| `POST` | `/admin/pim/metadata-fields/:id` | Update a metadata field definition. |
| `DELETE` | `/admin/pim/metadata-fields/:id` | Delete a metadata field definition. |
| `GET` | `/admin/pim/jobs` | List AI generation jobs. |
| `GET` | `/admin/pim/ai-settings` | Retrieve effective AI settings. |
| `POST` | `/admin/pim/ai-settings` | Save admin-managed AI settings. |

Store routes are public Medusa store routes.

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/store/products/:id/content` | Get published content for the request locale. |
| `POST` | `/store/pim/content/batch` | Batch fetch published content for multiple products in the request locale. |

## Import Event

External connectors should import supplier content by emitting `pim.product_imported`.

The payload should include:

- `product_id`
- `locale`
- `channel`
- `title`
- `description`
- `short_description`
- `bullets_json`
- `specifications_json`
- `seo_json`
- `custom_metadata_json`
- `supplier_id`
- `supplier_product_id`

The locale must follow the same canonical BCP 47 contract as the API.

## Admin UI

The plugin adds a `PIM` page to Medusa Admin with these tabs:

- `Product Content` - edit localized content, specifications, metadata, SEO, AI requests, drafts, and publishing.
- `AI Jobs` - review generated content before saving it to product content.
- `AI Settings` - configure provider, model, base URL, and encrypted API key storage.
- `Metadata Fields` - create, update, and delete reusable metadata schemas.

## Content Lifecycle

Content records move through:

```text
draft -> ai_generated -> reviewed -> published -> archived
```

Publishing archives previously published content for the same product, locale, and channel.

## Specification Format

```json
[
  {
    "key": "material",
    "label": "Material",
    "value": "Oak wood",
    "unit": "",
    "group": "Construction"
  },
  {
    "key": "weight",
    "label": "Weight",
    "value": "3.5",
    "unit": "kg",
    "group": "Dimensions"
  }
]
```

## Metadata Field Conventions

- `key` is the globally unique machine name.
- `scope` is `product`, `variant`, or `content`.
- `localized` controls whether values vary by locale.
- `channel_specific` controls whether values vary by channel.
- `write_policy` controls whether values are written by `admin`, `agent`, or `system`.

## Package Layout

Published packages include:

- `.medusa/server`
- `.env.example`
- `LICENSE`
- `README.md`
- `package.json`

Source files and development test files are not published in the npm package.

## Development

```bash
pnpm typecheck
pnpm build
pnpm pack --dry-run
```

The build command runs `medusa plugin:build`, TypeScript compilation, and package cleanup.

## License

MIT
