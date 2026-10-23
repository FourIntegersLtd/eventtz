# 0007 — Frontend API types are generated from OpenAPI

Status: accepted (2026-09-25)

## Decision
`make openapi` writes `api/openapi.json`; `npm run api:types` runs
openapi-typescript into `web/lib/api-schema.d.ts`. Hand-written copies
of response shapes are removed as screens move to the generated types.
`api/openapi.baseline.json` records every path+method; CI fails if one disappears.
