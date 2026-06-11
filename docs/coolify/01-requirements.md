# Stage 0 — Requirements & Decisions

Sign these off before provisioning anything. Record decisions in the table at the
bottom and commit.

## 1. VPS requirements

Coolify (server + dashboard + Traefik) plus AIDA comfortably fits on one box.
Sized with headroom for the "future products and agents" this platform is meant to host:

| Item | Minimum | Recommended |
|---|---|---|
| CPU | 2 vCPU | 4 vCPU |
| RAM | 2 GB | 8 GB (Coolify itself wants 2 GB; each Node app ~150–300 MB; builds are the spike) |
| Disk | 30 GB SSD | 80–100 GB SSD (Docker images/build cache grow fast) |
| OS | Ubuntu 24.04 LTS (x86_64 or arm64) | same |
| Network | 1 public IPv4 | same, + IPv6 |

Provider candidates (all give a panel firewall + full root):

- **Hetzner Cloud** — best price/perf (CX32: 4 vCPU/8 GB ≈ €7/mo), EU data centres.
- **DigitalOcean** — simpler UX, more expensive for same spec.
- **Vultr / OVH** — fine alternatives.

**Hard requirement:** the provider firewall must be controllable by *this team*.
Do not place the VPS behind the T3C corporate firewall — that dependency is what
blocked attempt #1.

## 2. Network requirements

### Inbound (provider panel firewall)

| Port | Purpose | Exposure |
|---|---|---|
| 22 | SSH | Restrict to office/VPN IPs if static, else open with key-only auth |
| 80 | HTTP (Let's Encrypt challenges, redirect to 443) | Open to all |
| 443 | HTTPS (all apps + Coolify dashboard via Traefik) | Open to all |
| 8000, 6001, 6002 | Coolify dashboard/realtime/terminal | **Open only during Stage 2 install, closed at end of Stage 2** once the dashboard is on a domain |

GitHub webhooks need 443 reachable from GitHub's IPs (`https://api.github.com/meta`,
`hooks` section) — open-to-all on 443 covers this.

### Outbound (egress) — must all be reachable from the VPS

| Destination | Used by |
|---|---|
| `github.com`, `api.github.com`, `codeload.github.com` | Coolify git clone + webhooks |
| `ghcr.io`, `registry-1.docker.io`, `auth.docker.io`, `production.cloudflare.docker.com` | Docker image pulls |
| `cdn.coollabs.io`, `get.coollabs.io` | Coolify install/updates |
| `openrouter.ai` (443) | AIDA LLM calls |
| `<instance>.halopsa.com` (443) | AIDA Halo PSA integration |
| `eu-api.ninjarmm.com` (443) — or regional equivalent | AIDA NinjaRMM integration |
| Let's Encrypt (`acme-v02.api.letsencrypt.org`) | TLS certificates |

A default cloud VPS has unrestricted egress, so this is a verification list, not a
configuration task. `scripts/coolify-preflight.sh` tests every one of these.

## 3. DNS requirements

Choose the zone (e.g. `t3cgroup.co.uk` or a product domain). Records needed:

| Record | Type | Value | When |
|---|---|---|---|
| `coolify.<zone>` | A | VPS public IP | Stage 2 |
| `aida.<zone>` | A | VPS public IP | Stage 4 |
| `*.<zone>` or per-app A records | A | VPS public IP | as products are added |

If the DNS zone is managed by someone else → **raise the DNS ticket**
([ticket-templates.md](ticket-templates.md), template 1) at the start of Stage 1 so
records exist before Stage 2.

## 4. Secrets inventory

To be entered into Coolify's per-app environment variables (never committed):

`OPENROUTER_API_KEY`, `OPENROUTER_MODEL`, `HALO_BASE_URL`, `HALO_CLIENT_ID`,
`HALO_CLIENT_SECRET`, `HALO_TENANT`, `NINJA_CLIENT_ID`, `NINJA_CLIENT_SECRET`,
`NINJA_REGION`, `NODE_ENV=production`, `FRONTEND_URL=https://aida.<zone>`.

Current values live in the Railway dashboard (Variables tab) — copy them out
**before** decommissioning Railway in Stage 5.

## 5. Access & security baseline

- SSH: key-based auth only; password and root-password login disabled (Stage 1).
- Coolify dashboard: strong admin password + 2FA; **registration disabled** after
  first user (the previous instance circulated open invitation links).
- Backups: enable Coolify's built-in instance backup; provider VPS snapshots weekly.
- The AIDA container already runs as non-root with a healthcheck (`Dockerfile`).

## 6. Decision record

| Decision | Choice | Date | By |
|---|---|---|---|
| VPS provider + plan | _e.g. Hetzner CX32_ | | |
| Region | _e.g. Falkenstein (EU)_ | | |
| DNS zone | | | |
| Coolify dashboard domain | `coolify.________` | | |
| AIDA domain | `aida.________` | | |
| Who holds root SSH key | | | |
| Old Coolify VMs: salvage or confirm deletion (Asif's 9 Jun email) | | | |

**Gate to Stage 1:** every row above filled in and budget approved.
