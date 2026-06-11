# Service Desk Ticket Templates

Raise by emailing `support@t3c-group.com` (logs into Halo) — same route as ticket
[ID:0040500] from attempt #1. One ticket per discrete request; reference this project
("Coolify self-hosted migration") so they thread together.

---

## Template 1 — DNS records (Stage 1, raise early)

**Subject:** DNS records for Coolify self-hosted platform

> Please create the following A records in the `<zone>` DNS zone:
>
> | Host | Type | Value | TTL |
> |---|---|---|---|
> | `coolify.<zone>` | A | `<VPS_IP>` | 300 |
> | `aida.<zone>` | A | `<VPS_IP>` | 300 |
> | `whoami.<zone>` (temporary, for network validation — can be removed after) | A | `<VPS_IP>` | 300 |
>
> These point at a VPS we manage directly (provider: `<provider>`); no firewall
> changes on T3C infrastructure are required. Needed before we can issue TLS
> certificates, so this blocks the next stage — grateful for a quick turnaround.

---

## Template 2 — VPS procurement approval (Stage 0, if billing sign-off needed)

**Subject:** Approval: VPS for self-hosted deployment platform (replaces Railway)

> Requesting approval for one VPS to host Coolify, replacing our Railway usage so
> products/agents are held on infrastructure we control.
>
> - Provider/plan: `<e.g. Hetzner CX32 — 4 vCPU / 8 GB / 80 GB>`
> - Cost: `<e.g. ~€7/month>`, replacing Railway spend of `<current>`
> - Region: `<EU region>`
> - Managed by: Craig Wardman / Automation
>
> This is independent of T3C internal infrastructure — unlike the May attempt, it
> needs no corporate firewall changes.

---

## Template 3 — Integration IP allow-listing (Stage 3/4, only if egress to Halo/Ninja is rejected)

**Subject:** Allow-list new server IP for Halo PSA / NinjaRMM API access

> Our AIDA service-desk agent has moved from Railway to a self-hosted server.
> API calls to `<Halo instance URL / NinjaRMM>` from the new IP are being rejected
> (`<error/status observed>`).
>
> Please allow-list IP `<VPS_IP>` for API client `<HALO_CLIENT_ID name / Ninja app
> name>`, or confirm whether an IP restriction is configured on those API
> applications.

---

## Template 4 — Decommission old Coolify VMs (Stage 5)

**Subject:** Re: Docker VMs — old Coolify instances can be removed

> Following up on Asif's email of 9 June: the new self-hosted Coolify platform is
> live on our own VPS, so the previous Coolify VMs (`coolify.t3cgroup.co.uk`
> controller, `coolify-server`, and the `asif.t3cgroup.co.uk` test instance) are no
> longer needed and can be powered down and deleted.
>
> We have confirmed nothing on them needs salvaging. Ticket [ID:0040500] (Firewall |
> Coolify Docs) can also be closed — the firewall issue is moot on the new
> architecture.

---

## Template 5 — Generic "blocked, need human assistance" (any stage)

**Subject:** Coolify migration blocked at Stage `<N>` — `<one-line summary>`

> While executing Stage `<N>` of the Coolify migration we hit a blocker we cannot
> resolve ourselves:
>
> - **What we were doing:** `<step from runbook>`
> - **What happened:** `<exact error / preflight output — paste it>`
> - **What we've already tried:** `<attempts>`
> - **What we need from you:** `<specific action>`
> - **Impact:** migration paused at Stage `<N>` until resolved.
