# AIDA Autopilot

Autonomous service desk agent for Halo PSA. The existing 1st line workflow hands it tickets
(via webhook); it then **owns each ticket to completion** — fact-checking the report against
NinjaRMM and ticket history, following Halo KB procedures, emailing the user, verifying fixes
before claiming them, chasing silence, and escalating with a structured handover when it
can't verify a resolution.

**Read [PLAN.md](PLAN.md) first** — it covers the process design, the bottlenecks this
replaces, the ticket lifecycle, and the rollout plan (including shadow mode).
**[DEPLOYMENT.md](DEPLOYMENT.md)** covers hosting: Railway for the pilot, in-house Docker
for full production, and the cutover runbook between them.

This is a standalone project: copy this directory into its own repository as-is.

## How it works

- Halo webhook (`new_ticket` / `user_reply`) → `POST /webhooks/halo` → the agent runs once,
  bounded, against that ticket
- Every run ends in a state (`awaiting_user`, `monitoring`, `resolved_pending_confirm`,
  `escalated`, `closed`, …) and every non-terminal state has a timer that wakes the agent
  again — no ticket ever just sits
- All user communication and the audit trail live in the Halo ticket itself; a local SQLite
  DB holds only timers, run history, and the agent's scratchpad
- `AIDA_SHADOW_MODE=true` (the default) runs the entire process but writes would-be emails,
  status changes, escalations, and device actions as `[SHADOW]` private notes instead of
  executing them — the safe rollout gate

## Run it

```bash
cp .env.example .env   # fill in Halo, NinjaRMM, OpenRouter credentials
npm install
npm start
```

Docker:

```bash
docker build -t aida-autopilot .
docker run -p 3002:3002 -v aida-data:/data --env-file .env aida-autopilot
```

## Endpoints

| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | `/webhooks/halo` | `X-Aida-Token` header | Halo webhook receiver |
| POST | `/api/run/:ticketId` | `X-Aida-Token` header | Manual (re-)trigger for testing |
| GET | `/health` | none | Integration status + shadow-mode flag |

## Halo configuration

1. API application (client credentials): tickets/actions read+write, users read, KB read
2. An "AIDA" agent account — put its ID in `AIDA_HALO_AGENT_ID` (the agent stands down
   whenever a ticket is reassigned to a human)
3. Two webhooks to `POST /webhooks/halo` with header `X-Aida-Token: <AIDA_WEBHOOK_SECRET>`:
   - ticket assigned to AIDA → payload `{ "ticket_id": <id>, "event": "new_ticket" }`
   - customer reply on an AIDA ticket → payload `{ "ticket_id": <id>, "event": "user_reply" }`
4. A workflow rule in the existing 1st line workflow that assigns in-scope tickets
   (pilot client + ticket types) to the AIDA agent
5. Verify the status IDs in `.env` match your instance — they vary

## Testing without webhooks

```bash
curl -X POST http://localhost:3002/api/run/12345 \
  -H "X-Aida-Token: $AIDA_WEBHOOK_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"reason":"manual test"}'
```

Run it against a test ticket with shadow mode on and read the `[SHADOW]` notes it leaves.
