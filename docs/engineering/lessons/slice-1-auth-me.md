# Slice 1 — Authentication: `/me` endpoint

### User story
A signed-in user calls `GET /api/v1/auth/me` to retrieve their own profile data — this tells the frontend "who am I right now?" and checks if the session cookie is still valid.

### What changed since last lesson (2026-08-31)

- **`GET /me` uses `require_user()`** — the route no longer calls `get_current_user_or_raise` + `build_app_user` inline; `require_user` returns a merged `AuthUser` (profile, tombstone, suspension, Sentry).
- **`validate_session_access_token()`** — shared JWT/Supabase check in `session.py`; both strict guards and optional-session callers use it.
- **`get_optional_session_user()`** — in `guards.py`; explore routes use this (invalid cookie → anonymous, no 401). Contrast with `/me`, which must 401 when unsigned in.
- **`AuthProvider` interceptors** — `installAuthInterceptors` on mount; 401 → refresh → retry. `signIn` calls `getMe()` after `apiSignIn` and throws `SESSION_VERIFY_FAILED` if verify fails.
- **Sentry user context** — `AuthProvider` calls `identifySentryUser` / `resetSentryUser` alongside Mixpanel when `user` changes.
- **Auth service unavailable → 503** — Supabase timeouts in `validate_session_access_token` (via `get_current_user_or_raise`) return **503** (`AUTH_SERVICE_UNAVAILABLE`), not a false “session expired” 401.
- **Deleted-account tombstones** — `public.users.deleted_at` marks closed accounts; `require_user` clears cookies and returns 401 `ACCOUNT_DELETED`; explore/jobs use `deleted_user_ids()` to hide tombstones.
- **Guards bind Sentry** — `require_user` calls `bind_sentry_user` on the backend for error context.

---

## What those two lines do

```typescript
const nextUser = await getMe();
setUser(nextUser);
```

| Piece | Role |
|--------|------|
| `getMe()` | Frontend function that calls `GET /api/v1/auth/me` (HTTP request to backend) |
| `setUser(nextUser)` | React state update: stores the user object in memory so the app knows who's logged in |

Plain English: When the app loads or we need to refresh, the frontend asks the backend "who am I?" and the backend looks at the session cookie, verifies it's valid, then returns the user's data. The frontend stores that in React state.

---

## Example: App startup

A user opens Eventtz after signing in yesterday. Browser has the session cookie from the last login.

**Flow:**
1. Next.js loads `frontend/app/layout.tsx` → wraps app in `AuthProvider`
2. `AuthProvider` runs `useEffect` → calls `refreshUser()` → calls `getMe()`
3. Backend validates the cookie, returns user data
4. Frontend sets `user` in React state
5. App shows the dashboard (because `isAuthenticated` is now `true`)

---

## Step 1 — Frontend calls `getMe()`

Browser/app has loaded. `AuthProvider` needs to check: "Am I logged in?"

**File:** `frontend/components/auth/AuthProvider.tsx`

```46:71:frontend/components/auth/AuthProvider.tsx
  useEffect(() => {
    const interceptorId = installAuthInterceptors(api, {
      onUserUpdate: setUser,
    });

    return () => {
      api.interceptors.response.eject(interceptorId);
    };
  }, []);

  const refreshUser = async () => {
    try {
      const nextUser = await getMe();
      setUser(nextUser);
    } catch {
      setUser(null);
    }
  };

  useEffect(() => {
    refreshUser().finally(() => setLoading(false));
  }, []);
```

On mount, `installAuthInterceptors` (`frontend/lib/auth-interceptors.ts`) wires a response interceptor: on **401** (except sign-in/up/out), it calls `refreshSession()` → `getMe()` → `onUserUpdate`, then retries the original request. Failed refresh clears user state.

When the component mounts, the interceptor effect runs first, then `refreshUser()` via a second `useEffect`. If `getMe()` succeeds, user is set. If it fails (no valid cookie), `user` is `null`.

**File:** `frontend/lib/auth-api.ts`

```67:70:frontend/lib/auth-api.ts
export async function getMe(): Promise<AuthUser> {
  const { data } = await api.get<ApiEntityResponse<AuthUser>>("/api/v1/auth/me");
  return data.user;
}
```

Simple HTTP `GET` request to `/api/v1/auth/me`. Returns the user object from the response.

---

## Step 2 — Backend route receives the request

Backend has a route handler for `GET /me`. It's part of the auth router.

**File:** `backend/app/features/auth/http/routes.py`

```230:236:backend/app/features/auth/http/routes.py
@router.get("/me", response_model=MeResponse)
async def me(
    request: Request,
    response: Response,
):
    """Return the signed-in user from the cookie access token."""
    return MeResponse(user=require_user(request, response))
```

The route is registered on `@router.get("/me")` (the router prefix is `/auth`, so full path is `/api/v1/auth/me`). It calls **`require_user`**, which validates the cookie, merges `public.users` profile data, checks tombstones/suspension, binds Sentry, and returns an `AuthUser` — or raises 401/403.

---

## Step 3 — Validate the session cookie

Backend needs to check: "Is this request from someone with a valid session?"

**Shared primitive** — `validate_session_access_token()` in `backend/app/features/auth/session.py`:

```75:108:backend/app/features/auth/session.py
def validate_session_access_token(
    access_token: str,
    response: Response,
    *,
    unavailable_raises: bool,
) -> tuple[dict[str, Any] | None, str | None]:
    """Validate a JWT access token and return ``(user, failure_detail)``.

    ``failure_detail`` is set when ``user`` is None after a rejected token (malformed JWT
    or failed Supabase lookup). Optional-session callers ignore the detail and treat
    rejection as anonymous.

    When ``unavailable_raises`` is True (protected routes), Supabase outages raise 503.
    """
    if not _looks_like_jwt(access_token):
        clear_session_cookies(response)
        return None, auth_messages.SESSION_EXPIRED

    service = SupabaseAuthService(get_supabase_auth_client())
    result = service.get_user_from_access_token(access_token)
    if result.get("success"):
        return result["user"], None
    if result.get("unavailable"):
        if unavailable_raises:
            raise HTTPException(
                status_code=503,
                detail=result.get("error", auth_messages.AUTH_SERVICE_UNAVAILABLE),
            )
        return None, None
    clear_session_cookies(response)
    error_detail = result.get("error")
    if isinstance(error_detail, str) and error_detail.strip():
        return None, error_detail
    return None, auth_messages.SIGN_IN_REQUIRED
```

**Strict path** — `get_current_user_or_raise` reads the cookie, calls `validate_session_access_token(..., unavailable_raises=True)`, and raises 401 when no user:

```111:127:backend/app/features/auth/session.py
def get_current_user_or_raise(request: Request, response: Response) -> dict[str, Any]:
    """Validate session cookie and return the Supabase auth user (before merging public.users)."""
    access_token = request.cookies.get(ACCESS_COOKIE_NAME)
    if not access_token:
        raise HTTPException(status_code=401, detail=auth_messages.SIGN_IN_REQUIRED)

    user, failure_detail = validate_session_access_token(
        access_token,
        response,
        unavailable_raises=True,
    )
    if user is not None:
        return user
    raise HTTPException(
        status_code=401,
        detail=failure_detail or auth_messages.SIGN_IN_REQUIRED,
    )
```

**`/me` and protected routes** use `require_user`, which merges profile data and enforces tombstones/suspension:

```28:46:backend/app/features/auth/http/guards.py
def require_user(request: Request, response: Response) -> AuthUser:
    """Return session user with public.users role and email."""
    auth_user = get_current_user_or_raise(request, response)
    user = build_app_user(auth_user)
    try:
        db_profile = fetch_user_profile(user.id)
    except Exception:
        logger.warning("require_user: profile lookup failed user_id=%s", user.id)
        db_profile = None
    if profile_is_deleted(db_profile):
        clear_session_cookies(response)
        raise HTTPException(status_code=401, detail=auth_messages.ACCOUNT_DELETED)
    if user.account_suspended and user.user_type in ("client", "vendor"):
        raise HTTPException(
            status_code=403,
            detail=auth_messages.ACCOUNT_SUSPENDED_CONTACT,
        )
    bind_sentry_user(user_id=user.id, user_type=user.user_type)
    return user
```

**Optional session (explore)** — public browse still reads cookies when present, but never 401s guests. `get_optional_session_user` uses the same validator with `unavailable_raises=False`:

```113:140:backend/app/features/auth/http/guards.py
def get_optional_session_user(request: Request, response: Response) -> AuthUser | None:
    """Return the signed-in user when a valid session cookie is present, else None.

    Public browse routes use this to scope QA test vendors without requiring sign-in.
    Invalid or expired sessions are treated as anonymous (cookies cleared, no 401).
    """
    access_token = request.cookies.get(ACCESS_COOKIE_NAME)
    if not access_token:
        return None

    auth_user, _failure_detail = validate_session_access_token(
        access_token,
        response,
        unavailable_raises=False,
    )
    if auth_user is None:
        return None

    user = build_app_user(auth_user)
    try:
        db_profile = fetch_user_profile(user.id)
    except Exception:
        logger.warning("get_optional_session_user: profile lookup failed user_id=%s", user.id)
        db_profile = None
    if profile_is_deleted(db_profile):
        clear_session_cookies(response)
        return None
    return user
```

| Caller | Missing cookie | Invalid token | Supabase down |
|--------|----------------|---------------|---------------|
| `require_user` / `/me` | 401 | 401 (+ clear cookies) | 503 |
| `get_optional_session_user` (explore) | `None` (guest) | `None` (guest) | `None` (guest) |

**Deleted accounts** — `profile_is_deleted` in `accounts.py` checks `public.users.deleted_at`. Closed accounts keep a tombstone row (GDPR); they cannot sign in again and are excluded from marketplace listings via `deleted_user_ids()`.

---

## Step 4 — Build the app user and return

Backend has the raw Supabase user. Now shape it into the response format.

**File:** `backend/app/contracts/auth.py`

```81:83:backend/app/contracts/auth.py
class MeResponse(BaseModel):
    success: bool = True
    user: AuthUser
```

The response always has `success: true` and a `user` object.

**File:** `backend/app/contracts/auth.py`

```12:30:backend/app/contracts/auth.py
class AuthUser(BaseModel):
    """Merged auth identity + Eventtz app profile returned on sign-in and /me."""

    id: str
    email: str | None = None
    user_type: UserType | str = "client"
    admin_role: AdminRole | str | None = None
    account_suspended: bool = False
    email_verified: bool | None = None
    preferred_name: str | None = None
    client_onboarding_completed: bool | None = None
    user_metadata: dict[str, Any] = Field(default_factory=dict)
    app_metadata: dict[str, Any] = Field(default_factory=dict)

    model_config = ConfigDict(extra="ignore")
```

The user object includes:
- **id, email** — From Supabase auth
- **user_type** — Stored in Supabase metadata during signup (client or vendor)
- **admin_role** — If user is an admin
- **account_suspended** — If admin has suspended this account
- **email_verified** — Synced from public.users table
- **preferred_name** — Clients can set a display name (vendors see this)
- **client_onboarding_completed** — Whether client finished onboarding
- **user_metadata, app_metadata** — Raw metadata from Supabase auth

**HTTP response example:**

```json
{
  "success": true,
  "user": {
    "id": "abc-123-def",
    "email": "alice@example.com",
    "user_type": "vendor",
    "admin_role": null,
    "account_suspended": false,
    "email_verified": true,
    "preferred_name": "Alice's Catering",
    "client_onboarding_completed": null,
    "user_metadata": {},
    "app_metadata": {}
  }
}
```

---

## Step 5 — Frontend stores the user

Backend returned the user. Frontend now updates React state.

**File:** `frontend/components/auth/AuthProvider.tsx`

```60:67:frontend/components/auth/AuthProvider.tsx
  const refreshUser = async () => {
    try {
      const nextUser = await getMe();
      setUser(nextUser);
    } catch {
      setUser(null);
    }
  };
```

- **Success:** `setUser(nextUser)` → all pages now see the user via `useAuth()` hook
- **Failure (401 error):** `setUser(null)` → app treats user as logged out
- **503 from auth:** axios interceptor may surface “service unavailable”; cookies are **not** cleared server-side

**Sign-in** verifies the session immediately after `apiSignIn` — if `/me` fails, the user sees `SESSION_VERIFY_FAILED`:

```93:103:frontend/components/auth/AuthProvider.tsx
      signIn: async (email, password) => {
        await apiSignIn(email, password);
        try {
          const nextUser = await getMe();
          setUser(nextUser);
          track(MixpanelEvents.user_signed_in);
          return nextUser;
        } catch {
          setUser(null);
          throw new Error(SESSION_VERIFY_FAILED);
        }
      },
```

`SESSION_VERIFY_FAILED` is defined in `frontend/lib/auth-messages.ts` — copy for when cookies were set but profile verify failed.

**Sentry + Mixpanel identity** — when `user` changes, analytics and error monitoring attach the user id:

```73:84:frontend/components/auth/AuthProvider.tsx
  useEffect(() => {
    if (!user?.id) {
      resetSentryUser();
      return;
    }
    identifyMixpanelUser(user.id, {
      email: user.email,
      user_type: user.user_type ?? null,
      admin_role: user.admin_role ?? null,
    });
    identifySentryUser(user.id, user.user_type ?? null);
  }, [user]);
```

`identifySentryUser` (`frontend/lib/sentryUser.ts`) sets `Sentry.setUser({ id })` and a `user_type` tag — no email in Sentry.

**Sign-out** clears both Mixpanel and Sentry:

```118:128:frontend/components/auth/AuthProvider.tsx
      signOut: async () => {
        try {
          track(MixpanelEvents.user_signed_out);
          await apiSignOut();
        } finally {
          setUser(null);
          resetMixpanel();
          resetSentryUser();
          clearVendorCopilotBriefCache();
        }
      },
```

Now any component can call `useAuth()` and read:
- `user` — The full user object (or null)
- `isAuthenticated` — Boolean (is `user` set?)

---

## Full chain (one picture)

```
App loads (AuthProvider mounts):
  ↓
useEffect runs refreshUser()
  ↓
getMe() → GET /api/v1/auth/me
  ↓
Backend: require_user()
  → get_current_user_or_raise → validate_session_access_token
  → build_app_user + tombstone/suspension checks
  ↓
If valid:
  Backend returns AuthUser (id, email, user_type, etc.)
  ↓
Frontend receives response
  → setUser(nextUser)
  → React state updated
  → Components can now read `isAuthenticated`, `user.id`, etc.

If invalid (no token, expired, or corrupted):
  Backend clears cookies & returns 401
  ↓
Frontend catch block:
  → setUser(null)
  → React state shows logged out
  ↓
Next render: pages redirect to login
```

---

## Why this design?

- **Cookie-based sessions:** When you sign in, the backend sets an `access_token` cookie (httponly, so JavaScript can't steal it). No need for frontend to store tokens.
- **Validate on every use:** `/me` doesn't trust the frontend. It re-validates the cookie with Supabase every time. If someone tries to use an old/stolen token, it fails.
- **Clear on error:** If the token is corrupted or expired, cookies are cleared immediately. Frontend can't accidentally use stale tokens.
- **React state:** Once validated, the user is stored in React Context so all pages and components have it without extra API calls.

---

## When things break

| Symptom | First file to open |
|---------|-------------------|
| User sees "Not signed in" after logging in | `frontend/components/auth/AuthProvider.tsx` (check if `refreshUser` is being called) |
| `/me` returns 401 but user has a valid cookie | `session.py` → `validate_session_access_token` (check Supabase auth validation) |
| `/me` returns 503 | `session.py` — Supabase timeout via `unavailable_raises=True`; not an expired session |
| Sign-in succeeds but UI shows verify error | `AuthProvider.tsx` `signIn` — `SESSION_VERIFY_FAILED` after failed post-sign-in `getMe()` |
| 401 loops on API calls | `auth-interceptors.ts` — refresh + retry; check refresh token cookie |
| Deleted user can still hit protected routes | `guards.py` — `profile_is_deleted` should clear cookies |
| User sees their data but then suddenly logs out | `backend/app/features/auth/session.py` (cookies may be getting cleared) |
| Frontend receives user data but it's not stored in state | `frontend/components/auth/AuthProvider.tsx` (check `setUser` is being called) |

---

## Key concepts from this slice

- **Session cookies** — HTTP-only cookies set by the backend after sign-in. Browser sends them automatically with every request to the backend.
- **Access token** — A JWT (JSON Web Token) inside the cookie. Signed by Supabase, so the backend can verify it without calling Supabase again (but we do anyway for extra safety).
- **401 Unauthorized** — HTTP status code meaning "you're not signed in or your session expired; go sign in again."
- **AuthProvider / React Context** — A component that wraps the whole app and provides `useAuth()` hook so any page can read the current user without prop drilling.

---

## TL;DR

- **`GET /me`** = Backend endpoint that validates your session cookie and returns your user data.
- **`require_user()`** = Guard used by `/me`: validates cookie, merges profile, checks tombstones/suspension.
- **`validate_session_access_token()`** = Shared JWT + Supabase check; strict vs optional callers differ on 503/401.
- **`get_optional_session_user()`** = Explore-only: valid cookie → user; else anonymous (no 401).
- **`installAuthInterceptors()`** = Frontend 401 → refresh session → retry; updates React user via `onUserUpdate`.
- **`refreshUser()`** = Frontend function that calls `getMe()` and stores result in React state.
- **Session cookie** = Set by backend after sign-in; sent automatically on every request; cleared if invalid.
- **Result** = App loads → frontend checks "who am I?" → backend validates session → frontend stores user in React → pages can now show personalized content.

If you want, next we can trace **guards** (how routes check `isAuthenticated` before showing a page) or **session refresh** (what happens when the access token expires but refresh token is still valid) — both separate from this `/me` slice.
