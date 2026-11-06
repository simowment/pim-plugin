# Medusa PIM Plugin

Medusa v2 plugin for lightweight Product Information Management: localized product copy, structured specifications, SEO fields, metadata schemas, optional AI generation jobs, and storefront content delivery.

> **Status:** work in progress, not production-hardened. It is MIT licensed so you can fork it, fix it, simplify it, or build something better from it.

## Overview / Features

- Product content per product, locale, and channel.
- Fields for title, short description, description, bullet points, SEO, variant titles, specifications, and custom metadata.
- Strict canonical locale contract, for example `en-US`, `fr-FR`, and `es-ES`.
- Admin PIM page for content editing, AI settings, AI job review, and metadata field management.
- Optional AI generation with the built-in OpenRouter, OpenAI, or Kilo providers, configured through plugin options, environment variables, or encrypted admin-managed settings.
- Generic supplier import through the `pim.product_imported` event.
- Version snapshots for create, update, and publish actions.
- Publishing workflow that archives previous published records for the same product, locale, and channel.
- Storefront routes for single-product and batch published content lookup.
- Optional mirroring into Medusa's Translation Module when that module is registered.

## Compatibility

- Medusa `2.21.2` (`@medusajs/framework`, `@medusajs/medusa`, `@medusajs/admin-sdk` peer dependencies).
- Node.js `>=20.19.0`.

## Installation

```bash
npm install @medusastore/medusa-plugin-pim
# or: pnpm add @medusastore/medusa-plugin-pim
```

Register the plugin in `medusa-config.ts`:

```ts
module.exports = defineConfig({
  // ...
  plugins: [
    {
      resolve: "@medusastore/medusa-plugin-pim",
      options: {
        default_channel: "storefront",
        locales: ["en-US", "de-DE"],
        default_locale: "en-US",
        // ai: { provider: "openrouter", api_key: process.env.PIM_AI_API_KEY },
      },
    },
  ],
})
```

All options are optional. Every option falls back to an environment variable (where one exists) and then to the default listed below. If you register the `pim` module yourself under `modules`, pass the same object as that module's `options`.

## Configuration

| Option | Env fallback | Default | Description |
| --- | --- | --- | --- |
| `default_channel` | `PIM_DEFAULT_CHANNEL` | `storefront` | Channel used when a request, import or workflow does not name one. |
| `channels` | - | `["storefront", "default", "google", "meta"]` | Channels offered in the admin UI and searched by the store batch route (the default channel is always included). |
| `locales` | - | `["en-US", "fr-FR", "es-ES"]` | Locales offered in the admin editor. Must be canonical BCP 47 codes with a region. Does not restrict the API. |
| `default_locale` | `PIM_DEFAULT_LOCALE` | `en-US` | Locale selected when the admin editor opens. Falls back to the first `locales` entry if not in the list. |
| `translation_channels` | - | `[default_channel, "default"]` | Channels whose published content is mirrored into the Medusa Translation Module. |
| `ai.provider` | `PIM_AI_PROVIDER` | `openrouter` | One of `openrouter`, `openai`, `kilo`, `kilocode`. |
| `ai.api_key` | `PIM_AI_API_KEY` | unset | Provider API key. Without a key (here, in admin settings or from a gateway), AI generation jobs fail with a clear message; nothing else is affected. |
| `ai.base_url` | `PIM_AI_BASE_URL` | provider's built-in URL | Must equal the selected provider's URL (`https://openrouter.ai/api/v1`, `https://api.openai.com/v1`, `https://api.kilo.ai/api/gateway`). Custom URLs are rejected so keys are never sent to arbitrary hosts. |
| `ai.model` | `PIM_AI_MODEL` | `openai/gpt-4o-mini` (OpenRouter), `gpt-4o-mini` (OpenAI), `kilo-auto/balanced` (Kilo) | Model identifier. |
| `ai.temperature` | `PIM_AI_TEMPERATURE` | `0.4` | Generation temperature (0-2). |
| `ai.max_tokens` | `PIM_AI_MAX_TOKENS` | `8192` | Maximum response tokens. |
| `ai.request_timeout_ms` | `PIM_AI_REQUEST_TIMEOUT_MS` | `120000` | AI request timeout. |
| `ai.headers` | `PIM_AI_HEADERS_JSON` (JSON object) | `{}` | Extra headers sent to the provider; layered on top of gateway or admin-saved headers. |
| `ai.gateway_module` | `PIM_AI_GATEWAY_MODULE` | unset | Name of a registered Medusa module exposing `getProviderConfig()` / `setProviderConfig()`. When set, provider, key, URL and model come from that module (still restricted to the built-in providers). |
| `ai.key_encryption_key` | `PIM_AI_KEY_ENCRYPTION_KEY` | unset | Secret used to encrypt API keys saved from the admin AI Settings tab (AES-256-GCM). Required only to save or read admin-managed keys. |

AI provider resolution order at runtime: gateway module (if configured) -> admin-saved settings (if any) -> plugin options -> environment variables -> defaults. Generation parameters (`temperature`, `max_tokens`, `request_timeout_ms`) always come from options / env.

See `.env.example` in the repository for the environment variable names.

## Database / Migrations

The plugin ships its own `pim` module with these tables:

- `product_content` - localized product content records per locale and channel.
- `product_content_version` - immutable content snapshots.
- `product_content_job` - AI generation job tracking.
- `product_metadata_field` - configurable metadata field definitions.
- `pim_ai_setting` - admin-managed AI provider settings (API key stored encrypted).

Run migrations after installing or upgrading:

```bash
npx medusa db:migrate
```

### Bootstrap

Optionally seed a generic set of metadata field definitions (material, style, room, care instructions, supplier source fields, Google product category, compliance warning):

```bash
npx medusa exec ./node_modules/@medusastore/medusa-plugin-pim/.medusa/server/src/scripts/bootstrap-pim.js
```

The bootstrap script is idempotent and skips existing fields.

## API Routes

Admin routes (`/admin/pim/*`) require an authenticated admin user (session, bearer token or secret API key).

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/admin/pim/config` | Effective channels, default channel, locales and default locale for the admin UI. |
| `GET` | `/admin/pim/content` | List content records. |
| `GET` | `/admin/pim/content/:id` | Retrieve one content record. |
| `DELETE` | `/admin/pim/content/:id` | Delete a content record. |
| `GET` | `/admin/pim/products/:id/content` | Get product content by locale and channel. |
| `POST` | `/admin/pim/products/:id/content` | Create or update draft content. |
| `POST` | `/admin/pim/products/:id/publish` | Publish a content record. |
| `POST` | `/admin/pim/products/:id/generate` | Trigger AI generation (calls the AI provider). |
| `POST` | `/admin/pim/products/:id/metadata` | Sync validated metadata to a draft. |
| `GET` | `/admin/pim/metadata-fields` | List metadata field definitions. |
| `POST` | `/admin/pim/metadata-fields` | Create a metadata field definition. |
| `GET` | `/admin/pim/metadata-fields/:id` | Retrieve a metadata field definition. |
| `POST` | `/admin/pim/metadata-fields/:id` | Update a metadata field definition. |
| `DELETE` | `/admin/pim/metadata-fields/:id` | Delete a metadata field definition. |
| `GET` | `/admin/pim/jobs` | List AI generation jobs. |
| `GET` | `/admin/pim/ai-settings` | Retrieve effective AI settings (API key masked). |
| `POST` | `/admin/pim/ai-settings` | Save admin-managed AI settings. |
| `GET` | `/admin/pim/ai-settings/models` | List available models from the Kilo gateway (Kilo providers only). |

Store routes are regular Medusa store routes (subject to Medusa's publishable API key requirement).

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/store/products/:id/content` | Published content for the request locale; falls back to the default channel, then `default`. |
| `POST` | `/store/pim/content/batch` | Published content for up to 50 `product_ids` in the request locale. |

### AI Generation Payload (`POST /admin/pim/products/:id/generate`)

- `target_locale` (required, canonical BCP 47 code with region, e.g. `fr-FR`).
- `source_locale` (optional, defaults to `target_locale`; must differ from `target_locale` when `mode` is `translate`).
- `channel` (optional, defaults to the configured default channel).
- `mode` (required, one of `translate`, `rewrite`, `extract_specs`, `seo`, `full`).
- `tone` (optional, one of `neutral`, `luxury`, `technical`, `seo`).
- `content_scope` (optional, one of `full`, `copy_specs`).
- `translate_fields` (optional array of `title`, `description`, `short_description`, `specifications`; used with `mode: translate`).
- `save_as` (optional, one of `draft`, `job_only`).

## Admin UI

The plugin adds a `PIM` route to Medusa Admin with these tabs:

- `Product Content` - edit localized content, specifications, metadata, SEO, AI requests, drafts, and publishing.
- `AI Jobs` - review generated content before saving it to product content.
- `AI Settings` - configure provider, model, resolved built-in base URL, and encrypted API key storage.
- `Metadata Fields` - create, update, and delete reusable metadata schemas.

No admin widgets are injected into core pages.

## Events, Subscribers & Scheduled Jobs

- Subscriber on `pim.product_imported`: creates or updates a draft content record from the event payload. Emit this event from your own supplier connector; nothing is emitted by the plugin itself. Payload fields: `product_id`, `locale`, `channel`, `title`, `description`, `short_description`, `bullets_json`, `specifications_json`, `seo_json`, `custom_metadata_json`, `supplier_id`, `supplier_product_id`. The locale must follow the canonical BCP 47 contract. To disable, simply do not emit the event.
- No scheduled jobs. AI generation only runs when an admin calls the generate route.

## Storefront Integration

Store routes resolve the locale in this order:

1. `locale` query parameter.
2. `x-medusa-locale` header (blank values are ignored).
3. Request locale when provided by Medusa.

Only canonical locales with a region (`en-US`, not `en`) are accepted; the plugin does not silently default missing store locales. Pass `channel` to read channel-specific content; otherwise the default channel is used, with `default` as a fallback.

When the Medusa Translation Module is registered, publishing content for one of the `translation_channels` also mirrors product `title`, `description`, `subtitle` and variant `title` into it, so the native product API can serve translations. If the module is not registered, publishing still succeeds and the mirror is skipped.

## Content Lifecycle

Content records move through:

```text
draft -> reviewed -> published -> archived
```

Publishing archives previously published content for the same product, locale, and channel.

## Content JSON Formats

Draft copy and AI-generated outputs are strictly validated against a structured JSON schema:

### Variant Titles (`variant_titles_json`)

Overrides variant titles for specific locales. The list must only contain actual variant IDs belonging to the product in Medusa.

```json
[
  {
    "variant_id": "variant_123",
    "title": "Oak Wood"
  }
]
```

### Bullets (`bullets_json`)

```json
[
  {
    "label": "Material",
    "text": "Premium solid oak wood"
  }
]
```

### Specification Format (`specifications_json`)

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

### SEO (`seo_json`)

```json
{
  "title": "Solid Oak Dining Table",
  "description": "Handcrafted solid oak dining table.",
  "keywords": ["dining table", "oak wood", "handmade"]
}
```

## Metadata Field Conventions

- `key` is the globally unique machine name.
- `scope` is `product`, `variant`, or `content`.
- `localized` controls whether values vary by locale.
- `channel_specific` controls whether values vary by channel.
- `write_policy` controls whether values are written by `admin`, `agent`, or `system`.
- `required` enforces that the metadata value is present and non-empty.
- `options_json` enforces values from a predefined list of allowed options (e.g. `[{"value": "red"}, {"value": "blue"}]`).

## Security Notes

- All `/admin/pim/*` routes require admin authentication.
- AI API keys are never returned by the API; only a masked preview is shown.
- Admin-saved API keys are encrypted at rest with `ai.key_encryption_key` / `PIM_AI_KEY_ENCRYPTION_KEY`. Keep that secret out of source control; rotating it makes stored keys unreadable until they are re-saved.
- AI base URLs are pinned to the built-in providers to avoid leaking keys to untrusted hosts.
- Product content sent to the AI provider leaves your infrastructure; review your provider's data policy.

## Limitations / Status

- Work in progress; APIs and schemas may change.
- Only OpenRouter, OpenAI and Kilo are supported as AI providers.
- `locales` only configures the admin editor; the API accepts any canonical locale.
- Channels are free-form strings; there is no link to Medusa sales channels.

## Development

```bash
pnpm typecheck
pnpm build
pnpm pack --dry-run
```

The build command runs `medusa plugin:build`, TypeScript compilation, and package cleanup. Published packages include `.medusa/server`, `LICENSE` and `README.md`.

## License

MIT
