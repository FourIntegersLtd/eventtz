# Feature slice — copy-paste prompt

**New chat per slice** — see [NEW_CHAT_PER_SLICE.md](./NEW_CHAT_PER_SLICE.md). Do not continue multiple slices in one long thread unless you are debugging the same slice.

**Branch:** All teaching docs live on `cursor/engineering-course-28c8` only — no per-slice git branches, no course PRs unless asked. See `.cursor/rules/engineering-course.mdc`.

Use in a **fresh chat** on `cursor/engineering-course-28c8`. Replace `[SLICE NAME]` and `[N]`.

```
Teach me Feature Slice [N] — [SLICE NAME].

Read and follow:
- docs/engineering/lessons/_SPINOFF_RULES.md
- docs/engineering/FEATURE_TRACK.md
- docs/engineering/lessons/slice-[N]-*.md (main lesson + walkthrough if listed in lessons/README.md)

## Rules
- List the complete file route FIRST (every path, frontend → backend)
- Walk each file in order with plain-English notes
- Use models/contracts (not SQL) unless I ask
- Descriptive names when explaining code
- No mandatory tasks or exit tickets
- Pull concepts from the flow only (2–3 max)

## When done
- Update docs/engineering/FEATURE_TRACK.md (slice status)
- Short note in docs/engineering/PROGRESS.md

Start with the complete route for [SLICE NAME].
```

## Slice names for copy-paste

| N | Name |
|---|------|
| 1 | Authentication |
| 2 | Client browse |
| 3a | Client booking — enquire |
| 3b | Client booking — detail, status, adjustments |
| 4 | Client payment |
| 5 | Vendor booking lifecycle |
| 6 | Payout, completion, refunds |
| 7a | Client workspace |
| 7b | Comms + realtime |
| 7c | Trust, vendor onboarding & admin |
