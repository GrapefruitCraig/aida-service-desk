# Deployment

Two-stage strategy: **Railway for shadow mode and the pilot**, then **in-house Docker for
full production**. The app is built to make the move cheap — one container, all config in
env vars, all state under `/data`. Migration is a checklist, not a project.

---

## Stage 1 — Railway (shadow mode → pilot)

1. Push this project to its own GitHub repo (`T3C-Auto`)
2. Railway → New Project → Deploy from GitHub → select the repo
   (the `Dockerfile` and `railway.toml` are auto-detected)
3. **Attach a volume** (service → Settings → Volumes) mounted at `/data`
   — without it, every redeploy wipes the follow-up timers and nudge counts
4. Set variables (service → Variables): everything in `.env.example`.
   Leave `T3C_SHADOW_MODE=true` for the shadow phase. Railway injects `PORT` itself.
5. Note the public URL Railway assigns, then configure the two Halo webhooks against it:
   - `https://<railway-url>/webhooks/halo` with header `X-T3C-Token: <T3C_WEBHOOK_SECRET>`
6. Verify: `GET https://<railway-url>/health` → `halo`, `ninja`, `openrouter` all `ok`,
   `shadow_mode: true`
7. Smoke test against a test ticket:
   `POST /api/run/<ticketId>` with the token header — then read the `[SHADOW]` notes in Halo

Keep `numReplicas = 1` (already set in `railway.toml`): the in-process queue and SQLite
assume a single instance.

## Stage 2 — in-house Docker (full production)

Prerequisites on the host:
- Docker + Compose
- Inbound HTTPS reachable by Halo's webhooks — terminate TLS with your usual reverse proxy
  (nginx/Caddy/Traefik) in front of port 3002
- A backup job for the `t3c-data` volume (single small SQLite file)

```bash
git clone <repo> && cd T3C-Auto
cp .env.example .env   # fill in — same values as Railway
docker compose up -d --build
curl -s https://<in-house-url>/health
```

## Cutover runbook (Railway → in-house)

The Halo ticket is the system of record, so cutover risk is low: the only state that lives
in the service is the scheduler (follow-up timers, nudge counts) and the agent scratchpads.

1. **Stand up in-house** alongside Railway (steps above), same env vars, verify `/health`
2. **Pause intake**: disable the Halo workflow rule that assigns tickets to AIDA — new
   tickets flow to the human 1st line queue as before AIDA existed
3. **Repoint the two Halo webhooks** to the in-house URL
4. **Move scheduler state** — either:
   - *Clean*: stop the Railway service, copy `/data/t3c_auto.db` from the Railway volume
     to the in-house volume, start in-house; or
   - *Pragmatic* (if volume export is awkward): accept the timer loss and re-arm — list
     open AIDA tickets in Halo and fire `POST /api/run/<id>` for each on the in-house
     instance. The agent rebuilds context from the ticket itself (that's by design); the
     only true loss is nudge counts resetting to zero
5. **Re-enable the workflow rule**; watch the first few tickets end-to-end in Halo
6. **Decommission the Railway service** once a day or two of traffic looks clean

Rollback at any point = repoint the webhooks back to Railway and re-enable the rule.

## Either stage — operational notes

- **Backups**: `/data/t3c_auto.db` is everything the service owns; tickets themselves are
  safe in Halo regardless
- **Monitoring**: poll `/health` from your RMM/monitoring; alert on any integration ≠ `ok`
- **Going live** is one variable: `T3C_SHADOW_MODE=false` + restart — do this per the
  rollout phases in [PLAN.md](PLAN.md), not before shadow output has been reviewed
- **Logs**: every run logs `ticket <id> run <n> (<trigger>) → <state>: <summary>` — that
  line is the audit trail outside Halo
