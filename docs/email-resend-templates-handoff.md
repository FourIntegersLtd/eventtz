# OSCE Guide — Google SMTP → Resend migration handoff

**Target app:** [OSCE Guide](file:///Users/yahayakenny/Documents/Projects/OSCE%20Guide) (Flask + Next.js)  
**Reference pattern:** Eventtz Resend package at `eventtz/backend/app/features/email/`  
**Purpose:** Pass this to another LLM to migrate OSCE Guide off Gmail SMTP onto Resend, mirroring Eventtz’s approach.

> **Not Eventtz work.** Eventtz already uses Resend (`RESEND_API_KEY` + `resend_client.py`). Do not build an Eventtz templates CMS from this doc.

---

## 1. Goal

Replace **Flask-Mail → Gmail SMTP** with **httpx → Resend HTTP API**, keep existing **Jinja HTML templates**, unify split send paths, and optionally add an admin test-send console like Eventtz `/admin/email`.

### Success criteria

- All production emails send via Resend (no `smtp.gmail.com`)
- Env only needs `RESEND_API_KEY` (plus any existing non-email env)
- Jinja templates under `b2c/shared/templates/` still render the same HTML
- B2C + B2B + inline route sends go through one transport
- Local/dev can skip sends when key missing or a kill switch is on
- Domain authenticated in Resend for `osceguide.com` (and/or `eventtz.com`)

---

## 2. Current OSCE Guide (as-is)

### Stack

| Layer | Tech |
|-------|------|
| Backend | Python / **Flask 3.1** |
| Frontend | Next.js 15 + React 19 |
| Email | **Flask-Mail 0.10** → **Gmail SMTP** `smtp.gmail.com:587` TLS |
| Templates | **Jinja2 HTML** via Flask `render_template` |

### SMTP config

**Env** (`backend/.env.sample`):

| Var | Role |
|-----|------|
| `GMAIL_USERNAME` | SMTP auth user |
| `GMAIL_PASSWORD` | Gmail app password |
| `GMAIL_DEFAULT_SENDER` | From on `Message` |

**Hardcoded in** `backend/app.py` (~211–217):

```
MAIL_SERVER = smtp.gmail.com
MAIL_PORT = 587
MAIL_USE_TLS = True
MAIL_USERNAME / MAIL_PASSWORD / MAIL_DEFAULT_SENDER from env
```

`mail = Mail()` lives in `backend/b2c/sca/config/sca_helpers.py`; `mail.init_app(app)` in `app.py`.

Default sender fallback: `noreply@osceguide.com`. Shared ops inbox: `hello@eventtz.com` (Eventtz Ltd).

### Send architecture (today)

```
Routes / services
  → EmailService (B2C)  OR  B2BEmailService  OR  inline Message in users_route
      → flask.render_template(*.html)
      → flask_mail.Message(html=...)
      → mail.send(msg)  → Gmail SMTP
```

### Core files (absolute)

| Path | Role |
|------|------|
| `/Users/yahayakenny/Documents/Projects/OSCE Guide/backend/app.py` | SMTP config + `mail.init_app` |
| `/Users/yahayakenny/Documents/Projects/OSCE Guide/backend/b2c/sca/config/sca_helpers.py` | `mail` singleton |
| `/Users/yahayakenny/Documents/Projects/OSCE Guide/backend/b2c/shared/services/email_service.py` | Primary B2C sender |
| `/Users/yahayakenny/Documents/Projects/OSCE Guide/backend/b2b/services/shared/email.py` | B2B sender (same Flask-Mail) |
| `/Users/yahayakenny/Documents/Projects/OSCE Guide/backend/b2c/shared/routes/users/users_route.py` | Inline password-reset + deletion emails |
| `/Users/yahayakenny/Documents/Projects/OSCE Guide/backend/b2c/shared/templates/` | All Jinja HTML |

### Template inventory

Under `backend/b2c/shared/templates/`:

| Template | Notes |
|----------|--------|
| `new_message_email.html` | Ops |
| `reset_password_email.html` | Used **inline** in `users_route` (service helper unused) |
| `user_deletion_email.html` | Used **inline** in `users_route` |
| `marketplace_post_claimed_email.html` | |
| `marketplace_claim_confirmation_email.html` | |
| `marketplace_session_cancelled_email.html` | |
| `marketplace_session_reminder_email.html` | |
| `session_join_help_email.html` | **Orphan** (no callers) |
| `help_request_summary_email.html` | Ops |
| `no_show_report_email.html` | Ops |
| `no_show_notification_to_user_email.html` | |
| `colleague_waiting_for_practice_email.html` | |
| `abuse_report_email.html` | Ops |
| `inactive_user_engagement_email.html` | |
| `subscription_welcome_email.html` | |
| `b2b_trainee_invite_email.html` | Trainee + staff invites |

Partials: `partials/transactional/`, `partials/marketing/`, `partials/b2b/`.

**HTML only** — no `.txt` companions today.

### Gaps vs Eventtz

| Concern | OSCE Guide | Eventtz |
|---------|------------|---------|
| Transport | Gmail SMTP + Flask-Mail | Resend HTTP (`resend_client.py`) |
| Secrets | 3 Gmail env vars | `RESEND_API_KEY` only |
| Kill switch | None | `EMAIL_ENABLED` skip when false / missing `RESEND_API_KEY` |
| Layout | Split B2C / B2B / inline | One feature package |
| Multipart | HTML only | HTML + TXT |
| Admin test UI | None | `/admin/email` catalog + test-send |
| Deduping | Ad-hoc Firestore flags | `email_delivery_log` for selected kinds |

---

## 3. Eventtz reference (copy this pattern)

Repo: `/Users/yahayakenny/Documents/Projects/eventtz`

```
backend/app/features/email/
  constants.py      # EMAIL_FROM, EMAIL_ENABLED, branding URLs/images (hardcoded)
  branding.py       # shared Jinja context
  render.py         # Jinja FileSystemLoader + lru_cache
  resend_client.py  # httpx POST https://api.resend.com/emails
  service.py        # subject + context + render + send
  dispatch.py       # booking helpers (Eventtz-specific)
  delivery_log.py   # optional dedupe (Eventtz-specific)
  templates/        # Jinja HTML + TXT
```

**Minimal client to mirror** (`resend_client.py`):

- Skip if local-auth / `EMAIL_ENABLED=False` / empty `RESEND_API_KEY`
- Payload: `{ from, to, subject, html, text? }`
- Auth: `Authorization: Bearer {RESEND_API_KEY}`
- Log failures; return bool

**From address pattern:** `"Product <hello@domain.com>"` in constants, not env.

Admin test console (optional Phase C): `features/admin/email_test.py` + `/admin/email`.

---

## 4. Recommended migration plan

### Phase 0 — Resend account (ops, before code)

1. Create/use Resend project; generate API key.
2. Verify sending domain(s): prefer `osceguide.com` (and `eventtz.com` for Eventtz ops mail).
3. Decide `EMAIL_FROM`, e.g. `OSCE Guide <noreply@osceguide.com>` or `Eventtz <hello@eventtz.com>` — must match a verified domain.
4. Send one manual Resend test to confirm DNS (SPF/DKIM).

### Phase A — Transport swap (do this first; smallest risk)

**Keep** Flask `render_template` and all Jinja files. **Replace** only `mail.send`.

1. Add dependency: `httpx` (if not already); do **not** add the official `resend` SDK unless you prefer it — Eventtz uses raw httpx.
2. Add env: `RESEND_API_KEY` to `.env` / `.env.sample`; remove reliance on `GMAIL_*` after cutover.
3. Add module e.g. `backend/b2c/shared/services/resend_client.py` (copy Eventtz `send_email` shape).
4. Add constants e.g. `EMAIL_FROM`, `EMAIL_ENABLED` next to existing shared constants (or a small `email_constants.py`).
5. Change `EmailService.send_email` and `B2BEmailService.send_email`:
   - render HTML as today
   - call `resend_client.send_email(to=..., subject=..., html=...)` instead of `Message` / `mail.send`
6. Fix **inline** sends in `users_route.py` (password reset + deletion) the same way — or route them through `EmailService` methods that already exist but are unused.
7. Remove Flask-Mail config from `app.py` and `mail.init_app` once nothing imports `mail`.
8. Drop `flask-mail` from requirements when unused.

**Do not** rewrite templates or invent React Email in this phase.

### Phase B — Unify senders (same PR or follow-up)

1. Make `B2BEmailService` a thin wrapper around shared `send_email` / one `EmailService`, or delete and import B2C service from B2B call sites.
2. Wire password-reset / deletion through `EmailService`; delete duplicate inline `Message` blocks.
3. Delete or wire orphan `session_join_help_email` / unused helpers.
4. Optional: add plaintext `.txt` siblings later (nice-to-have; Eventtz has them).

### Phase C — Hardening + optional admin console

1. Skip sends when `RESEND_API_KEY` empty or `EMAIL_ENABLED=False` (and any local-dev flag OSCE Guide already has).
2. Optional dedupe for reminder / engagement / invite spam (Firestore flag or small collection) — only if product needs it; don’t blindly port Eventtz SQL.
3. Optional admin **test-send** page (catalog of template ids + sample contexts), modeled on Eventtz `/admin/email` — greenfield; not required for migration.

### Explicit non-goals

- Building an email CMS / TipTap editor
- Migrating Eventtz (already on Resend)
- Rewriting Jinja to React Email / MJML
- Keeping Gmail as fallback long-term (cut over cleanly)

---

## 5. Suggested code sketch (OSCE Guide)

```python
# b2c/shared/services/resend_client.py  (mirror Eventtz)
import httpx
import os

_RESEND_URL = "https://api.resend.com/emails"
EMAIL_FROM = "OSCE Guide <noreply@osceguide.com>"  # must be verified domain
EMAIL_ENABLED = True

def send_email(*, to: list[str], subject: str, html: str, text: str | None = None) -> bool:
    if not EMAIL_ENABLED:
        return False
    api_key = (os.getenv("RESEND_API_KEY") or "").strip()
    if not api_key:
        # log warning
        return False
    payload = {"from": EMAIL_FROM, "to": to, "subject": subject, "html": html}
    if text:
        payload["text"] = text
    with httpx.Client(timeout=15.0) as client:
        res = client.post(
            _RESEND_URL,
            headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
            json=payload,
        )
    return res.status_code < 400
```

In `EmailService.send_email`, after `html = render_template(...)`:

```python
return send_email(to=recipients, subject=subject, html=html)
```

---

## 6. Env / deploy checklist

| Action | Detail |
|--------|--------|
| Add | `RESEND_API_KEY=re_...` (prod + staging) |
| Remove after cutover | `GMAIL_USERNAME`, `GMAIL_PASSWORD`, `GMAIL_DEFAULT_SENDER` |
| Update | `.env.sample`, any deploy secrets (Railway/Fly/etc.) |
| DNS | Resend domain verification for From domain |
| Smoke test | Password reset, marketplace claim, B2B trainee invite, one ops alert |
| Monitor | Resend dashboard logs for 24–48h after cutover |

---

## 7. Call-site smoke list (must still work)

| Flow | Entry |
|------|--------|
| Password reset | `users_route.py` |
| User deletion notify | `users_route.py` |
| New support message | `messages_routes.py` |
| Marketplace claim / cancel / reminder | marketplace routes + services |
| Subscription welcome | `payment_service.py` |
| Inactive engagement | `inactive_user_engagement_service.py` |
| Human practice / no-show / abuse | `human_practice_routes.py` |
| Help-request summary | `livekit_utils.py` |
| B2B trainee / staff / tenant admin invites | `b2b/...` invite / staff / tenant_admin / platform user |

---

## 8. Prompt snippet for the implementing LLM

> Migrate **OSCE Guide** (`/Users/yahayakenny/Documents/Projects/OSCE Guide`) from Flask-Mail Gmail SMTP to **Resend**, using Eventtz’s `backend/app/features/email/resend_client.py` as the pattern. Phase A: add `RESEND_API_KEY` + a small httpx Resend client; swap `mail.send` in `EmailService`, `B2BEmailService`, and inline `users_route` sends; keep existing Jinja templates. Phase B: unify senders and remove Flask-Mail. Do not build a CMS. Verify Resend domain for the chosen `EMAIL_FROM`. Update `.env.sample` and remove `GMAIL_*` after cutover.

---

## 9. Key paths cheat sheet

**OSCE Guide**

```
backend/app.py
backend/.env.sample
backend/b2c/sca/config/sca_helpers.py          # mail singleton (remove after)
backend/b2c/shared/services/email_service.py   # primary swap target
backend/b2b/services/shared/email.py           # B2B swap target
backend/b2c/shared/routes/users/users_route.py # inline Message
backend/b2c/shared/templates/*.html
```

**Eventtz reference**

```
backend/app/features/email/resend_client.py
backend/app/features/email/constants.py   # EMAIL_FROM = Eventtz <hello@eventtz.com>
backend/app/features/email/render.py
backend/app/features/email/service.py
backend/app/core/config.py                     # resend_api_key, super_admin_emails
backend/.env.example                           # RESEND_API_KEY, SUPER_ADMIN_EMAILS=hello@eventtz.com
```
