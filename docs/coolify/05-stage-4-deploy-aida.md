# Stage 4 — Deploy AIDA on Coolify

**Prerequisite:** Stage 3 gate passed. DNS record `aida.<zone>` → `<VPS_IP>` exists.

## 1. Create the application

In Coolify: **+ New → Private Repository (GitHub App)** → `grapefruitcraig/aida-service-desk`:

| Setting | Value |
|---|---|
| Branch | `main` |
| Build pack | **Dockerfile** (repo root `Dockerfile` — Coolify ignores `railway.toml`) |
| Port (exposes) | `3001` |
| Domain | `https://aida.<zone>` |
| Health check | path `/api/ping`, port `3001` (the Dockerfile HEALTHCHECK also applies) |

## 2. Environment variables

Coolify app → **Environment Variables** (mark secrets as such). Copy current values
from the Railway dashboard:

```
NODE_ENV=production
PORT=3001
OPENROUTER_API_KEY=<from Railway>
OPENROUTER_MODEL=anthropic/claude-sonnet-4-5
HALO_BASE_URL=https://<instance>.halopsa.com
HALO_CLIENT_ID=<from Railway>
HALO_CLIENT_SECRET=<from Railway>
HALO_TENANT=<from Railway, if set>
NINJA_CLIENT_ID=<from Railway>
NINJA_CLIENT_SECRET=<from Railway>
NINJA_REGION=eu
FRONTEND_URL=https://aida.<zone>
```

Note: the app sits behind Traefik; `app.set('trust proxy', 1)` is already in
`backend/src/index.js`, so rate limiting and IPs behave correctly.

## 3. Deploy & verify

1. Click **Deploy**, watch the build log to completion.
2. Verify:

```bash
curl -s https://aida.<zone>/api/ping            # {"ok":true,...}
curl -s https://aida.<zone>/api/agent/health    # all integrations "ok"
```

3. Open `https://aida.<zone>` in a browser — the React UI should load and a chat
   message should stream a response (this exercises SSE through Traefik).
4. Push-to-deploy: merge/push a trivial change to `main`, confirm auto-redeploy and
   that the healthcheck gates the rollout.

## Gate to Stage 5 — all must be true

- [ ] `/api/ping` returns ok over HTTPS on the production domain.
- [ ] `/api/agent/health` shows `openrouter`, `halo`, `ninja` all ok.
- [ ] Chat streams live in the browser (no buffering stalls, no drops mid-answer).
- [ ] Auto-deploy from `main` works.

**If blocked:**
- `health` shows an integration in error → confirm env var values match Railway
  exactly first; if Halo/Ninja reject the VPS IP, raise ticket template 3.
- SSE stalls/buffers → confirm the request hits Traefik not some other proxy; the
  backend already sets `X-Accel-Buffering: no` and `Cache-Control: no-cache`. Long
  agent runs may need Traefik's `respondingTimeouts` raised — set
  `--entrypoints.websecure.transport.respondingTimeouts.readTimeout=0` style
  overrides in Coolify's proxy settings rather than hand-editing on the host.
