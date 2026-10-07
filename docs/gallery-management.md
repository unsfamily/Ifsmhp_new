# Media Gallery Management

The administrator gallery, homepage gallery, and member gallery use the existing MySQL gallery models and shared disk file storage. There are no gallery sample arrays, generated image URLs, simulated uploads, or localStorage gallery persistence. Existing browser-local mock content is not imported.

## Setup and deployment

From the repository root:

```sh
npm --prefix backend ci
npm --prefix backend run db:generate
npm --prefix backend run db:deploy
npm --prefix backend run build
npm --prefix frontend run build
```

Restart the API after deployment. The migration extends existing tables and preserves existing metadata. It establishes deterministic collection/photo positions and timestamps, marks existing linked files as gallery-managed, and adds the metadata required by the UI. Existing records without a live image remain administratively visible but are excluded from public results. Development seeding no longer inserts gallery placeholders; **do not seed/reset an existing database to enable the gallery**.

`GALLERY_MAX_UPLOAD_MB` defaults to **100**, independently of the generic file upload limit. JPEG, PNG and WebP still images, MP4 (H.264 with optional AAC/MP3 audio), and WebM (VP8/VP9 with optional Opus/Vorbis audio) are supported. Video uses 8-bit 4:2:0 pixel formats; unsupported codecs are rejected with a file-specific 422 error. Animated/multipage images and malformed contents are rejected. The administrator UI reads its accepted formats and size limit from the API. The frontend upload timeout is ten minutes. A reverse proxy must allow a multipart body slightly larger than the configured file limit and a suitable upload timeout.

`UPLOAD_STORAGE_PATH` retains its existing meaning (relative to the backend working directory, or absolute). Persist this directory across restarts/deployments. Files are stored under random UUID keys, with original filenames, sizes, detected media dimensions, orientation-aware aspect, SHA-256 checksum and uploader saved in MySQL. Media files are not served through a static directory. Admin previews use authenticated blob URLs, which are revoked when the component or session changes. Public URLs recheck both collection and photo visibility on each request and use `no-store` caching.

The gallery has its own request budget, following the existing Community pattern, to accommodate one image request per photograph without exhausting unrelated API requests.

## Video uploads

Video uses the existing `POST /admin/gallery/photos` multipart endpoint and the same optional `title`, `caption`, and `subcategoryId` fields. Each batch captures these values and its category when files are selected. Uploads remain drafts. Responses now include `type` (`image` or `video`) and `mediaUrl`; `imageUrl` is retained for existing clients. Counts, filtering, publication, ordering, category/subcategory moves, audits, deletion restrictions and file cleanup apply equally to images and videos.

`GalleryItem.type`, `fileId`, `title`, `caption`, mapping fields, dimensions and timestamps already hold the required data. `FileObject` retains the original filename, storage key, MIME type, checksum and size. **No additional database migration or data conversion is required for video support.** Existing image records are unchanged.

Install backend dependencies with `npm --prefix backend ci` before building/restarting. The platform-specific FFprobe executable is installed through `@ffprobe-installer/ffprobe`; do not omit optional dependencies. Alternatively set `GALLERY_FFPROBE_PATH` to an executable system FFprobe path. Probing is limited to local MP4/WebM containers, bounded to 30 seconds and 1 MB of output, and checks container signatures, codecs, dimensions, duration and packet availability. Files are stored unchanged; this feature does not transcode or generate poster images. Re-export unsupported files using the formats above. Missing/broken video-validation infrastructure returns 503 rather than incorrectly reporting an unsupported codec; failed uploads remove temporary files.

`GET` and `HEAD /admin/gallery/photos/:id/media` require the existing active ADMIN session. The equivalent `/public/gallery/photos/:id/media` requires current photo and parent publication. The older `/image` paths remain aliases. Responses support byte ranges (206), unsatisfiable ranges (416), content lengths and browser seeking. Visibility is checked before streaming, and `no-store` prevents a cached public URL from bypassing later unpublishing. Admin previews retain authenticated blob loading; public/member videos stream directly with playback controls in the viewer.

When already in `backend/`, run `npm ci` and `npm run build`; use the `--prefix backend` commands only from the repository root. Restart the API after building, then retry previously failed uploads. Never reset or seed the application database for this change.

## API

All paths are relative to `/api/v1`; JSON responses use the existing success/error envelopes. Every administrator route requires an active ADMIN session. Lists accept `page` and `limit` (maximum 100) and return `{ items, pagination }`. Frontend lists consume every page, without adding pagination controls to the existing design.

| Method | Path | Behavior |
|---|---|---|
| GET | `/admin/gallery/options` | Size limit, MIME types and extensions |
| GET, POST | `/admin/gallery/categories` | Collections/counts; create collection |
| PATCH | `/admin/gallery/categories/visibility` | Atomically set visibility for the supplied collection IDs |
| PATCH, DELETE | `/admin/gallery/categories/:id` | Edit collection; delete with its photographs only when no subcategories exist |
| GET, POST | `/admin/gallery/subcategories` | List subcategories/counts (optional `categoryId` filter); create subcategory |
| PATCH, DELETE | `/admin/gallery/subcategories/:id` | Rename/change parent; delete only when no photographs reference it |
| POST | `/admin/gallery/categories/:id/reorder` | `{ direction: -1 or 1 }` |
| GET | `/admin/gallery/photos` | List, `categoryId`/`subcategoryId` filters and `search` across title/caption/alt text |
| POST | `/admin/gallery/photos` | Multipart `file`, `categoryId`, and optional `subcategoryId`, `title`, `caption`; creates a draft photograph |
| PATCH, DELETE | `/admin/gallery/photos/:id` | Edit metadata/move/publish or delete photograph |
| POST | `/admin/gallery/photos/:id/reorder` | Reorder within the collection |
| GET | `/admin/gallery/photos/:id/image` | Authenticated image preview |
| GET | `/public/gallery/categories` | Published collections, including empty collections, with visible photo counts |
| GET | `/public/gallery/subcategories` | Subcategories of published collections, including empty subcategories; optional `categoryId` filter and visible photo counts |
| GET | `/public/gallery/photos` | Published images and videos with live files in published collections |
| GET | `/public/gallery/photos/:id/image` | Public image, subject to current visibility |

Collection bodies use `name`, `description`, `published`, and optional `displayOrder`. Photo patches accept `title`, `caption`, `altText`, `categoryId`, `subcategoryId`, `published`, and `displayOrder`. Image bytes are immutable through metadata updates. Positions are one-based, and out-of-range positive positions are clamped to the end. A move without an explicit position appends to the destination. Unpublishing a collection retains each photo's individual publication setting.

The Gallery Collections **Visibility** header controls every collection in the fully loaded grid, across all API pages. It shows **All visible**, **None visible**, or **Some visible**; clicking a mixed or off toggle shows all, and clicking an on toggle hides all. Row toggles remain independent. The header is disabled for empty, loading, or failed lists and during saves. Success and error notices report saves; refresh errors appear separately. Visibility is saved to MySQL and survives page reloads.

Admin loading keeps the page shell and table columns stable. The first load uses five skeleton rows; returning to the page retains the last successful in-memory snapshot for the current admin session while revalidating. Categories, subcategories, media, and upload policy commit together after every page succeeds. Refreshing retains existing rows and scroll position; a transient failure keeps the last successful content with a Retry message. Session changes, logout, and denied admin access clear cached admin data. Identical media filters do not restart requests. Entering the gallery resets scroll immediately, without a scroll animation.

Run `npm --prefix backend run test:gallery:layout` with the frontend running (default `http://localhost:5173`, override `GALLERY_WEB_URL`) for deterministic layout checks. This test intercepts all API traffic, requires no database, and measures anchors, table columns, refresh height/scroll, pagination, session isolation, and desktop/mobile/reduced-motion navigation. It writes screenshots and measurements to `/private/tmp/ifsmhp-gallery-layout` (override `GALLERY_LAYOUT_OUTPUT`). The existing `test:gallery:browser` command verifies real backend persistence against a dedicated migrated database.

Bulk visibility accepts `{ categoryIds: string[], published: boolean }` with a nonempty list of IDs and no unknown fields. IDs are deduplicated. All IDs must exist or the request returns 404 without changes. The standard success envelope contains `{ items: GalleryCategory[], updatedCount: number }`, where items are the requested collections and updatedCount counts actual visibility changes. The operation is transactional, uses the existing collection locks/retries, and audits each changed collection with `GalleryCollectionUpdated`. Repeating the same state is a successful no-op. Only the captured IDs are affected; collection order, metadata, and individual photo publication settings are preserved. No migration is required.

Writes, moves and ordering are transactional, serialized through collection locks with deadlock retries, and audited. Names are trimmed and case-insensitively unique under the project's MySQL collation. Client-supplied file URLs, timestamps and IDs are not accepted as editable metadata.

The existing `/admin/gallery` and `/public/gallery` endpoints retain their previous response shapes; their visibility rules also exclude unpublished collections and unavailable files. Generic file downloads enforce gallery visibility too, including for uploaders. “Refresh” replaces the mock “Reset to defaults” action.

## Categories and subcategories

The Categories tab displays subcategories beneath their parent, with Add, Edit and Delete actions and photograph counts. A subcategory requires a trimmed name (1–191 characters) and an existing parent category. The same name is allowed in different categories; duplicates within a category are rejected case-insensitively, including concurrent requests. Parent selection is available on creation and editing. Subcategories sort alphabetically within the existing category order and inherit category visibility. The public homepage and member gallery both display categories with their subcategories nested beneath them. Published categories and their subcategories remain visible when empty, with an explicit no-photographs message. Category and dependent subcategory filters share the same hierarchy; direct category photos remain accessible. Draft categories and their children are excluded, and all public photo counts exclude unpublished or unavailable images.

`GalleryAlbum` remains the category table. `GallerySubcategory` has a required `categoryId` foreign key with restricted deletion and a unique `(categoryId, name)` constraint. `GalleryItem.subcategoryId` is nullable and also restricts deletion of referenced subcategories. The additive `20260930000000_gallery_subcategories` migration preserves existing rows and leaves existing photos assigned directly to their categories. Back up before deployment, then use the setup commands above to generate the client, deploy migrations, build and restart. Never reset or seed an existing database for this feature.

Subcategory create bodies are `{ name, categoryId }`; patches accept either or both fields. List responses use the standard pagination envelope and contain `id`, `categoryId`, `name`, `photoCount`, `createdAt`, and `updatedAt`. The admin frontend loads every page.

Uploads and photograph edits offer an optional subcategory dropdown restricted to the selected category. Each queued upload captures both assignments. Photo patches preserve an omitted subcategory when the category is unchanged, clear it on a category change without an explicit replacement, and clear it when `subcategoryId` is explicitly `null`. Uploads omit the multipart field for no assignment. Explicit mismatched category/subcategory pairs return 422; deleted/missing references return 404. Failed uploads remove temporary files. Admin and public photo filters accept a subcategory ID, `all` (no restriction), or `none` (category-only photos).

Changing a subcategory’s parent checks destination name uniqueness and atomically moves all assigned photographs to the destination category, appending them in their existing relative order and normalizing both category orders. Photo IDs, files, metadata and publication settings remain intact; public accessibility follows the new parent. Category counts include both direct photos and those assigned to subcategories. All mutations, including photo movements, remain transactional and audited.

## Optional upload name and description

The Upload Photos tab accepts optional **Name** (191 characters maximum) and **Description** (10,000 characters maximum). Enter these before selecting or dropping files. The same values apply to each photo in that selection, and remain in the form until changed. Each queued task captures its own title, caption and category/subcategory assignments; later changes to the form do not alter queued uploads. The queue continues to show the original filename.

Multipart `POST /admin/gallery/photos` accepts `title` and `caption` as optional strings. These persist in the existing `GalleryItem.title` and `GalleryItem.caption` columns, so no schema migration is required. Values are trimmed. A blank or omitted title uses the original filename without its extension (falling back to `Photograph`); a blank or omitted caption is stored as an empty string. Existing upload clients need no changes. Uploads still create draft photographs.

Both text fields are validated before database writes. Repeated/structured fields and values exceeding the character limits return 422 with field errors. The multipart byte limit is 40,000 bytes per field to accommodate valid Unicode descriptions; oversized text errors identify the field. Failed validation or rolled-back writes remove temporary files and do not stop subsequent queued uploads.

The photograph editor populates **Name (title)** and **Description (caption)** from the saved values. Its existing nonblank-title rule remains. The admin list, public/member cards, and viewer use the same saved title/caption fields; public visibility still requires both the photo and parent category to be published. Descriptions are rendered as plain text.

## Deletion and cleanup

Deleting a category with any subcategories returns 409, including when those subcategories are empty. Deleting a subcategory with photographs also returns 409. Move or remove the dependents first; the UI disables blocked delete actions and explains why. Deleting an empty subcategory never deletes photographs. Deleting a collection without subcategories retains the existing confirmed cascade to its photos, tags and banners. Deleted images immediately become inaccessible. Unreferenced file records receive a `deletedAt` tombstone; physical deletion happens after the transaction commits. Shared legacy files are retained while referenced. Successful disk cleanup sets `purgedAt`.

A failed physical cleanup is logged with its file ID and remains queued in the database. Subsequent gallery deletions retry pending cleanup, or operations can run:

```sh
npm --prefix backend run gallery:purge
```

Failed validation and rolled-back uploads remove their temporary files. The upload queue retains per-file errors, continues to later tasks, and marks success only after the API commits. Network failures during edits keep the dialog and entered values intact.

## Verification

Use a **dedicated test MySQL database** and temporary upload directory. Some existing backend suites modify seeded data, so never run them against a production or everyday development database.

```sh
# Export DATABASE_URL for a dedicated test database first.
npm --prefix backend run db:deploy
npm --prefix backend run db:seed
NODE_ENV=test UPLOAD_STORAGE_PATH=/private/tmp/ifsmhp-gallery-test-uploads npm --prefix backend test
```

`backend/tests/gallery-workflow.test.ts` exercises real sessions, MySQL transactions and disk storage: CRUD, ordering, duplicate validation, concurrent writes, supported formats, malformed uploads, 100 MB limit, publication revocation through both image/download URLs, search/filter/pagination beyond 100 records, cascades, shared files, rollback and cleanup retry.

For browser verification, run an API and frontend against that same isolated database. Build the backend first. Set `GALLERY_API_URL`, `GALLERY_WEB_URL`, `DATABASE_URL`, `UPLOAD_STORAGE_PATH`, and optionally `PLAYWRIGHT_MODULE_PATH`, `CHROME_PATH`, and `GALLERY_SCREENSHOT_DIR`, then run:

```sh
NODE_ENV=test npm --prefix backend run test:gallery:browser
```

The browser test creates namespaced admin/member users and images and removes them afterward. It covers collection creation/order; multiple real uploads; metadata editing, failed-save recovery and publishing; search/filter/moves; persistence after reload; public/member visibility; desktop/mobile layouts; invalid/failed upload recovery; list-error retry; loading more than 100 photos; photo deletion and collection cascades. Screenshots and `results.json` default to `/private/tmp/ifsmhp-gallery-browser`.

Local verification on 2026-09-22: all 11 browser scenario groups passed, with screenshots and no JavaScript errors. All 370 backend tests across 21 suites passed. Frontend/backend typechecks and builds passed. Lint had no errors; two pre-existing hook-dependency warnings remain in the unrelated Messages pages. The frontend build retains its existing large-bundle warning.

The migration was also applied to the configured local `ifsmhp_platform` database after backing up gallery metadata to `/private/tmp/ifsmhp-gallery-before-migration-20260922.json`. Every pre-existing gallery record and field was compared after migration and preserved.

Subcategory verification extends the same integration and browser suites with required-field/parent validation, scoped duplicate names, optional assignment and clearing, mismatched/stale uploads, atomic parent changes and rollback, restricted deletion, concurrent writes, audit records, pagination beyond 100 subcategories, nested desktop/mobile UI, and failed-save recovery. Migration verification compares all pre-existing gallery fields before and after applying the additive migration in an isolated database.

Verification on 2026-09-30: all 50 gallery/audit integration tests passed with audit-contract checks enabled, and all 12 gallery browser scenario groups passed without JavaScript errors. Prisma validation, frontend/backend typechecks and builds, and lint completed successfully (the two existing Messages hook warnings and frontend bundle-size warning remain). The subcategory migration was verified on a disposable local MySQL instance, including preservation of pre-existing gallery fields; that verification did not modify the configured application database.

The member/public hierarchy fix adds `/public/gallery/subcategories` and loads every page alongside public categories and photographs. Child groups and lightbox navigation follow the displayed order; lightboxes track photo IDs so refreshes and reordering cannot silently open a different photo. No additional database migration is needed for this rendering fix.

Public/member hierarchy verification on 2026-09-30: all 52 gallery/audit integration tests and all 13 browser scenario groups passed, including empty groups, parent-scoped subcategories, public pagination, visible-only counts, filtering, lightbox ordering, reparenting, and desktop/mobile layouts. Browser JavaScript errors: none. Frontend/backend builds, typechecks and lint passed with the previously documented warnings.

Optional upload metadata verification on 2026-09-30: all 66 gallery/audit integration tests and all 14 gallery browser scenario groups passed. Coverage includes both/one/neither field, whitespace, Unicode limits, malformed/repeated values, multipart limits, rollback and cleanup, shared batch metadata, original filenames, category/subcategory preservation, edit/reload persistence, and public/member details. Browser JavaScript errors: none. Frontend/backend typechecks, builds and lint passed with the previously documented warnings.

Video verification on 2026-10-03: 71 gallery/audit integration tests, 40 administrator-profile regressions, and 15 gallery browser scenario groups passed against isolated MySQL and upload storage. Real H.264/AAC MP4 and VP9/Opus WebM fixtures cover upload, metadata, category/subcategory mapping, editing, publication, public/member playback and seeking. The probe regression specifically verifies `stream_side_data_list`; using the invalid `stream_side_data` selector caused valid files to receive a misleading codec error. Backend/frontend builds, typechecks, lint, Prisma validation and client generation passed. Two existing Messages hook warnings and the frontend bundle-size warning remain. No application data was reset or seeded.
