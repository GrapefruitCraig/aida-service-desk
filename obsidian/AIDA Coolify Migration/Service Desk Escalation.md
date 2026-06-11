---
title: Service Desk Escalation
project: AIDA Coolify Migration
type: process
tags: [coolify, service-desk, escalation]
---

# Service Desk Escalation

Raise a ticket whenever a step needs action by someone **outside this project**.
Route: email `support@t3c-group.com` (logs into Halo) — same route as ticket
[ID:0040500]. Full pre-drafted text in `docs/coolify/ticket-templates.md`.

## When to raise
- DNS records on the chosen zone — needs DNS admin.
- VPS procurement / billing approval.
- Anything touching the T3C corporate firewall (this plan avoids it).
- Decommissioning the old Coolify VMs and the Railway project.

**Rule of thumb:** if a stage is blocked >1 working day on something we can't do
ourselves, raise the ticket rather than improvising — the workaround culture is what
killed attempt #1 (see [[Why The May Attempt Failed]]).

## Templates available
1. DNS records (Stage 1, raise early)
2. VPS procurement approval (Stage 0)
3. Halo/Ninja IP allow-listing (Stage 3/4, if egress rejected)
4. Decommission old Coolify VMs (Stage 5) — also answers Asif's 9 Jun email
5. Generic "blocked at Stage N" — paste preflight output

Back to [[Changelog Synopsis]].
