---
title: Changelog Synopsis
project: AIDA Coolify Migration
type: changelog
status: planning
created: 2026-06-11
tags: [coolify, aida, migration, changelog, moc]
---

# Changelog Synopsis

> Primary note for the **[[Project Overview]]**. One-line synopsis per change.
> Newest at top. Each entry links to a companion note where one exists.

## 2026-06-11 — Branch `claude/coolify-self-hosted-plan-l86wwr`

Staged plan, runbooks, and test tooling for migrating AIDA off Railway onto a
self-hosted Coolify VPS we control. Commit `07027fe`, 10 files, +845 lines.

| Change | Synopsis |
|---|---|
| `docs/coolify/README.md` | Root plan: root-causes the failed May attempt (firewall ticket 0040500, controller↔server SSH split, UFW/Docker bypass) and lays out the staged approach + escalation policy. See [[Why The May Attempt Failed]]. |
| `docs/coolify/01-requirements.md` | Stage 0 — VPS spec, inbound/egress/DNS requirements, secrets inventory, and a decision record to sign off before provisioning. See [[Requirements & Decisions]]. |
| `docs/coolify/02-stage-1-vps-provisioning.md` | Stage 1 — provision + harden the VPS (key-only SSH, provider-panel firewall), gated by the preflight script. See [[Stage Tracker]]. |
| `docs/coolify/03-stage-2-coolify-install.md` | Stage 2 — install Coolify single-server, put the dashboard on HTTPS, then close bootstrap ports 8000/6001/6002. |
| `docs/coolify/04-stage-3-network-validation.md` | Stage 3 — prove TLS, routing, and GitHub webhooks with a throwaway app *before* touching AIDA. |
| `docs/coolify/05-stage-4-deploy-aida.md` | Stage 4 — deploy AIDA via GitHub App, port 3001, env vars copied from Railway, health-gated rollout. |
| `docs/coolify/06-stage-5-testing-cutover.md` | Stage 5 — smoke test + functional pass, DNS cutover, decommission Railway and the old Coolify VMs. |
| `docs/coolify/ticket-templates.md` | Five pre-drafted service desk tickets (DNS, procurement, IP allow-listing, VM decommission, generic blocker). See [[Service Desk Escalation]]. |
| `scripts/coolify-preflight.sh` | Per-stage host/egress/DNS/firewall/port diagnostics; produces pasteable evidence for tickets. Dry-run validated, 2 bugs fixed. |
| `scripts/coolify-smoke-test.sh` | Post-deploy checks: ping, integration health, TLS expiry, HTTP→HTTPS redirect, SSE streaming, latency. |

---

## How to maintain this note

Add a new dated section at the top each time work lands. Keep each entry to a
single synopsis line; push detail into a companion note and `[[link]]` it.

## Companion notes
- [[Project Overview]]
- [[Why The May Attempt Failed]]
- [[Requirements & Decisions]]
- [[Stage Tracker]]
- [[Service Desk Escalation]]
