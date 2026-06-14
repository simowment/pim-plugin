# Medusa PIM Plugin

Medusa v2 plugin for lightweight Product Information Management (PIM) — product content enrichment, localization, structured specifications, SEO, metadata field management, and AI-powered content generation.

## Features

- Multi-locale product content management per product with locale+channel granularity (title, description, short description, bullet points).
- Structured specification engine with typed key/value/unit/group schemas.
- SEO metadata management (title, description, keywords) per locale/channel.
- Custom metadata field definitions with configurable types (string, text, number, boolean, select, multiselect, json, url), scopes (product, variant, content), write policies, and per-field visibility flags.
- AI-powered content generation modes: translate, rewrite, extract_specs, seo, and full, with configurable tone (neutral, luxury, technical, seo) and provider (OpenRouter, Kilocode, or any OpenAI-compatible API).
- Content versioning — every create/update/publish snapshots the full record with actor metadata and change reason.
- Content publishing workflow with automatic archival of previous published versions.
- Versioned job tracking for AI generation requests with status lifecycle (queued → running → completed/failed).
- Admin dashboard with dedicated PIM page — product content editor, AI job overview, and metadata field definition management.
- Storefront API routes for serving published localized content with Medusa native fallback.
- Batch content retrieval for storefront listing pages.
- Bootstrap script to seed default metadata field definitions (material, style, room, care instructions, etc.).

## Installation

Add the plugin to your Medusa project:

```bash
# pnpm
pnpm add @medusastore/medusa-plugin-pim

# npm
npm install @medusastore/medusa-plugin-pim

# bun
bun add @medusastore/medusa-plugin-pim
```

For local development, install from a local checkout path instead.

## Configuration

Register the plugin in `medusa-config.ts`:

```ts
{
  resolve: '@medusastore/medusa-plugin-pim',
  options: {},
}
```

The plugin provides its own module (`pim`) — no additional provider registration is required.

## Environment variables

Copy `.env.example` and fill in your values.

Required for AI content generation:

- `PIM_AI_API_KEY` — API key for the AI provider (alternatively `OPENROUTER_API_KEY` or `KILOCODE_API_KEY`).

Common optional values:

- `PIM_AI_PROVIDER` — AI provider name (default: `openrouter`).
- `PIM_AI_BASE_URL` — Base URL for AI API (default: `https://openrouter.ai/api/v1`, alternatively `AI_GATEWAY_URL`).
- `PIM_AI_MODEL` — Model identifier (default: `openai/gpt-4o-mini`, alternatively `AI_MODEL`).
- `PIM_AI_TEMPERATURE` — Generation temperature (default: `0.4`).
- `PIM_AI_MAX_TOKENS` — Maximum response tokens (default: `1200`).
- `PIM_AI_REQUEST_TIMEOUT_MS` — AI request timeout in milliseconds (default: `30000`).
- `PIM_AI_HEADERS_JSON` — Optional JSON object of extra headers for OpenAI-compatible gateways.
- `PIM_AI_GATEWAY_MODULE` — Optional Medusa module registration name for a compatible runtime AI gateway (defaults to probing `pimAi` and `aiGateway`).
- `PIM_DEFAULT_CHANNEL` — Content channel used when none is specified (default: `storefront`).

Runtime AI settings in the admin UI are read from `PIM_AI_*` environment variables by default. If your Medusa project registers a compatible AI gateway service, the settings form becomes writable; otherwise it is read-only and generation still works from environment configuration.

## Database

Run migrations after installing or changing plugin models.

```bash
pnpm medusa db:migrate
```

The plugin creates four tables:

- `product_content` — Localized product content records per locale/channel.
- `product_content_version` — Immutable version snapshots of content records.
- `product_content_job` — AI generation job tracking with status lifecycle.
- `product_metadata_field` — Configurable metadata field definitions.

### Bootstrap (optional)

Seed default metadata field definitions (material, style, room, care instructions, etc.):

```bash
npx medusa exec ./node_modules/@medusastore/medusa-plugin-pim/.medusa/server/scripts/bootstrap-pim.js
```

Safe to run multiple times — skips existing fields.

## API surface

### Admin routes (authenticated)

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/admin/pim/content` | List content records (filterable by `product_id`, `locale`, `status`, `channel`) |
| `GET` | `/admin/pim/content/:id` | Retrieve a single content record |
| `DELETE` | `/admin/pim/content/:id` | Archive (soft-delete) a content record |
| `GET` | `/admin/pim/products/:id/content` | Get content for a product by `locale` and `channel` |
| `POST` | `/admin/pim/products/:id/content` | Create or update draft content (title, description, short_description, bullets_json, specifications_json, seo_json, custom_metadata_json) |
| `POST` | `/admin/pim/products/:id/publish` | Publish a content record (archives previous published version) |
| `POST` | `/admin/pim/products/:id/generate` | Trigger AI generation (translate, rewrite, extract_specs, seo, full) |
| `POST` | `/admin/pim/products/:id/metadata` | Sync validated metadata to a content draft |
| `GET` | `/admin/pim/metadata-fields` | List all metadata field definitions |
| `POST` | `/admin/pim/metadata-fields` | Create a metadata field definition |
| `GET` | `/admin/pim/metadata-fields/:id` | Get a metadata field definition |
| `POST` | `/admin/pim/metadata-fields/:id` | Update a metadata field definition |
| `DELETE` | `/admin/pim/metadata-fields/:id` | Delete a metadata field definition |

### Store routes (public)

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/store/products/:id/content` | Get published content for a product by locale (falls back to Medusa native product fields) |
| `POST` | `/store/pim/content/batch` | Batch fetch published content for multiple products in a single locale |

## Admin usage

After registration, open the Medusa Admin and navigate to the **PIM** page. The interface is organized in three tabs:

- **Product Content** — Select a product, choose a locale and channel, edit enriched fields (title, description, SEO), save drafts, trigger AI translation from English, and publish.
- **AI Jobs** — Overview of generated content records awaiting review.
- **Metadata Fields** — Define reusable metadata schemas (key, label, type, scope, visibility) and delete existing fields.

## Data model

### Content lifecycle

Content records progress through `draft` → `ai_generated` → `reviewed` → `published` → `archived`. Only drafts and AI-generated content can be edited. Publishing automatically archives any previously published record for the same product/locale/channel pair.

### Specification format

Specifications are stored as a JSON array of objects:

```json
[
  { "key": "material", "label": "Material", "value": "Oak wood", "unit": "", "group": "Construction" },
  { "key": "weight", "label": "Weight", "value": "3.5", "unit": "kg", "group": "Dimensions" }
]
```

### Attribute schema conventions

Metadata fields define reusable typed attributes. Key conventions:

- `key` — Machine name (snake_case), globally unique.
- `scope` — Determines where the field applies: `product`, `variant`, or `content` (PIM-managed).
- `localized` — When true, values vary per locale.
- `channel_specific` — When true, values vary per channel.
- `write_policy` — Controls who can set values: `admin`, `agent`, or `system`.

## Project structure

```text
src/
├── __tests__/             # Unit test setup
├── admin/
│   ├── lib/               # SDK client (Medusa JS SDK)
│   └── routes/
│       └── pim/           # PIM admin page (3-tab interface)
├── api/
│   ├── admin/
│   │   └── pim/           # Admin API routes (content, metadata-fields, products CRUD)
│   ├── store/
│   │   ├── pim/           # Store API routes (batch content)
│   │   └── products/      # Store product content routes
│   └── middlewares.ts      # Zod validation schemas + middleware registration
├── modules/
│   └── pim/               # PIM module (models, service, migrations)
├── scripts/
│   └── bootstrap-pim.ts   # Idempotent metadata field seeder
├── tests/                 # Integration/smoke tests (AI gateway, content resolution, metadata validation)
└── workflows/
    ├── steps/             # Workflow steps (CRUD, publish, AI generation, metadata sync)
    ├── create-or-update-product-content.ts
    ├── generate-product-content.ts
    ├── publish-product-content.ts
    └── sync-product-metadata.ts
```

## Notes

- Each content record is uniquely identified by `(product_id, locale, channel)` — a product can have independent content per locale and per channel (e.g., storefront, Google, Meta).
- The AI generation workflow uses OpenRouter by default (OpenAI-compatible). API keys are resolved server-side from environment variables and never reach the client.
- Storefront routes return published content only and include a fallback to Medusa's native product fields when no PIM content exists.
- Metadata field keys must be defined in `product_metadata_field` before being written via the `/metadata` endpoint (or pass `allow_unknown_keys: true` to bypass).
- Content versions are immutable snapshots created on every save and publish, enabling audit trails and rollback capability.

## License

MIT
