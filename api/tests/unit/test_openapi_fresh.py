"""`api/openapi.json` (the source of the web app's generated types) must match the running app.

If this fails, run `make openapi` in `api/`, then `npm run api:types` in `web/`, and commit both.
"""

from __future__ import annotations

from app.core.settings import API_ROOT
from app.openapi import build_document, mark_response_fields_required, render


def test_committed_openapi_matches_the_app() -> None:
    """The committed file equals a fresh in-process build."""
    committed = (API_ROOT / "openapi.json").read_text(encoding="utf-8")
    assert committed == render(build_document()), "api/openapi.json is stale: run `make openapi`"


def test_response_only_schemas_get_every_field_required_and_request_schemas_do_not() -> None:
    """A response field with a default is always sent; a request field with a default may be omitted."""
    document = {
        "paths": {
            "/x": {
                "post": {
                    "requestBody": {
                        "content": {"application/json": {"schema": {"$ref": "#/components/schemas/In"}}}
                    },
                    "responses": {
                        "200": {
                            "content": {"application/json": {"schema": {"$ref": "#/components/schemas/Out"}}}
                        }
                    },
                }
            }
        },
        "components": {
            "schemas": {
                "In": {"properties": {"note": {"default": None}, "name": {}}, "required": ["name"]},
                "Out": {
                    "properties": {"count": {"default": 0}, "items": {"$ref": "#/components/schemas/Row"}}
                },
                "Row": {"properties": {"label": {"default": ""}}},
            }
        },
    }
    mark_response_fields_required(document)
    schemas = document["components"]["schemas"]
    assert schemas["In"]["required"] == ["name"]
    assert schemas["Out"]["required"] == ["count", "items"]
    assert schemas["Row"]["required"] == ["label"]


def test_framework_validation_error_schema_keeps_its_original_required_fields() -> None:
    """FastAPI's 422 entries leave out `ctx` for most errors, so it must not become required."""
    document = build_document()
    assert document["components"]["schemas"]["ValidationError"]["required"] == ["loc", "msg", "type"]
