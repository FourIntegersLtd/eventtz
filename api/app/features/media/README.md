# media

## Purpose

Signed-in users upload files (profile and listing photos, portfolio videos,
certificates) to public storage and get back a link to save on their profile,
listing or message. This slice only stores files; the slice that saves the
link decides what it is for.

## Use cases

- As a **client, vendor or staff member**, I **upload an image** so that I can
  use it as a photo anywhere in the app.
- As a **vendor**, I **upload a portfolio video or a certificate PDF** (food
  hygiene, insurance) so that I can show it on my profile.

## Invariants

- Uploads need a signed-in user; every object key sits under `users/<user id>/`,
  so one user's files never overwrite another's.
- Object keys are `users/<user id>/<images|files>/<random hex><.ext>`: never
  reused, so an hour of public caching is safe.
- `/media/images` takes `image/*`, or an untyped file whose name ends in an image
  extension (its type is then guessed from the extension). `/media/files` takes
  `image/*`, `video/*` and `application/pdf` by declared type only.
- `/media/images` has no size cap; `/media/files` is capped at `MEDIA_MAX_FILE_UPLOAD_BYTES` (413).
  `/media/upload-urls` checks the declared `content_length` against `MEDIA_MAX_IMAGE_UPLOAD_BYTES` (images) or
  `MEDIA_MAX_FILE_UPLOAD_BYTES` (files), with the same 413, and S3 enforces the same cap on the bytes.
  Empty files are refused (400).
- With storage switched off (no AWS keys) every valid upload is a 503 before
  the body is read; the goldens in `tests/golden/media/` pin the type rules.

## Routes

| Method | Path | Who | What |
|---|---|---|---|
| POST | `/api/v1/media/images` | any signed-in user | upload an image |
| POST | `/api/v1/media/files` | any signed-in user | upload an image, video or PDF |
| POST | `/api/v1/media/upload-urls` | any signed-in user | get a presigned S3 POST so the browser uploads straight to the bucket (`kind` image or file, `content_type`, `content_length`) |
