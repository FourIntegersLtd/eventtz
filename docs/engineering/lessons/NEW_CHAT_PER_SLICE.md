# One chat per lesson (token cost)

Long chats replay **browse + auth + parser + enquire** context on every message. That burns tokens on unrelated history.

**Best practice:** **new Cursor chat per feature slice** (or per walkthrough doc). Same git branch; fresh conversation.

---

## What persists without the chat

| Lives on branch `cursor/engineering-course-28c8` | Does not need chat memory |
|--------------------------------------------------|---------------------------|
| `docs/engineering/lessons/slice-*.md` | Full lesson + walkthrough |
| `docs/engineering/PROGRESS.md` | What's done |
| `docs/engineering/FEATURE_TRACK.md` | Slice order + plans |

Open the lesson file on GitHub while you read. The agent can re-read those files in a new chat in seconds.

---

## When to start a new chat

| Start fresh | Keep same chat |
|-------------|----------------|
| New slice (4, 5, 6, 7a…) | Follow-up on **same** slice ("explain step 6 again") |
| New walkthrough topic | Small clarification on current step |
| After merge / big code change on `main` | — |
| Chat feels slow or repetitive | — |

---

## Copy-paste: new chat for a slice

Replace `[N]` and `[NAME]`. Point at the lesson file if it exists.

```
Teach Feature Slice [N] — [NAME].

Branch: cursor/engineering-course-28c8
Read first: docs/engineering/lessons/_SPINOFF_RULES.md
Lesson file (if any): docs/engineering/lessons/slice-[N]-*.md

Rules:
- Complete file route first, then walk code in order
- Models/contracts, not SQL unless I ask
- No mandatory tasks
- Update PROGRESS and FEATURE_TRACK when slice is done

Do not recap previous slices unless I ask. Start with the route for [NAME].
```

### Ready-made slice names

| N | Paste name | Lesson file |
|---|------------|-------------|
| 1 | Authentication | `slice-1-auth-me.md` |
| 2 | Client browse | `slice-2-client-browse.md` + walkthrough |
| 3a | Client booking — enquire | `slice-3a-client-booking-enquire.md` + walkthrough |
| 3b | Client booking — detail | `slice-3b-client-booking-detail.md` + walkthrough |
| 4 | Client payment | `slice-4-client-payment.md` + walkthrough |
| 5 | Vendor booking lifecycle | `slice-5-vendor-booking.md` + walkthrough |
| 6 | Payout + completion | `slice-6-vendor-payout.md` |
| 7a | Client workspace | `slice-7a-client-workspace.md` |
| 7b | Comms + realtime | `slice-7b-comms-realtime.md` |
| 7c | Trust + admin | `slice-7c-trust-and-admin.md` |

---

## Copy-paste: deep dive only (cheapest)

When the lesson doc already exists and you only want explanation:

```
I'm on slice [N]. Read docs/engineering/lessons/[walkthrough-file].md and teach it step by step with code citations. Don't repeat slice [N-1]. No mandatory tasks.
```

---

## Copy-paste: bug / question on current slice

Stay in the **same** chat; keep it narrow:

```
Slice 3a only. Why does resolve_line_items run on the server? Cite create.py and list_pricing.py. No browse recap.
```

---

## Agent vs Cloud Agent

- **Local chat:** new chat per slice; you paste the short prompt above.
- **Cloud Agent:** each run is already a fresh VM/context; still say **which slice** and **which lesson file** in the task so it doesn't re-teach browse.

---

## Optional: even smaller prompts

If lesson + walkthrough exist on the branch, the minimum prompt is:

```
Slice 4 — client payment. Branch cursor/engineering-course-28c8. Follow _SPINOFF_RULES.md. Teach from code; route first.
```

The agent reads rules + repo; you don't paste old chat history.
