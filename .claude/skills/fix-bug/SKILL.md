---
name: fix-bug
description: Fix a defect at its root cause and close the gap that let it through. Use whenever something is reported broken, wrong or regressed. Owner hand-off, reproduce with a failing test, fix the cause, name the check that should have caught it and add it in the same change, find the commit that caused it.
---

# Fix a bug

Start as, or hand to, the owner for the paths (`.claude/OWNERS.md`); read its rule file first
(`.claude/rules/<area>.md`).

1. **Reproduce with a failing test** at the lowest level that shows it (in the running app first
   if it is a screen: `make dev` + `npm run dev`). No test, no fix. Watch it fail for the reason
   the report gives.
2. **Fix the root cause**, not the symptom: the smallest change, in the right layer. A guard that
   hides the symptom is not a fix.
3. **Name the kind of bug and the check that should have caught it** (a guard in
   `api/tests/guards/`, a golden, an `acceptance/` test, a rule's "What a failure looks like
   here" line). If none exists, add or extend one in the same change. Say both in the report.
4. **Prove** with the owner's verify skill at the level it names.
5. **Find the commit that caused it** (`git blame` the lines you fixed, at the parent commit).
   The commit message, when the user asks for one, says "caused by <sha>".
6. Run `quality-reviewer`; add `reviewer` (opus) and `/security-review` for auth, money,
   deletion or a migration. Add the failure class to the owner's rule file if it was new.
