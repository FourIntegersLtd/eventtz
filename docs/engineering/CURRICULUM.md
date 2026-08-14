# Eventtz Engineering Curriculum

A day-by-day path from "I can read the repo" to "I can design a feature in it."

Each day = **one concept**, **12 steps**, **real code**.

---

## Track overview

| Day | Topic | Core question |
|-----|-------|---------------|
| 1 | How Eventtz is organized | Where does a user action go in the codebase? |
| 2 | Modeling a real-world problem | What things exist, how do they relate, and what gets frozen vs updated? |
| 3 | *TBD in future lessons* | — |

Lesson files live in [`lessons/`](lessons/). Rules for the teacher agent: [`lessons/_SPINOFF_RULES.md`](lessons/_SPINOFF_RULES.md).

---

## The 12-step lesson template

Use this structure for every day. The teacher delivers steps 1–11 in the lesson; step 12 is the student's exit ticket.

### 1. Objective

One sentence: "After today you can …"

### 2. Recap

Bridge from yesterday in 2–4 sentences. No new material.

### 3. Hook

A concrete Eventtz moment (booking enquiry, vendor edits a package, admin dispute, etc.) that exposes why today's concept matters.

### 4. Concept

Explain the single idea in plain English. No jargon yet — that comes in step 5.

### 5. Vocabulary

Define today's terms. Each new term must be added to [`GLOSSARY.md`](GLOSSARY.md).

### 6. Mental Model

A diagram, table, or analogy the student could sketch on a whiteboard.

### 7. Code Safari

Walk 2–4 real files. Show entities, relationships, or boundaries in production code.

### 8. Guided Exercise

One small task: label a diagram, trace a field, or list entities in a flow. Doable in ~5 minutes.

### 9. Break-It Scenario

A "why did we build it this way?" question about real Eventtz code.

**Teacher must wait for the student's answer before explaining.**

### 10. Common Mistakes

What juniors confuse when applying today's concept.

### 11. Self-Check

Three short questions. Answers live at the bottom of the day's lesson file.

### 12. Your Turn (exit ticket)

The student explains today's concept in their own words. The day is not complete until this is done.

---

## Day-specific code search hints

### Day 1 — How Eventtz is organized

- `backend/app/http/router.py`
- `backend/app/features/`
- `backend/app/contracts/`
- `frontend/app/`

### Day 2 — Modeling a real-world problem

- `backend/sql/001_*.sql`
- `booking_requests` table (`backend/sql/010_booking_requests.sql`)
- `backend/app/contracts/`
- `frontend/lib/domain-types.ts`

### Day 3+

Added when those lessons are written.

---

## Progress tracking

See [`PROGRESS.md`](PROGRESS.md) for per-day status: `not_started` | `in_progress` | `complete`.
