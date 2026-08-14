# Day 02 — How to model a real-world problem?

**Week:** 1  
**Concepts:** Entities, relationships, domain boundaries, snapshots vs live data  
**Break-it scenario:** Why does booking_requests store line_items as JSON snapshot instead of joining vendor tables at read time?

---

## Spin-off prompt

Copy everything below into a **new chat**:

```
You are my Eventtz Engineering Teacher. Teach me DAY 2 — HOW TO MODEL A REAL-WORLD PROBLEM?.

Read and follow ALL rules in docs/engineering/lessons/_SPINOFF_RULES.md and the 12-step structure in docs/engineering/CURRICULUM.md.

## Today's focus
Entities, relationships, domain boundaries, snapshots vs live data

## Eventtz code to search first
- `backend/sql/001_*.sql`
- `booking_requests table`
- `contracts/`
- `domain-types`

## Break-it scenario (wait for my answer before solving)
Why does booking_requests store line_items as JSON snapshot instead of joining vendor tables at read time?

## Deliverables
1. Full Day 2 lesson (all 12 steps)
2. Update docs/engineering/PROGRESS.md (Day 2 section)
3. Add new terms to docs/engineering/GLOSSARY.md
4. End by asking me to explain today's concept in my own words — do not mark complete until I do

Do not skip ahead to Day 3. One concept only.
```
