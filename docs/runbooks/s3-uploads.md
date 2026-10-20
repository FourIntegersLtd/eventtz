# S3 direct uploads (presigned POST)

Web uploads mint a presigned POST via `POST /api/v1/media/upload-urls` (small JSON through
the Next proxy), then the browser sends file bytes straight to the bucket. The API never
sees the file body on that path.

## Bucket CORS

Configure CORS on the upload bucket (`AWS_S3_BUCKET_NAME`, default `eventtz`) so browsers
can `POST` from Eventtz origins.

**AWS Console** (S3 → bucket → Permissions → CORS → Edit): paste **`s3-uploads-cors-console.json`** — a **JSON array** of rules only. Do not wrap in `"CORSRules"` (the console errors with “not iterable” if you use the CLI shape).

**AWS CLI** (`apply-s3-upload-cors.sh`): uses **`s3-uploads-cors.json`**, which wraps rules in `"CORSRules"` as `put-bucket-cors` requires.

Adjust origins in both files if preview URLs change.

Or from this repo (credentials in `api/.env` or exported in your shell — **do not paste keys into chat**):

```bash
chmod +x docs/runbooks/apply-s3-upload-cors.sh
./docs/runbooks/apply-s3-upload-cors.sh
```

- Console: `docs/runbooks/s3-uploads-cors-console.json`
- CLI: `docs/runbooks/s3-uploads-cors.json`

## Public read

Uploaded keys must remain publicly readable at `public_object_url` (existing bucket policy
assumption). Presigned POST only authorises the upload; listing still uses the public URL
returned by the API.

## Local development

Presigned uploads work on localhost the same as production, but CORS must include
`http://localhost:3001` and the API must have valid `AWS_*` credentials (see `api/.env.example`).

Without CORS, the browser blocks the S3 `POST` with a network error; the web app surfaces
a support message for that case.

## Verification

1. Upload a photo **larger than 4.5 MB** on production.
2. Railway API logs should show `POST /api/v1/media/upload-urls` with a small body, not
   `POST /media/images` with multipart bytes.
3. Acceptance tests still use `POST /media/images` and `/media/files` (unchanged).
