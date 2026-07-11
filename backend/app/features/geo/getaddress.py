"""UK address lookup via getAddress.io (optional; use when OS Places API is not available)."""

from __future__ import annotations

from typing import Any
from urllib.parse import quote

import httpx

from app.core.config import get_settings
from app.core.logging import get_logger

logger = get_logger(__name__)

_GETADDRESS_BASE = "https://api.getAddress.io"

# Set after first 401/403 so we log once and skip repeat calls until restart.
_auth_rejected = False


def _api_key() -> str:
    return (get_settings().getaddress_api_key or "").strip()


def _mark_auth_rejected(source: str, status: int) -> None:
    global _auth_rejected
    _auth_rejected = True
    logger.error(
        "getAddress %s rejected the API key (HTTP %s). "
        "Use the **API Key** from getAddress (not the Administration Key or a domain token). "
        "If the key is correct, open getAddress → Security and whitelist this machine's public IP "
        "(or disable IP restrictions for local dev). Then set GETADDRESS_API_KEY in backend/.env "
        "and restart the backend.",
        source,
        status,
    )


def _credentials_blocked() -> bool:
    return _auth_rejected


def getaddress_autocomplete(term: str) -> tuple[list[dict[str, str]], bool]:
    """Returns ([{id, address}, ...], credentials_valid). credentials_valid is False on 401/403."""
    key = _api_key()
    if not key or len(term.strip()) < 2:
        return [], bool(key)
    if _credentials_blocked():
        return [], False
    t = quote(term.strip(), safe="")
    url = f"{_GETADDRESS_BASE}/autocomplete/{t}"
    try:
        with httpx.Client(timeout=12.0) as client:
            r = client.get(url, params={"api-key": key, "all": "true"})
    except Exception as e:
        logger.warning("getAddress autocomplete failed: %s", e)
        return [], True
    if r.status_code in (401, 403):
        _mark_auth_rejected("autocomplete", r.status_code)
        return [], False
    if r.status_code != 200:
        logger.warning("getAddress autocomplete HTTP %s", r.status_code)
        return [], True
    try:
        data = r.json()
    except Exception:
        return [], True
    raw = data.get("suggestions") if isinstance(data, dict) else None
    if not isinstance(raw, list):
        return [], True
    out: list[dict[str, str]] = []
    for item in raw[:12]:
        if not isinstance(item, dict):
            continue
        iid = item.get("id")
        addr = item.get("address")
        if isinstance(iid, str) and iid and isinstance(addr, str) and addr.strip():
            out.append({"id": iid.strip(), "address": addr.strip()})
    return out, True


def _format_line(data: dict[str, Any]) -> str:
    lines = data.get("formatted_address")
    parts: list[str] = []
    if isinstance(lines, list):
        for x in lines:
            if isinstance(x, str) and x.strip():
                parts.append(x.strip())
    pc = str(data.get("postcode") or "").strip()
    if parts:
        base = ", ".join(parts)
        return f"{base}, {pc}" if pc else base
    l1 = str(data.get("line_1") or "").strip()
    town = str(data.get("town_or_city") or "").strip()
    bits = [x for x in (l1, town, pc) if x]
    return ", ".join(bits)


def _tidy_find_line(s: str) -> str:
    parts = [p.strip() for p in s.split(",") if p and p.strip()]
    return ", ".join(parts)


def getaddress_find_by_postcode(postcode: str) -> tuple[list[str], bool]:
    """Return (address lines, credentials_valid) for a UK postcode via getAddress Find API."""
    key = _api_key()
    if not key:
        return [], False
    if _credentials_blocked():
        return [], False
    raw = postcode.strip()
    if len(raw) < 4:
        return [], True
    seg = quote("".join(raw.split()).lower(), safe="")
    url = f"{_GETADDRESS_BASE}/find/{seg}"
    try:
        with httpx.Client(timeout=20.0) as client:
            r = client.get(url, params={"api-key": key, "sort": "true"})
    except Exception as e:
        logger.warning("getAddress find failed: %s", e)
        return [], True
    if r.status_code in (401, 403):
        _mark_auth_rejected("find", r.status_code)
        return [], False
    if r.status_code == 400:
        return [], True
    if r.status_code != 200:
        logger.warning("getAddress find HTTP %s", r.status_code)
        return [], True
    try:
        data = r.json()
    except Exception:
        return [], True
    if not isinstance(data, dict):
        return [], True
    raw_addrs = data.get("addresses")
    if not isinstance(raw_addrs, list):
        return [], True
    out: list[str] = []
    for item in raw_addrs:
        if isinstance(item, str) and item.strip():
            tidied = _tidy_find_line(item)
            if tidied:
                out.append(tidied)
    return out, True


def getaddress_get_by_id(address_id: str) -> dict[str, Any] | None:
    """Returns normalised fields or None."""
    key = _api_key()
    if not key or not address_id.strip():
        return None
    if _credentials_blocked():
        return None
    seg = quote(address_id.strip(), safe="")
    url = f"{_GETADDRESS_BASE}/get/{seg}"
    try:
        with httpx.Client(timeout=12.0) as client:
            r = client.get(url, params={"api-key": key})
    except Exception as e:
        logger.warning("getAddress get failed: %s", e)
        return None
    if r.status_code != 200:
        logger.warning("getAddress get HTTP %s", r.status_code)
        return None
    try:
        data = r.json()
    except Exception:
        return None
    if not isinstance(data, dict):
        return None
    pc = str(data.get("postcode") or "").strip()
    if not pc:
        return None
    return {
        "postcode": " ".join(pc.split()),
        "formatted_line": _format_line(data),
        "line_1": (str(data.get("line_1")).strip() if data.get("line_1") else None),
        "town_or_city": (str(data.get("town_or_city")).strip() if data.get("town_or_city") else None),
        "county": (str(data.get("county")).strip() if data.get("county") else None),
    }
