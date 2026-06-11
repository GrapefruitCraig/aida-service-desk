# Stage 5 — Full Testing, Cutover & Decommission

**Prerequisite:** Stage 4 gate passed.

## 1. Automated smoke test

From any machine with `bash` + `curl`:

```bash
bash scripts/coolify-smoke-test.sh https://aida.<zone>
```

This checks: ping, integration health, TLS certificate validity/expiry, HTTP→HTTPS
redirect, SSE streaming on `/api/agent/chat`, rate-limit headers, and response time.
All checks must PASS.

## 2. Functional test pass (manual, ~30 min)

Run the real agent flows end-to-end against live integrations:

- [ ] Ask AIDA to troubleshoot a fake issue → coherent streamed answer.
- [ ] Have it **create a Halo ticket** → ticket ID returned and visible in Halo.
- [ ] Have it **search/update/escalate** that ticket → changes visible in Halo.
- [ ] Have it check a device's health via NinjaRMM → real data returned.
- [ ] Long conversation (10+ turns with tool calls) → stream never drops.
- [ ] Two browsers chatting simultaneously → no cross-talk, no stalls.
- [ ] Soak: leave it deployed 24–48 h, then re-run the smoke test — catches cert,
      memory-leak, and container-restart issues that one-shot tests miss.

Close the loop on the test ticket (delete/close it in Halo) when done.

## 3. Cutover

1. If anything points at the Railway URL (bookmarks, Teams tabs, docs, monitors),
   update to `https://aida.<zone>`. Optionally keep Railway running 1 week as
   fallback.
2. Update `README.md` deploy section to reference Coolify (follow-up commit).
3. Set up uptime monitoring on `https://aida.<zone>/api/ping` (NinjaRMM, UptimeRobot,
   or Coolify's own notifications → Teams webhook).
4. Enable Coolify instance backups + weekly provider snapshots (per Stage 0 §5).

## 4. Decommission

- [ ] Copy **all** Railway env values somewhere safe (they're the only canonical copy
      until Coolify) — then delete the Railway service/project.
- [ ] Remove `railway.toml` from the repo (follow-up commit once Railway is gone).
- [ ] Reply to Asif's "Docker VMs" email (9 Jun): confirm the old Coolify VMs can be
      deleted (or salvage first — per the Stage 0 decision record). Raise ticket
      template 4 if formal decommissioning is needed.

## Done criteria for the whole project

- [ ] AIDA serving production traffic from our Coolify VPS for ≥1 week without
      manual intervention.
- [ ] Railway deleted; old T3C Coolify VMs resolved with Asif.
- [ ] Stage table in `README.md` fully ticked; this branch merged.

## Adding future products/agents (the payoff)

Each new product is now: push repo to GitHub → Coolify "+ New" → pick repo →
set domain + env vars → deploy. The platform work in Stages 0–3 never repeats.
Watch VPS capacity (`htop`, Coolify's server metrics) and resize when sustained
RAM > 70%.
