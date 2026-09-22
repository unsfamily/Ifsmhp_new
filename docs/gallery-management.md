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

`GALLERY_MAX_UPLOAD_MB` defaults to **100**, independently of the generic file upload limit. JPEG, PNG and WebP still images are supported. Animated/multipage images and malformed contents are rejected. The administrator UI reads its accepted formats and size limit from the API. The frontend upload timeout is ten minutes. A reverse proxy must allow a multipart body slightly larger than the configured file limit and a suitable upload timeout.

`UPLOAD_STORAGE_PATH` retains its existing meaning (relative to the backend working directory, or absolute). Persist this directory across restarts/deployments. Files are stored under random UUID keys, with original filenames, sizes, detected image dimensions, orientation-aware aspect, SHA-256 checksum and uploader saved in MySQL. Image files are not served through a static directory. Admin previews use authenticated blob URLs, which are revoked when the component or session changes. Public URLs recheck both collection and photo visibility on each request and use `no-store` caching.

The gallery has its own request budget, following the existing Community pattern, to accommodate one image request per photograph without exhausting unrelated API requests.

## API

All paths are relative to `/api/v1`; JSON responses use the existing success/error envelopes. Every administrator route requires an active ADMIN session. Lists accept `page` and `limit` (maximum 100) and return `{ items, pagination }`. Frontend lists consume every page, without adding pagination controls to the existing design.

| Method | Path | Behavior |
|---|---|---|
| GET | `/admin/gallery/options` | Size limit, MIME types and extensions |
| GET, POST | `/admin/gallery/categories` | Collections/counts; create collection |
| PATCH, DELETE | `/admin/gallery/categories/:id` | Edit or delete collection and its photographs |
| POST | `/admin/gallery/categories/:id/reorder` | `{ direction: -1 or 1 }` |
| GET | `/admin/gallery/photos` | List, `categoryId` filter and `search` across title/caption/alt text |
| POST | `/admin/gallery/photos` | Multipart `file` and `categoryId`; creates a draft photograph |
| PATCH, DELETE | `/admin/gallery/photos/:id` | Edit metadata/move/publish or delete photograph |
| POST | `/admin/gallery/photos/:id/reorder` | Reorder within the collection |
| GET | `/admin/gallery/photos/:id/image` | Authenticated image preview |
| GET | `/public/gallery/categories` | Published collections with visible photo counts |
| GET | `/public/gallery/photos` | Published photos with live image files in published collections |
| GET | `/public/gallery/photos/:id/image` | Public image, subject to current visibility |

Collection bodies use `name`, `description`, `published`, and optional `displayOrder`. Photo patches accept `title`, `caption`, `altText`, `categoryId`, `published`, and `displayOrder`. Image bytes are immutable through metadata updates. Positions are one-based, and out-of-range positive positions are clamped to the end. A move without an explicit position appends to the destination. Unpublishing a collection retains each photo's individual publication setting.

Writes, moves and ordering are transactional, serialized through collection locks with deadlock retries, and audited. Names are trimmed and case-insensitively unique under the project's MySQL collation. Client-supplied file URLs, timestamps and IDs are not accepted as editable metadata.

The existing `/admin/gallery` and `/public/gallery` endpoints retain their previous response shapes; their visibility rules also exclude unpublished collections and unavailable files. Generic file downloads enforce gallery visibility too, including for uploaders. “Refresh” replaces the mock “Reset to defaults” action.

## Deletion and cleanup

Deleting a collection cascades to its photos, tags and banners. Deleted images immediately become inaccessible. Unreferenced file records receive a `deletedAt` tombstone; physical deletion happens after the transaction commits. Shared legacy files are retained while referenced. Successful disk cleanup sets `purgedAt`.

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
