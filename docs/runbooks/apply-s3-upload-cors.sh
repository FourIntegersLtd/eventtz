#!/usr/bin/env bash
# Apply browser upload CORS on the Eventtz S3 bucket (presigned POST flow).
# Run from repo root in a shell where AWS credentials are already set, e.g.:
#   export AWS_ACCESS_KEY=... AWS_SECRET_ACCESS_KEY=... AWS_REGION=eu-west-2
# or with keys in api/.env (this script sources that file if present).

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
CORS_FILE="${ROOT}/docs/runbooks/s3-uploads-cors.json"

if [[ -f "${ROOT}/api/.env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "${ROOT}/api/.env"
  set +a
fi

export AWS_ACCESS_KEY_ID="${AWS_ACCESS_KEY_ID:-${AWS_ACCESS_KEY:-}}"
export AWS_SECRET_ACCESS_KEY="${AWS_SECRET_ACCESS_KEY:-}"
export AWS_DEFAULT_REGION="${AWS_REGION:-eu-west-2}"
BUCKET="${AWS_S3_BUCKET_NAME:-eventtz}"

if [[ -z "${AWS_ACCESS_KEY_ID}" || -z "${AWS_SECRET_ACCESS_KEY}" ]]; then
  echo "Missing credentials. Set AWS_ACCESS_KEY and AWS_SECRET_ACCESS_KEY (or AWS_ACCESS_KEY_ID) in api/.env or your shell." >&2
  exit 1
fi

if ! command -v aws >/dev/null 2>&1; then
  echo "aws CLI not found. Install with: brew install awscli" >&2
  exit 1
fi

echo "Account:"
aws sts get-caller-identity
echo "Applying CORS to bucket: ${BUCKET}"
aws s3api put-bucket-cors --bucket "${BUCKET}" --cors-configuration "file://${CORS_FILE}"
echo "Current CORS:"
aws s3api get-bucket-cors --bucket "${BUCKET}"
