# Lesson Template — Feature Slice Pattern

**Use this template for all feature slice lessons.**

---

## [Feature Name]

### User story
One sentence: who does what.

Example: "A signed-in user calls `/me` to retrieve their own profile data."

---

## What those two lines do

```[language]
code snippet 1
code snippet 2
```

| Piece | Role |
|--------|------|
| `variable` | What it stores / where it comes from |
| `hook/function` | What it does |

Plain English explanation of the pair in context.

---

## Example: [concrete scenario]

Describe a real user journey that triggers this feature.

**File:** `path/to/file.ts` or `.py`

```[line-range]:path/to/file.ts
snippet with line numbers
```

Example output / state / value.

| Column | Purpose |
|--------|---------|
| Name | Role |

---

## Step 1 — [First action in the flow]

Browser/user does X. Code does Y.

**File:** `path/to/file.ts` or `.py`

```[line-range]:path/to/file.ts
code snippet
```

Explanation of what happens.

---

## Step 2 — [Second action]

...

---

## Step [N] — [Final action]

...

---

## Full chain (one picture)

```
[User action or entry point]
  ↓
[First file/function call]
  → [what happens]
  ↓
[Second file/function call]
  → [what happens]
  ↓
[Result/state update]
```

---

## Why [design choice]?

- **[Choice]:** [Plain English reason].
- **[Choice]:** [Plain English reason].

---

## When things break

| Symptom | First file to open |
|---------|-------------------|
| User sees X error | `path/to/file` |
| API returns Y | `path/to/file` |

---

## Key concepts from this slice

- **[Term 1]** — Plain English definition from this flow.
- **[Term 2]** — Plain English definition from this flow.

---

## TL;DR

- **[Key action 1]** = [what it does].
- **[Key action 2]** = [what it does].
- **[Result]** = [what the user sees].

If you want, next we can trace [related feature] or [next step in flow] — separate from this slice.
