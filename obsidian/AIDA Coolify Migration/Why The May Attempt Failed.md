---
title: Why The May Attempt Failed
project: AIDA Coolify Migration
type: postmortem
tags: [coolify, networking, postmortem]
---

# Why The May Attempt Failed

Reconstructed from ticket **[ID:0040500] "Firewall | Coolify Docs"** (21 May 2026)
and the Teams thread with Asif Malik (20 May 2026).

## What was built
A **two-server** setup on T3C internal infrastructure (`coolify.t3cgroup.co.uk`):
a "controller" VM running the Coolify dashboard, pushing deployments over **SSH** to
a second `coolify-server` VM.

## What broke
1. **Corporate firewall blocked Coolify's required ports** — 8000 (dashboard),
   6001 (realtime), 6002 (terminal), plus 80/443/22. Ticket 0040500 asked for them
   to be opened; the original instance was never fixed.
2. **Workaround instead of fix** — a second instance (`asif.t3cgroup.co.uk`) was
   exposed directly to the internet to sidestep the firewall, and the effort stalled.
3. **Firewall changes needed another team**, turning each fix into a multi-day ticket.
4. **Docker bypasses UFW** — NAT iptables rules punch through host firewalls, so
   local firewall state was misleading during diagnosis.
5. The **controller→server SSH hop** added a second networking failure surface before
   anything was even deployed.

## How the new plan avoids each
- Single-server Coolify (no SSH hop).
- VPS with a **provider-panel firewall we control** — no corporate firewall in path.
- Domain + Traefik/Let's Encrypt from day one; bootstrap ports closed after install.
- Scripted verification at every stage (`coolify-preflight.sh`).

## ⚠️ Open loop
Asif's **9 June "Docker VMs"** email asks to power down/delete the unused Coolify VMs.
Salvage anything needed (SSH keys, env, the working config) **before** they're deleted,
or confirm deletion. Tracked in [[Service Desk Escalation]] (template 4).
