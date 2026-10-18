# Timeline Bot API

One HTTPS Cloud Function, `api` (region `europe-west2`, project `timelineapp-3bc05`).
After deploy the base URL is `https://europe-west2-timelineapp-3bc05.cloudfunctions.net/api`
(Cloud Functions v2 also gives a `https://api-<hash>-nw.a.run.app` URL; either works).

**Status:** deployed. Keys are made in the app: Settings → Connect a bot → Create bot key.

## Auth
Every request: `Authorization: Bearer <key>`.
- Firestore `botKeys/{sha256(key)}` → `{ uid, createdAt, lastUsedAt, revoked }`. Only the hash is stored.
- Unknown or revoked key → `401`. Each call updates `lastUsedAt`.
- Rate limit: 60 requests per minute per key → `429`.
- All reads and writes are limited to `users/{uid}` of the key's owner.

Errors are JSON: `{ "error": "message" }`.

## Event shape
Stored at `users/{uid}/events/{id}` exactly like the app's `saveEvent()`:

| Field | Notes |
|---|---|
| `id` | string, same format as the app (`Date.now()` + 6 random chars) |
| `title` | required on create |
| `description` | string, default `""` |
| `date` | ISO string; default now. Accepts `2026-10-18` or full ISO |
| `category` | `personal` (default), `work`, `family`, `health`, `travel`, `hobby`, `household`, `other`, or a custom category id |
| `source` | `manual` (default), `hobby`, `food`, … (drives the Timeline filters) |
| `hobbyType` | e.g. `poetry` (Poems filter = `source: hobby` + `hobbyType: poetry`) |
| `labels` | array of strings |
| `location`, `placeName`, `photoNote`, `imageUri`, `coverImageUri`, `nextAction`, `foodStatus`, `foodItems`, `collectionName`, `shareCaption`, `emailFrom`, `botNote` | optional |
| `createdAt`, `updatedAt` | ISO strings, set by the API |
| `ownerUid` | key owner's uid, set by the API |
| `addedBy` | always `"bot"` on bot-created events (marker for sorting / removing) |

Responses also include `appLink: "timelineapp://event/<id>"` and `webLink: null` (Hosting redirect comes later).

### Quick-reply `kind` (optional on create)
| kind | source | category | extra |
|---|---|---|---|
| `memory` | manual | personal | |
| `event` | manual | personal | |
| `poem` | hobby | hobby | hobbyType `poetry` |
| `food` | food | other | |
| `other` | manual | other | |

Explicit `source` / `category` override `kind`.

## Endpoints

### `POST /photos`
Upload one image (max 5 MB, `image/*`). Stored at `users/{uid}/events/{eventId}/imageUri.jpg`, the same path the app uses.
Send one of:
- JSON `{ "imageBase64": "<base64 or data: URL>", "contentType": "image/jpeg", "eventId": "optional" }`
- `multipart/form-data` with one file field (+ optional `eventId` field)
- raw body with `Content-Type: image/jpeg` (optional `?eventId=`)

`201` → `{ "eventId", "storagePath", "downloadUrl" }`. Pass `eventId` as `id` and `downloadUrl` as `imageUri` to `POST /events`.

### `POST /events`
```json
{ "title": "Beach day", "kind": "memory", "date": "2026-10-18", "description": "…",
  "labels": ["family"], "id": "<eventId from /photos>", "imageUri": "<downloadUrl>" }
```
Or attach the photo in the same call with `imageBase64` (+ `contentType`).
`201` → the stored event + `appLink` + `webLink`. `409` if `id` already exists.

### `GET /events?from=&to=&q=&label=&limit=`
- `from` / `to`: ISO dates (inclusive, on `date`)
- `q`: case-insensitive text match on title, description, location, placeName, photoNote, labels
- `label`: exact label (case-insensitive)
- `limit`: default 50, max 200. Newest first.

`200` → `{ "count", "events": [ … ] }`

### `GET /events/:id`
`200` → event + links, or `404`.

### `PATCH /events/:id`
Body: any of the optional fields above. `id`, `ownerUid`, `addedBy`, `createdAt` cannot be changed. Sets `updatedAt`.
`200` → the updated event + links.

## Key management (app only)
These use `Authorization: Bearer <Firebase ID token>` of the signed-in app user, not a bot key.
- `POST /keys/create { label }` → `201 { key, hash, label }`. Key = `tl_` + 32 random bytes (base64url), made on the server; only its SHA-256 is stored. Max 10 active keys.
- `POST /keys/list` → `{ keys: [{ hash, label, revoked, createdAt, lastUsedAt }] }`
- `POST /keys/revoke { hash }` → `{ hash, revoked: true }` (only your own keys)

## Example
```bash
curl -X POST "$BASE/events" -H "Authorization: Bearer $TIMELINE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"title":"Dentist","kind":"event","date":"2026-10-20T15:00:00Z"}'
```
