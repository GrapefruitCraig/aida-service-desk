# AIDA — IT Service Desk Agent

AI-powered 1st line service desk agent backed by **Claude Sonnet 4**, **Halo PSA**, and **NinjaRMM**.

## Features

- **Conversational AI agent** — troubleshoots issues, raises tickets, checks devices, escalates intelligently
- **Halo PSA integration** — create, search, update, and escalate tickets via OAuth2
- **NinjaRMM integration** — device health, alerts, offline devices, remote reboot, PowerShell scripts
- **Real-time streaming** — tool calls and responses stream live via SSE
- **Agentic loop** — Claude autonomously chains tool calls (e.g. finds device → checks health → raises ticket)
- **Docker + Railway ready** — single Dockerfile serves both frontend and backend

---

## Quick start (local)

### 1. Clone and install

```bash
git clone <your-repo>
cd it-service-desk
cp backend/.env.example backend/.env
```

### 2. Configure environment

Edit `backend/.env`:

```env
ANTHROPIC_API_KEY=sk-ant-...

# Halo PSA
HALO_BASE_URL=https://your-instance.halopsa.com
HALO_CLIENT_ID=your_client_id
HALO_CLIENT_SECRET=your_client_secret
HALO_TENANT=your_tenant          # optional, some instances need this

# NinjaRMM
NINJA_CLIENT_ID=your_client_id
NINJA_CLIENT_SECRET=your_client_secret
NINJA_REGION=eu                  # eu | us | oc | ca
```

### 3. Run in development

```bash
npm install                  # root devDependencies (concurrently)
cd backend && npm install
cd ../frontend && npm install
cd ..
npm run dev                  # starts both backend :3001 and frontend :5173
```

Open http://localhost:5173

---

## Getting API credentials

### Halo PSA

1. Log into Halo PSA as an admin
2. Go to **Configuration → Integrations → HaloPSA API**
3. Create a new application with grant type **Client Credentials**
4. Set scope to `all` (or minimum: `read:tickets write:tickets read:users`)
5. Copy the **Client ID** and **Client Secret**
6. Your base URL is your Halo instance URL e.g. `https://acme.halopsa.com`

### NinjaRMM

1. Log into NinjaRMM as an admin
2. Go to **Administration → Apps → API**
3. Click **Add** → select **API Services (machine-to-machine)**
4. Set scopes: `monitoring`, `management`, `control`
5. Copy the **Client ID** and **Client Secret**
6. Set `NINJA_REGION` to match your instance:
   - `eu` — eu.ninjarmm.com
   - `us` — app.ninjarmm.com
   - `oc` — oc.ninjarmm.com
   - `ca` — ca.ninjarmm.com

### Anthropic

Get your key at https://console.anthropic.com

---

## Deploy to Docker

### Build and run

```bash
# Build the image (bundles frontend + backend)
docker build -t aida-service-desk .

# Run with env vars
docker run -p 3001:3001 \
  -e ANTHROPIC_API_KEY=sk-ant-... \
  -e HALO_BASE_URL=https://your.halopsa.com \
  -e HALO_CLIENT_ID=... \
  -e HALO_CLIENT_SECRET=... \
  -e NINJA_CLIENT_ID=... \
  -e NINJA_CLIENT_SECRET=... \
  -e NINJA_REGION=eu \
  aida-service-desk
```

Open http://localhost:3001

### Docker Compose

```bash
# Copy and fill in your .env at project root
cp backend/.env.example .env

docker compose up --build
```

---

## Deploy to Railway

### Option A: GitHub (recommended)

1. Push this repo to GitHub
2. Go to https://railway.app → New Project → Deploy from GitHub
3. Select your repo — Railway auto-detects the `Dockerfile`
4. Add environment variables in the Railway dashboard (Variables tab)
5. Railway assigns a public URL automatically

### Option B: Railway CLI

```bash
npm install -g @railway/cli
railway login
railway init
railway up
railway variables set ANTHROPIC_API_KEY=sk-ant-...
railway variables set HALO_BASE_URL=https://your.halopsa.com
# ... set all other variables
```

### Environment variables to set in Railway

| Variable | Value |
|---|---|
| `ANTHROPIC_API_KEY` | Your Anthropic API key |
| `HALO_BASE_URL` | `https://your-instance.halopsa.com` |
| `HALO_CLIENT_ID` | Halo API client ID |
| `HALO_CLIENT_SECRET` | Halo API client secret |
| `HALO_TENANT` | Halo tenant (if required) |
| `NINJA_CLIENT_ID` | NinjaRMM client ID |
| `NINJA_CLIENT_SECRET` | NinjaRMM client secret |
| `NINJA_REGION` | `eu` / `us` / `oc` / `ca` |
| `NODE_ENV` | `production` |

---

## Architecture

```
Browser
  │
  ├── GET /           → React frontend (served by Express in prod)
  │
  └── POST /api/agent/chat  ← SSE stream
        │
        └── Express backend
              │
              ├── Claude Sonnet 4 (tool use / agentic loop)
              │     ├── halo_create_ticket
              │     ├── halo_search_tickets
              │     ├── halo_update_ticket
              │     ├── halo_escalate_ticket
              │     ├── ninja_get_device_health
              │     ├── ninja_get_active_alerts
              │     ├── ninja_reboot_device
              │     └── ninja_run_script
              │
              ├── Halo PSA API (OAuth2 client_credentials)
              └── NinjaRMM API (OAuth2 client_credentials)
```

## API endpoints

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/agent/chat` | SSE stream — runs agentic loop |
| `GET` | `/api/agent/health` | Integration health check |
| `GET` | `/api/ping` | Server alive check |

---

## Customisation

**Add more Halo ticket types** — edit `backend/src/tools/halo.js`, change `tickettype_id` (1=Incident, 2=Service Request, etc.)

**Add NinjaRMM saved scripts** — use `ninja_run_script` with a `scriptId` instead of `scriptBody`

**Change the agent persona / behaviour** — edit `SYSTEM_PROMPT` in `backend/src/routes/agent.js`

**Add more tools** — define in `backend/src/tools/definitions.js`, implement in executor, add the API call to halo.js or ninja.js

**Rate limiting** — adjust `max` in `backend/src/index.js` for your usage

---

## Tech stack

- **Frontend**: React 18, Vite, react-markdown
- **Backend**: Node.js, Express, @anthropic-ai/sdk
- **AI**: Claude Sonnet 4 with tool use (agentic loop)
- **PSA**: Halo PSA REST API v3
- **RMM**: NinjaRMM REST API v2
- **Deploy**: Docker, Railway
