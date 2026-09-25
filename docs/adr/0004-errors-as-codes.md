# 0004 — Errors carry stable codes

Status: accepted (2026-09-25)

## Decision
Services raise `AppError` subclasses with an HTTP status and a stable snake_case
`code`. One handler renders `{"detail": <message>, "code": <code>}`. `detail` stays a
string so existing clients keep working. Routes declare their errors for OpenAPI.
Clients branch on `code`, never on message text. Services never raise
`HTTPException`.
