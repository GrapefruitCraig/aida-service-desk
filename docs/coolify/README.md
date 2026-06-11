# Coolify Self-Hosted Migration — Plan & Runbooks

Goal: replace Railway with a self-hosted Coolify instance on a VPS **we control**, so
AIDA and future products/agents are hosted internally.

## Why the previous attempt failed (May 2026)

The first attempt ran on T3C internal infrastructure (`coolify.t3cgroup.co.uk`) as a
**two-server setup**: a "controller" VM (Coolify dashboard) pushing deployments over SSH
to a second "coolify-server" VM. It failed for networking reasons that were never
root-caused:

1. **Corporate firewall blocked Coolify's required ports** (8000 dashboard, 6001
   realtime, 6002 terminal, 80/443, 22). Ticket **[ID:0040500] "Firewall | Coolify
   Docs"** was raised on 21 May 2026 but the original instance was never fixed — a
   second instance (`asif.t3cgroup.co.uk`) was exposed "directly to the internet" as a
   workaround and the effort stalled.
2. **Firewall changes required another team** (infrastructure/CTO), turning every
   networking fix into a multi-day ticket round-trip.
3. **Docker bypasses UFW** — NAT iptables rules punch through host firewalls, so
   local firewall state was misleading during diagnosis.
4. The controller→server SSH hop added a second networking failure surface
   (key exchange, reachability between VMs) before anything was even deployed.

> ⚠️ **Time-sensitive:** Asif's email of 9 June 2026 ("Docker VMs") asks to power
> down/delete the unused Coolify VMs. If anything on those VMs is worth keeping
> (SSH keys, env vars, the working `asif.t3cgroup.co.uk` config), reply before they
> are deleted. Otherwise confirm deletion — this build does not depend on them.

## How this plan avoids those failures

- **Single-server Coolify**: dashboard and deploy target on the same VPS via
  `localhost` — no SSH hop between VMs.
- **VPS rented directly from a cloud provider** (Hetzner/DigitalOcean/Vultr/etc.) with
  a **provider-panel firewall we control** — no corporate firewall in the path, no
  cross-team ticket needed to open a port.
- **Domain + Traefik/Let's Encrypt from day one**, so ports 8000/6001/6002 are closed
  after initial setup and only 22/80/443 stay open.
- **Scripted verification at every stage** (`scripts/coolify-preflight.sh`,
  `scripts/coolify-smoke-test.sh`) so networking problems are caught with evidence,
  not symptoms.

## Stages — complete each gate before starting the next

| Stage | Runbook | Gate (must pass before next stage) | Status |
|---|---|---|---|
| 0 | [01-requirements.md](01-requirements.md) | Provider, VPS spec, domain, and budget signed off | ☐ |
| 1 | [02-stage-1-vps-provisioning.md](02-stage-1-vps-provisioning.md) | SSH key login works, root password login disabled, preflight script passes provisioning checks | ☐ |
| 2 | [03-stage-2-coolify-install.md](03-stage-2-coolify-install.md) | Coolify dashboard reachable via HTTPS on our domain; ports 8000/6001/6002 closed externally | ☐ |
| 3 | [04-stage-3-network-validation.md](04-stage-3-network-validation.md) | Test app deploys with auto-TLS; GitHub webhook delivers; full preflight passes | ☐ |
| 4 | [05-stage-4-deploy-aida.md](05-stage-4-deploy-aida.md) | AIDA live on Coolify; `/api/ping` and `/api/agent/health` green | ☐ |
| 5 | [06-stage-5-testing-cutover.md](06-stage-5-testing-cutover.md) | Smoke test passes incl. SSE streaming; DNS cut over; Railway decommissioned | ☐ |

Tick the box and commit when a gate passes — this table is the live record of progress.

## Escalation policy — when to raise a service desk ticket

Raise a ticket (email `support@t3c-group.com`, which logs into Halo) **whenever a step
needs action by someone outside this project**, using the pre-drafted text in
[ticket-templates.md](ticket-templates.md). Known human-assistance points:

- DNS records on `t3cgroup.co.uk` (or whichever zone is chosen) — needs DNS admin.
- Procurement/billing approval for the VPS.
- Anything touching the T3C corporate firewall (only if the VPS is forced onto the
  internal network — this plan avoids that).
- Decommissioning the old Coolify VMs and the Railway project.

Rule of thumb: if a stage is blocked for more than one working day on something we
cannot do ourselves, raise the ticket rather than improvising a workaround — the
workaround culture is what killed attempt #1.
