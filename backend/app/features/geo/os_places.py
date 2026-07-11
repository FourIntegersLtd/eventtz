"""UK address lookup via Ordnance Survey OS Places API (OS Data Hub)."""

from __future__ import annotations

from typing import Any

import httpx

from app.core.config import get_settings
from app.core.logging import get_logger

logger = get_logger(__name__)

_OS_PLACES_BASE = "https://api.os.uk/search/places/v1"


def _api_key() -> str:
    return (get_settings().os_places_api_key or "").strip()


def _request(path: str, params: dict[str, Any]) -> dict[str, Any] | None:
    key = _api_key()
    if not key:
        return None
    q = {**params, "key": key}
    url = f"{_OS_PLACES_BASE}{path}"
    try:
        with httpx.Client(timeout=25.0) as client:
            r = client.get(url, params=q)
    except Exception as e:
        logger.warning("OS Places request failed %s: %s", path, e)
        return None
    if r.status_code == 401 or r.status_code == 403:
        logger.warning("OS Places HTTP %s — check OS_PLACES_API_KEY / OS Data Hub project", r.status_code)
        return None
    if r.status_code != 200:
        logger.warning("OS Places %s HTTP %s", path, r.status_code)
        return None
    try:
        data = r.json()
    except Exception:
        return None
    return data if isinstance(data, dict) else None


def _iter_dpa_addresses(data: dict[str, Any]) -> list[dict[str, Any]]:
    """Extract DPA objects from a Places API JSON body."""
    results = data.get("results")
    if not isinstance(results, list):
        return []
    out: list[dict[str, Any]] = []
    for row in results:
        if not isinstance(row, dict):
            continue
        dpa = row.get("DPA")
        if isinstance(dpa, dict) and dpa.get("ADDRESS"):
            out.append(dpa)
    return out


def _formatted_line_from_dpa(dpa: dict[str, Any]) -> str:
    addr = str(dpa.get("ADDRESS") or "").strip()
    pc = str(dpa.get("POSTCODE") or "").strip()
    pc_norm = " ".join(pc.split()).upper() if pc else ""
    if not addr:
        return pc_norm
    if pc_norm and pc_norm not in addr.upper().replace("  ", " "):
        return f"{addr}, {pc_norm}"
    return addr


def os_places_autocomplete(term: str) -> list[dict[str, str]]:
    """Returns [{id: UPRN, address}, ...] for free-text search."""
    if len(term.strip()) < 2:
        return []
    data = _request(
        "/find",
        {"query": term.strip(), "maxresults": 12, "dataset": "DPA"},
    )
    if not data:
        return []
    out: list[dict[str, str]] = []
    for dpa in _iter_dpa_addresses(data):
        uprn = dpa.get("UPRN")
        addr = str(dpa.get("ADDRESS") or "").strip()
        if uprn is None or not addr:
            continue
        out.append({"id": str(int(uprn)), "address": addr})
        if len(out) >= 12:
            break
    return out


def os_places_find_by_postcode(postcode: str) -> list[str]:
    """Return ADDRESS lines for all premises at a postcode (paginated)."""
    raw = postcode.strip()
    if len(raw) < 4:
        return []
    normalized = " ".join(raw.split()).upper()
    all_lines: list[str] = []
    offset = 0
    total: int | None = None

    while True:
        data = _request(
            "/postcode",
            {
                "postcode": normalized,
                "maxresults": 100,
                "offset": offset,
                "dataset": "DPA",
            },
        )
        if not data:
            break
        header = data.get("header")
        if isinstance(header, dict) and total is None:
            try:
                total = int(header.get("totalresults") or 0)
            except (TypeError, ValueError):
                total = 0
        results = data.get("results")
        n_batch = len(results) if isinstance(results, list) else 0
        if n_batch == 0:
            break
        for dpa in _iter_dpa_addresses(data):
            line = str(dpa.get("ADDRESS") or "").strip()
            if line:
                all_lines.append(line)
        offset += n_batch
        if total is not None and offset >= total:
            break
        if n_batch < 100:
            break
        if offset > 5000:
            logger.warning("OS Places postcode pagination capped at offset %s", offset)
            break

    return all_lines


def os_places_get_by_uprn(uprn: str) -> dict[str, Any] | None:
    """Resolve a single address by UPRN (string of digits)."""
    s = uprn.strip()
    if not s.isdigit():
        return None
    try:
        n = int(s)
    except ValueError:
        return None
    data = _request("/uprn", {"uprn": n, "dataset": "DPA"})
    if not data:
        return None
    dpas = _iter_dpa_addresses(data)
    if not dpas:
        return None
    dpa = dpas[0]
    pc = str(dpa.get("POSTCODE") or "").strip()
    if not pc:
        return None
    pc_norm = " ".join(pc.split())
    formatted = _formatted_line_from_dpa(dpa)
    line_1 = str(dpa.get("ADDRESS") or "").split(",")[0].strip() or None
    town = str(dpa.get("POST_TOWN") or "").strip() or None
    return {
        "postcode": pc_norm,
        "formatted_line": formatted,
        "line_1": line_1,
        "town_or_city": town,
        "county": None,
    }
