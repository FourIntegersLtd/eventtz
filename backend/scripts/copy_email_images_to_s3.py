#!/usr/bin/env python3
"""Copy Eventtz email template images from osceguide to the eventtz bucket.

Source: osceguide / Four Integers Ltd/eventtz/*.png
Dest:   eventtz / email/*.png

Does not delete the source unless you pass --delete-source.

Usage (from backend/):
  PYTHONPATH=. poetry run python scripts/copy_email_images_to_s3.py
  PYTHONPATH=. poetry run python scripts/copy_email_images_to_s3.py --dry-run
  PYTHONPATH=. poetry run python scripts/copy_email_images_to_s3.py --delete-source
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

from app.core.logging import get_logger, setup_logging
from app.features.media.s3 import get_s3_client, public_object_url, s3_configured

logger = get_logger(__name__)

SRC_BUCKET = "osceguide"
SRC_PREFIX = "Four Integers Ltd/eventtz/"
DST_BUCKET = "eventtz"
DST_PREFIX = "email/"


def main() -> int:
    parser = argparse.ArgumentParser(description="Copy email template images to the eventtz S3 bucket.")
    parser.add_argument("--dry-run", action="store_true", help="List objects only; do not copy.")
    parser.add_argument(
        "--delete-source",
        action="store_true",
        help="After a successful copy, delete the osceguide source objects.",
    )
    args = parser.parse_args()

    setup_logging()
    if not s3_configured():
        logger.error("S3 is not configured.")
        return 1

    client = get_s3_client()
    listed = client.list_objects_v2(Bucket=SRC_BUCKET, Prefix=SRC_PREFIX)
    objects = [
        obj["Key"]
        for obj in listed.get("Contents") or []
        if Path(obj["Key"]).name and not str(obj["Key"]).endswith("/")
    ]
    logger.info("found %s email images under s3://%s/%s", len(objects), SRC_BUCKET, SRC_PREFIX)
    copied = 0
    failed = 0
    dest_keys: list[str] = []
    for key in objects:
        dest_key = f"{DST_PREFIX}{Path(key).name}"
        dest_keys.append(dest_key)
        if args.dry_run:
            logger.info("dry-run %s -> %s", key, dest_key)
            copied += 1
            continue
        try:
            head = client.head_object(Bucket=SRC_BUCKET, Key=key)
            client.copy_object(
                Bucket=DST_BUCKET,
                Key=dest_key,
                CopySource={"Bucket": SRC_BUCKET, "Key": key},
                MetadataDirective="REPLACE",
                ContentType=head.get("ContentType") or "image/png",
                CacheControl=head.get("CacheControl") or "public, max-age=86400",
            )
            copied += 1
            logger.info("copied %s", public_object_url(dest_key))
        except Exception:
            failed += 1
            logger.exception("copy failed key=%s", key)

    if args.delete_source and not args.dry_run and failed == 0 and dest_keys:
        for key in objects:
            client.delete_object(Bucket=SRC_BUCKET, Key=key)
            logger.info("deleted source %s", key)
        if any(obj.get("Key") == SRC_PREFIX for obj in listed.get("Contents") or []):
            client.delete_object(Bucket=SRC_BUCKET, Key=SRC_PREFIX)
            logger.info("deleted source folder marker %s", SRC_PREFIX)

    logger.info("done copied=%s failed=%s dry_run=%s", copied, failed, args.dry_run)
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
