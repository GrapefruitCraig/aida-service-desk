# AIDA — Production Go-Live Checklist

Steps to take AIDA from this repo to a production autonomous 1st-line service desk.
Work through these in order; do not go live until every item in sections 1–5 is done.

## 1. Halo PSA prerequisites (per client)

The agent only works on facts from Halo and NinjaRMM, so the data has to be there:

- [ ] **Knowledge base populated** — the agent searches the Halo KB before giving any
      guidance and escalates if nothing applies. Every supported issue type needs a KB
      article; client-specific procedures need client-specific articles. An empty KB
      means the agent escalates almost everything.
- [ ] **Clients and users exist in Halo** with correct email addresses (tickets are
      matched to users by name/email).
- [ ] **Ticket types, statuses, and priorities verified** — the integration assumes
      `tickettype_id 1` (Incident), status IDs 1–5 (open → closed), and priority IDs
      1–4 (P1–P4). Check these match your Halo configuration and adjust
      `backend/src/tools/halo.js` if not.
- [ ] **2nd-line team ID identified** for escalations (passed as `targetTeamId`).

## 2. API credentials

- [ ] **Halo PSA**: Configuration → Integrations → HaloPSA API → new Client Credentials
      application. Minimum scopes: read/write tickets and actions, read users, read KB.
      Avoid scope `all` in production if your instance supports granular scopes.
- [ ] **NinjaRMM**: Administration → Apps → API → API Services (machine-to-machine),
      scopes `monitoring`, `management`, `control`. Set `NINJA_REGION` to your instance.
- [ ] **OpenRouter**: API key from https://openrouter.ai (the backend talks to the model
      via OpenRouter; default model `anthropic/claude-sonnet-4-5`, override with
      `OPENROUTER_MODEL`).

## 3. Environment variables

Set in your host (Railway Variables tab, or `docker run -e` / compose `.env`):

| Variable | Required | Notes |
|---|---|---|
| `OPENROUTER_API_KEY` | yes | |
| `OPENROUTER_MODEL` | no | defaults to `anthropic/claude-sonnet-4-5` |
| `HALO_BASE_URL` | yes | `https://your-instance.halopsa.com` |
| `HALO_CLIENT_ID` / `HALO_CLIENT_SECRET` | yes | |
| `HALO_TENANT` | instance-dependent | |
| `NINJA_CLIENT_ID` / `NINJA_CLIENT_SECRET` | yes | |
| `NINJA_REGION` | yes | `eu` / `us` / `oc` / `ca` |
| `NODE_ENV` | yes | `production` |
| `FRONTEND_URL` | yes | public URL of the deployment |

## 4. Deploy

- [ ] Build and deploy the Docker image (Railway auto-detects the `Dockerfile`, or use
      `docker compose up --build`). The single container serves frontend and backend.
- [ ] Hit `GET /api/agent/health` and confirm all three integrations report `ok`:
      `openrouter`, `halo`, `ninja`.
- [ ] Confirm HTTPS on the public URL and decide who can reach it — the chat endpoint
      has rate limiting but **no authentication**; put it behind your identity provider,
      VPN, or embed it where users are already authenticated before exposing it to clients.

## 5. Pre-production validation (per client)

Run these against a **sandbox Halo instance or test client** first:

- [ ] Report a known, KB-documented issue → agent finds the KB article, follows it,
      cites it in the ticket note.
- [ ] Report an issue with **no** KB article → agent escalates with a structured
      handover instead of improvising a fix.
- [ ] Claim something false ("my laptop is on and connected") for an offline device →
      agent checks NinjaRMM and reports the verified state, not the claim.
- [ ] Trigger a remote action (reboot) → agent asks permission first, then verifies the
      device came back online before declaring anything fixed.
- [ ] Check the questions it asks are answerable by a non-technical user.
- [ ] Verify created tickets land with the right client, user, type, and priority in Halo.

## 6. Operate

- [ ] Review escalated tickets daily in the first weeks — escalation patterns show
      where the KB has gaps; write the missing articles and the agent's resolution
      rate rises.
- [ ] Monitor `/api/agent/health` from your monitoring platform.
- [ ] Watch OpenRouter spend and set a budget alert.
- [ ] Adjust the rate limit in `backend/src/index.js` to expected per-client volume.
