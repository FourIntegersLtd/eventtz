"""Write the OpenAPI document (`make openapi`) that the web app generates its API types from (ADR 0007)."""

from __future__ import annotations

import json
import sys
from pathlib import Path
from typing import Any

from app.core.settings import API_ROOT

# FastAPI's own 422 body: its entries omit `ctx` for most errors, so its fields are not all always sent.
FRAMEWORK_SCHEMAS = frozenset({"HTTPValidationError", "ValidationError"})


def _referenced_schemas(node: Any, found: set[str]) -> None:
    """Collect the component schema names a JSON fragment points at with `$ref`."""
    if isinstance(node, dict):
        reference = node.get("$ref")
        if isinstance(reference, str):
            found.add(reference.rsplit("/", 1)[1])
        for value in node.values():
            _referenced_schemas(value, found)
    elif isinstance(node, list):
        for value in node:
            _referenced_schemas(value, found)


def _reachable(schemas: dict[str, Any], seeds: set[str]) -> set[str]:
    """Return `seeds` plus every schema they reference, directly or through other schemas."""
    seen: set[str] = set()
    pending = list(seeds)
    while pending:
        name = pending.pop()
        if name in seen:
            continue
        seen.add(name)
        children: set[str] = set()
        _referenced_schemas(schemas[name], children)
        pending.extend(children)
    return seen


def mark_response_fields_required(document: dict[str, Any]) -> None:
    """Mark every property of a response-only schema as required.

    FastAPI serialises every field of a response model (we never use `exclude_unset`), so a field with a
    default is always present on the wire. Pydantic still omits it from `required`, which would make the
    generated TypeScript type every such field optional. Schemas that also appear in a request body are
    left alone: there a default really does mean the caller may omit the field.
    """
    schemas = document.get("components", {}).get("schemas", {})
    request_seeds: set[str] = set()
    response_seeds: set[str] = set()
    for path_item in document["paths"].values():
        for operation in path_item.values():
            _referenced_schemas(operation.get("requestBody", {}), request_seeds)
            _referenced_schemas(operation.get("responses", {}), response_seeds)
    response_only = (
        _reachable(schemas, response_seeds) - _reachable(schemas, request_seeds) - FRAMEWORK_SCHEMAS
    )
    for name in response_only:
        properties = schemas[name].get("properties")
        if properties:
            schemas[name]["required"] = sorted(properties)


def build_document() -> dict[str, Any]:
    """Build the app and return its OpenAPI document as the web app's type generator should see it."""
    from app.main import create_app  # imports every slice, so load it only when writing

    document = create_app().openapi()
    mark_response_fields_required(document)
    return document


def render(document: dict[str, Any]) -> str:
    """Serialise as stable, sorted JSON so diffs stay readable."""
    return json.dumps(document, indent=2, sort_keys=True) + "\n"


def write(path: Path = API_ROOT / "openapi.json") -> None:
    """Write `build_document()` to `path`."""
    path.write_text(render(build_document()), encoding="utf-8")


if __name__ == "__main__":
    write(Path(sys.argv[1]) if len(sys.argv) > 1 else API_ROOT / "openapi.json")
