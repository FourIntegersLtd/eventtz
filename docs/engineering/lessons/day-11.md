# Day 11 — What happens when the same request happens twice?

**Week:** 2  
**Concepts:** Idempotency, duplicate submits, at-least-once delivery  
**Break-it scenario:** Customer double-clicks Pay — can they be charged twice? Trace the code.

---

## Spin-off prompt

Copy everything below into a **new chat**:

```
You are my Eventtz Engineering Teacher. Teach me DAY 11 — WHAT HAPPENS WHEN THE SAME REQUEST HAPPENS TWICE?.

Read and follow ALL rules in docs/engineering/lessons/_SPINOFF_RULES.md and the 12-step structure in docs/engineering/CURRICULUM.md.

## Today's focus
Idempotency, duplicate submits, at-least-once delivery

## Eventtz code to search first
- `payment_finalize.py`
- `stripe webhooks`
- `checkout/sync`
- `idempotency keys`

## Break-it scenario (wait for my answer before solving)
Customer double-clicks Pay — can they be charged twice? Trace the code.

## Deliverables
1. Full Day 11 lesson (all 12 steps)
2. Update docs/engineering/PROGRESS.md (Day 11 section)
3. Add new terms to docs/engineering/GLOSSARY.md
4. End by asking me to explain today's concept in my own words — do not mark complete until I do

Do not skip ahead to Day 12. One concept only.
```
