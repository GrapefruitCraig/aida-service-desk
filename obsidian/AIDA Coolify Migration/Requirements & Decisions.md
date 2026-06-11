---
title: Requirements & Decisions
project: AIDA Coolify Migration
type: requirements
tags: [coolify, requirements, decisions]
---

# Requirements & Decisions

Condensed from `docs/coolify/01-requirements.md`. Sign off before provisioning.

## VPS spec
- **Minimum:** 2 vCPU / 2 GB / 30 GB SSD. **Recommended:** 4 vCPU / 8 GB / 80 GB.
- Ubuntu 24.04 LTS. Provider with a controllable panel firewall (Hetzner / DO / Vultr).
- **Hard rule:** not behind the T3C corporate firewall — that dependency killed
  attempt #1 (see [[Why The May Attempt Failed]]).

## Ports (provider-panel firewall)
- Permanent inbound: **22, 80, 443**.
- Temporary inbound (Stage 2 only): **8000, 6001, 6002** — closed after dashboard
  is on the domain.

## Egress that must work from the VPS
GitHub, ghcr.io / Docker registries, `cdn.coollabs.io`, Let's Encrypt,
`openrouter.ai`, the Halo instance, `eu-api.ninjarmm.com`. Verified by
`coolify-preflight.sh`.

## DNS
`coolify.<zone>` and `aida.<zone>` → VPS IP. If the zone is managed by someone else,
raise the DNS ticket early — see [[Service Desk Escalation]] (template 1).

## Secrets (Coolify env vars — never commit)
`OPENROUTER_API_KEY`, `OPENROUTER_MODEL`, `HALO_BASE_URL`, `HALO_CLIENT_ID`,
`HALO_CLIENT_SECRET`, `HALO_TENANT`, `NINJA_CLIENT_ID`, `NINJA_CLIENT_SECRET`,
`NINJA_REGION`, `NODE_ENV`, `FRONTEND_URL`.
**Current values live only in the Railway dashboard — copy out before decommissioning.**

## Decision record — fill in
| Decision | Choice |
|---|---|
| VPS provider + plan | |
| Region | |
| DNS zone | |
| Coolify domain | `coolify.____` |
| AIDA domain | `aida.____` |
| Root SSH key holder | |
| Old Coolify VMs: salvage or delete | |
