"""`Webhooks` that POST JSON from one background thread, so the request never waits on a third party."""

from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor

import httpx

from app.core.logging import get_logger
from app.core.ports import WebhookCall

log = get_logger(__name__)

# One worker is plenty for contact-form volume and keeps calls in submission order.
_executor = ThreadPoolExecutor(max_workers=1, thread_name_prefix="webhooks")


def _post(call: WebhookCall) -> None:
    """Send one webhook and log the outcome. Runs on the worker thread; never raises."""
    try:
        with httpx.Client(timeout=10.0) as http:
            response = http.post(call.url, json=call.payload, headers=call.headers)
    except Exception:
        log.exception("webhook POST failed url_host=%s", httpx.URL(call.url).host)
        return
    if response.status_code >= 400:
        log.warning("webhook HTTP %s: %s", response.status_code, response.text[:500])
        return
    log.info("webhook accepted HTTP %s", response.status_code)


class BackgroundWebhooks:
    """Queues each call on the shared worker thread."""

    def post_in_background(self, call: WebhookCall) -> None:
        """Queue `call`; a failure to even queue it is logged and swallowed."""
        try:
            _executor.submit(_post, call)
        except Exception:
            log.exception("webhook could not be queued")
