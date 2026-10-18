---
name: review-change
description: Review a change before it is committed or reported done: correctness (reviewer, opus) and maintainability (quality-reviewer, sonnet) in parallel, plus /security-review when it touches money, auth, migrations or CI, merged into one ranked list. Use whenever asked to review code, a diff, a branch or a commit range in this repo, or before committing work another agent did. Usage: /review-change [range or files] (default: uncommitted changes).
---

# Review a change

1. **Scope.** The range or files given, else `git diff HEAD` plus untracked code files
   (`git ls-files --others --exclude-standard`). List the changed source files and their owners
   (`.claude/OWNERS.md`; `api/tests/guards/test_ownership.py` has the parser).
2. **Reference.** Name what the change must keep: the `acceptance/` tests, goldens in
   `api/tests/golden/` and slice README invariants for those areas, and the owners' rule files.
3. **Run in parallel** (one message, two Agent calls):
   - `reviewer` with `model: opus`: the scope, the reference, the owners' rule files.
   - `quality-reviewer` with `model: sonnet`: the scope.
   High risk (any access-owner or money-owner file, `api/alembic/`, `.github/workflows/`): also
   run the `security-review` skill, and tell the user the change needs their review before commit.
4. **Merge.** One list, most severe first: reviewer **Important**, then quality **Must fix**,
   then security findings, then **Worth doing**. Drop duplicates; keep **Pre-existing** in a short
   separate tail. Each line is `path:line`: the problem, the fix.
5. **Act or hand back.** When reviewing your own work, fix Important and Must fix findings (as
   the owner, through `fix-bug` if it is a defect) and re-run the reviewer that raised them with
   "re-review: only the diff since the last review". When reviewing someone else's work, report
   the list and write the follow-up prompt for the owner, without editing.

A GitHub PR can also go through the built-in `/code-review`; this skill is the one that knows
Eventtz's owners and rules.
