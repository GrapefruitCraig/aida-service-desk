# T3C 1st Auto — Process Plan

An autonomous service desk agent that is **handed tickets by the existing 1st line workflow**
and then **owns them through to completion** — replying to users, verifying fixes, chasing
silence, and escalating with evidence — entirely through Halo PSA.

This document is the process design. The code in this repo implements it.

---

## 1. Why a new system

The previous build (`aida-service-desk`) was a chat assistant: a web UI where a person talks
to an agent that has Halo/Ninja tools. Useful as a copilot, but it cannot be an autonomous
1st line, because its architecture caps what the *process* can be. The lessons learned there
define the requirements here.

## 2. Bottlenecks in the existing process

### In the existing AIDA build

| # | Bottleneck | Consequence | Mechanism in the new design |
|---|---|---|---|
| 1 | **Human-initiated** — agent only acts when someone opens the chat and types | Every ticket still needs a person to drive it; "autonomous" is impossible | Halo workflow fires a webhook the moment a ticket is routed to AIDA; zero-touch pickup |
| 2 | **Request-scoped agent** — the whole agentic loop lives inside one HTTP/SSE request (max 10 tool calls, dies when the request ends) | Agent cannot wait for anything: a reboot, a scan, a user reply | Event-driven runs: each webhook/timer wakes the agent for one bounded run; state persists between runs |
| 3 | **Cannot verify over time** | "Tested fixes only" is unenforceable — a reboot takes minutes, the request is gone | `monitoring` state + follow-up scheduler: act → schedule re-check → verify → only then claim fixed |
| 4 | **One-way Halo integration** — creates/updates tickets but never hears back | User email replies are invisible; tickets the agent touched go stale | Webhook on customer reply re-wakes the agent on that ticket |
| 5 | **Chat is the user channel** | Client end users won't sit in a bespoke chat; they email the desk | All user communication happens as Halo email actions on the ticket — no new UI for end users |
| 6 | **No memory** — conversation lives in the browser tab | Close the tab, context gone | Durable record lives in the ticket itself (notes/actions) + a small local DB for scheduler state and the agent's scratchpad |
| 7 | **Unscoped tools** — the chat agent could act on any ticket/device mentioned | Scope creep; hard to audit | Write-tools are **bound to the current ticket**; cross-ticket access is read-only |

### In the human 1st line process

| # | Bottleneck | Consequence | Mechanism in the new design |
|---|---|---|---|
| 8 | **Triage delay** — tickets sit in the New queue until picked up | Time-to-first-touch measured in hours | Pickup in seconds via webhook |
| 9 | **Awaiting-user black hole** — engineer asks a question, ticket idles for days, nobody chases | Longest single contributor to resolution time | Agent replies to user responses immediately (webhook), nudges silent users on a timer, closes per policy after N nudges |
| 10 | **Unverified "fixed" claims** | Reopens, repeat contacts, eroded trust | Resolution gated on tool-verified outcome + user confirmation (`resolved_pending_confirm`) |
| 11 | **Inconsistent escalation handovers** | 2nd line re-does discovery | Structured handover enforced: facts verified (with source), attempts with tested results, recommended next action |
| 12 | **KB gaps are invisible** | Same issues hand-solved repeatedly | Every escalation records *why* (incl. "no KB coverage"); the escalation log becomes the KB authoring queue |

Bottlenecks 1–4 are the reasons this is a new system rather than an iteration: they are
architectural, not prompt-level.

## 3. The new process

```
            Halo PSA — existing 1st line workflow (unchanged)
                          │
         workflow rule: ticket matches AIDA criteria
         (client opted in, ticket type in scope)
                          │  assign to AIDA queue/agent
                          ▼
              ┌── webhook: new ticket ──────────────┐
              │                                      │
   user replies to ticket ──► webhook: user reply ──►│
              │                                      ▼
              │                          T3C 1st Auto service
              │                  ┌──────────────────────────────────┐
              │                  │ per-ticket queue + follow-up     │
              │                  │ scheduler (SQLite)               │
              │                  │        │                         │
              │                  │   agent run (bounded tool loop)  │
              │                  │   facts-only · KB-first ·        │
              │                  │   verify-then-claim              │
              │                  └──────────────────────────────────┘
              │                                      │
              ▼                                      ▼
   all communication, notes, status changes land in the Halo ticket
                          │
        ┌─────────────────┼──────────────────────┐
        ▼                 ▼                      ▼
   resolved + verified   escalated to 2nd line   returned to human
   + user confirmed      with structured         1st line queue
   → closed              handover                (out of scope)
```

### Ticket lifecycle (agent states)

Every agent run ends by choosing exactly one state. **No state exists without a wake-up
condition** — that is the rule that kills idle tickets.

| State | Meaning | Woken by |
|---|---|---|
| `triaging` | First run: gather facts, fact-check the report, search KB | (immediately on webhook) |
| `awaiting_user` | Asked the user a non-technical question by email | User reply webhook, or nudge timer (`NUDGE_HOURS`, max `MAX_NUDGES`, then close-no-response per desk policy) |
| `monitoring` | Action taken (reboot, script, fix applied) — verification pending | Follow-up timer set by the agent |
| `resolved_pending_confirm` | Fix **verified by tools**; user told and asked to confirm | User reply, or auto-close timer (`CONFIRM_CLOSE_HOURS`) |
| `escalated` | Handed to 2nd line with structured handover | Terminal for the agent |
| `closed` | Resolved-confirmed or closed-no-response | Terminal |
| `needs_attention` | A run errored or ended without an outcome | Human review (visible in DB + private note on ticket) |

### Operating rules (enforced in the system prompt and runner)

1. **Facts only** — every statement comes from a tool result, a retrieved KB article, or the
   user (treated as a claim until verified). Client setups are known-incomplete: never fill
   gaps from general IT knowledge.
2. **Fact-check within ticket scope** — verify user claims against NinjaRMM/Halo before
   acting; write-tools are bound to the current ticket.
3. **KB first** — search the Halo KB before giving guidance; follow applicable articles
   exactly and cite them; no applicable KB + no tool path = escalate, don't improvise.
4. **Non-technical questions only** — error text, what's on screen, when it started, who else
   is affected. Never ask for anything a tool can fetch.
5. **Tested fixes only** — never claim fixed (or promise a fix) without tool verification;
   after any action, enter `monitoring` and re-check before communicating an outcome.
6. **Disruptive actions** (reboot, scripts) only when a KB article documents the procedure
   for the issue **or** the user has agreed by reply — and always verified afterwards.
7. **Humans can take over at any time** — reassign the ticket away from the AIDA agent in
   Halo; the agent checks ownership at the start of every run and stands down.

## 4. Integration with the existing 1st line workflow

The existing workflow stays the owner of routing. AIDA is one more assignee it can route to.

**Entry** — add one rule to the existing 1st line workflow:
> When a ticket enters the 1st line queue AND (client is opted in) AND (ticket type is in
> scope) → assign to the AIDA agent/queue → fire webhook `new_ticket`.

**During** — one more webhook:
> When a customer note/reply is added to a ticket assigned to AIDA → fire webhook `user_reply`.

**Exit** — three paths, all landing back in the existing process:
- *Resolved*: ticket closed with verified resolution note — normal closure reporting applies.
- *Escalated*: ticket moves to the 2nd line team with the structured handover — exactly as a
  human 1st liner would hand it over.
- *Out of scope / stand-down*: ticket returns to the human 1st line queue untouched beyond a
  private note explaining why.

Nothing else about the existing workflow changes. Removing AIDA = disabling the routing rule.

## 5. Key design decisions

- **The ticket is the database.** All user comms, findings, and outcomes are recorded as
  Halo actions, so engineers see everything in the tool they already use, and the agent can
  rebuild context from the ticket alone. The local SQLite DB holds only scheduler state,
  run history, and the agent's private scratchpad.
- **Event-driven, not session-driven.** The agent is woken per event (webhook or timer),
  does one bounded run, chooses a state, and exits. Crash-safe, horizontally simple, and
  every run is auditable.
- **Single terminal tool.** Each run must end with `finish_run(state, …)`; the runner — not
  the model — executes the side-effects of that state (schedule nudge, escalate with
  handover, close with note). Lifecycle consistency is code-enforced, not prompt-hoped.
- **Shadow mode** (`T3C_SHADOW_MODE=true`): the agent runs the full process but all
  user-facing emails, status changes, escalations and device actions are written as private
  notes prefixed `[SHADOW]` instead of executed. This is the safe rollout gate.
- **Headless.** No end-user UI. Ops surface is the Halo ticket plus `/health`.

## 6. Rollout plan

**Phase 0 — decisions needed from us** (blockers, cheap to answer):
- [ ] Confirm Halo status IDs and ticket type IDs on our instance (code defaults: 1=new,
      2=in progress, 3=awaiting user, 4=resolved, 5=closed — verify, they vary per instance)
- [ ] Create the AIDA agent account in Halo; record its agent ID (ownership checks)
- [ ] Choose the escalation target team ID
- [ ] Set nudge policy (default: nudge at 24h, 2 nudges, then close-no-response)
- [ ] Pick the pilot client

**Phase 1 — Halo configuration:**
- [ ] API application (client credentials): tickets/actions read+write, users read, KB read
- [ ] Webhooks: `new_ticket` and `user_reply` → `POST /webhooks/halo` with the shared secret
      header; payload must include the ticket ID
- [ ] Workflow rule scoped to the pilot client (entry rule from §4)
- [ ] KB coverage for the pilot client's top ~10 ticket categories (pull from last 90 days of
      tickets) — **this is the highest-leverage item in the whole rollout**; resolution rate
      tracks KB coverage almost directly

**Phase 2 — deploy:**
- [ ] Deploy the container (Railway/Docker) with a persistent volume for `DATA_DIR`
- [ ] `/health` shows `halo`, `ninja`, `openrouter` all `ok`

**Phase 3 — shadow mode (1–2 weeks):**
- [ ] `T3C_SHADOW_MODE=true`; real tickets flow in, agent decisions land as private notes
- [ ] Daily review: would-have-sent replies, would-have-escalated handovers, fact-check
      quality. Tune KB and prompt until the shadow output is consistently right

**Phase 4 — pilot live:**
- [ ] Shadow mode off for the pilot client; daily escalation review
- [ ] Watch: resolution rate, time-to-first-touch, reopen rate, nudge-to-close rate

**Phase 5 — scale:**
- [ ] Onboard clients one at a time (workflow rule per client), seeding KB first
- [ ] Weekly: escalation-reason report → KB authoring queue → resolution rate rises

## 7. Out of scope (deliberately, for v1)

- Multi-instance scaling (in-process queue + SQLite is right-sized until run volume says
  otherwise; the queue interface is swappable for Redis/BullMQ)
- Auto-creating tickets from monitoring alerts (v2: Ninja alert → Halo ticket → same loop)
- Auto-writing KB drafts from resolved tickets (v2 flywheel)
