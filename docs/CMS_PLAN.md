# JSON page CMS — implementation and editor guide

Requested 2026-11-06. The user confirmed JSON content storage. Reuse the existing
PostgreSQL database, admin authentication, theme/components and Cloudinary account.
New table names/types below were initially approved on2026-11-06 for development.
Migration028 is applied on dev, with the existing homepage/About content initialized
as JSONB. The editor, renderer and development acceptance are complete. The user
subsequently authorized production publication and the required schema rehearsal;
release scope and verification are recorded in docs/CMS_RELEASE_2026-11-06.md.

## Editing experience

- Admin -> Pages: homepage, About Us and new custom pages, searchable by title.
- Visual section list: add, duplicate, remove, move up/down or drag to reorder;
  show/hide each section. Normal form fields; administrators need not write JSON.
- Edit text, buttons/links, photos and background appearance. Reuse the current
  homepage section designs and add reusable text, image/text, cards, FAQ and CTA
  sections for custom pages. Existing catalogue/review widgets keep their real data.
- Save Draft, admin-only preview, Publish, Unpublish and published revision restore.
  Restoring copies a revision into the draft and requires a separate Publish.
- SEO title/description and optional header/footer navigation entries live in JSON.
- Homepage/About start from the current content and appearance. The CMS does not
  replace search, booking, pricing, authentication or other operational routes.

## Approved tables — development only

### cms_pages

| Column | Type | Rules |
| --- | --- | --- |
| page_id | UUID | Primary key; default gen_random_uuid() |
| slug | VARCHAR(160) | Required, unique; lowercase letters/numbers/hyphens; `home` maps to `/`, `about` maps to `/about`; fixed after creation |
| title | VARCHAR(200) | Required admin page label |
| draft_content | JSONB | Required validated page document |
| published_content | JSONB | Nullable; last published document |
| status | VARCHAR(16) | Required, default `draft`; `draft` or `published` |
| version | INTEGER | Required, default 1; optimistic concurrency token, positive |
| published_at | TIMESTAMPTZ | Nullable |
| created_by | UUID | Nullable FK -> users.user_id |
| updated_by | UUID | Nullable FK -> users.user_id |
| created_at | TIMESTAMPTZ | Required, default now() |
| updated_at | TIMESTAMPTZ | Required, default now(); existing update trigger |
| is_deleted | BOOLEAN | Required, default false |
| is_active | BOOLEAN | Required, default true |

### cms_page_revisions

Published snapshots are append-only, like status history; no mutable audit/status
columns. Unique `(page_id, version)` prevents duplicate history entries.

| Column | Type | Rules |
| --- | --- | --- |
| revision_id | UUID | Primary key; default gen_random_uuid() |
| page_id | UUID | Required FK -> cms_pages.page_id, ON DELETE CASCADE |
| version | INTEGER | Required, positive; version of the publication |
| content | JSONB | Required validated published page document |
| created_by | UUID | Nullable FK -> users.user_id |
| created_at | TIMESTAMPTZ | Required, default now() |

Migration028 is applied on development and is immutable. No columns were added
to existing tables. Reuses `set_updated_at()` and `activity_logs`. The existing
development runtime role has page CRUD and SELECT/INSERT on revision history;
the application removes pages with a soft-delete, retaining their revisions.

## JSON document contract

The complete page is versioned JSON. Section order comes from the array, avoiding
separate section rows and conflicting order values. Each section has a stable ID.
Images are Cloudinary URLs and accessible alt text, not binary/base64 JSON blobs.

```json
{
  "schemaVersion": 1,
  "seo": { "title": "About Jagdamba Travellers", "description": "Travel with confidence." },
  "navigation": { "header": false, "footer": true, "label": "About Us", "order": 10 },
  "sections": [
    {
      "id": "intro",
      "type": "text",
      "visible": true,
      "appearance": { "background": "default", "imageUrl": "", "overlay": 50 },
      "content": { "eyebrow": "About us", "title": "Our story", "subtitle": "", "body": "Page copy goes here.", "items": [] }
    }
  ]
}
```

## Boundaries and acceptance

- Only admins can edit/preview/publish/upload. Public reads return only published,
  active, nondeleted snapshots; draft SEO/content/menu links remain private.
- Validate JSON shape, supported section types, field lengths, URL schemes,
  image origins and overall document size server-side. Render text/components;
  no executable HTML/JavaScript from JSON. Reserved application URLs cannot be
  claimed by custom pages. Homepage identity cannot be deleted/unpublished.
- Save/publish checks the last-read version and returns conflict on a stale edit.
  Publishing the snapshot and its revision is one database transaction.
- Real development acceptance: create draft -> preview -> publish -> public page;
  alter draft without changing public content -> publish; reorder/hide/image;
  unauthorized access, stale save, unpublish, revision restore and route conflicts.
- Compare the default homepage/About appearance, check desktop/mobile editor and
  preview, run typecheck/lint/relevant tests, and update MEMORY/plan/DEPLOY.

## Implementation order

1. JSON validation/defaults and reviewable schema; obtain table-name approval.
2. Persistence, admin APIs, publishing/revisions and guarded public routes.
3. Admin page/section editor, existing Cloudinary uploads, preview and navigation.
4. Connect homepage/About, verify the complete development flow and document it.

The scope is a page CMS using this site's design system. Third-party WordPress
plugins, arbitrary script embeds, blogging/comments, theme installation, scheduled
publication, translations and free-position canvas design are separate upgrades.

## Admin guide

1. Open `/admin/pages` (Pages / CMS in the admin sidebar). Choose **Edit page**
   for Homepage or About, or **Create page** for a new fixed address.
2. Start blank or use the About/Homepage layout. Choose a section on the left;
   edit its fields, upload a photo, or choose a background photograph and overlay.
   The existing catalogue, booking builder and reviews keep their live data.
3. Add or duplicate content sections, drag to reorder or use the arrow buttons,
   and use the eye button to hide/show a section. Keep at least one visible.
4. **Save draft** keeps edits private. Uploading an image also saves the current
   draft. **Preview** saves first and opens the same renderer visitors will see,
   with desktop/mobile views. Only signed-in administrators can open previews.
5. Set SEO text and optional menu entries under **Page settings**. **Publish**
   asks for confirmation, then copies the saved draft into the public snapshot.
   On localhost this publishes content to the development website only; it does
   not deploy the application or affect the production database.
6. **Revision history** restores an earlier publication into the draft. Preview
   and publish separately. Unpublishing hides the page and its menu entries.
   Homepage cannot be unpublished/removed; About cannot be removed.

If another editor changes the page, saving returns a conflict. Your local edits
remain in the form; **Reload saved page** explicitly discards them. Slugs stay
fixed after creation to prevent broken incoming links. Images remain in Cloudinary
when removed from a draft because an older publication/revision may still use them.

## Verification — 2026-11-06

- Nine JSON/navigation/upload-target validation test groups pass.
- Real Chrome -> API -> dev PostgreSQL/Cloudinary acceptance passes47 HTTP checks
  plus browser/DB assertions. Covers draft creation/editing, real image/background,
  order/visibility, private mobile preview, publish/cancel, public SEO/menu output,
  draft isolation, simultaneous saves, stale conflicts, publication rollback when
  history fails, revision restore, unpublish and soft removal. All ten homepage
  sections render from saved JSON. No successful-path mocks or external mail.
- Temporary pages, revisions, accounts, sessions, audit entries and the test image
  were cleaned up. Original homepage/About publication content was not changed by
  acceptance. The isolated test app was removed; regular localhost remains running.
- Desktop/mobile visual review, typecheck/lint/whitespace checks, optimized isolated
  Next build and development schema/checksums (28 migrations) pass.
- Production release is separately authorized; the existing production owner
  connection requires no new role grants. Development content is not copied by
  deployment. The JSON editor requires no further service key.
