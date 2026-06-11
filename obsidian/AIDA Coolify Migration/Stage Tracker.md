---
title: Stage Tracker
project: AIDA Coolify Migration
type: tracker
tags: [coolify, tracker]
---

# Stage Tracker

Tick the gate when each stage's acceptance criteria pass. Mirror of the table in
`docs/coolify/README.md`.

- [ ] **Stage 0 — Requirements & sign-off** → [[Requirements & Decisions]]
      _Gate: provider, VPS spec, domain, budget signed off._
- [ ] **Stage 1 — VPS provisioning & hardening**
      _Gate: key-only SSH works, password login disabled, preflight `--stage provision` passes._
- [ ] **Stage 2 — Coolify install + lockdown**
      _Gate: dashboard on HTTPS domain; 8000/6001/6002 closed externally._
- [ ] **Stage 3 — Network validation**
      _Gate: test app deploys with auto-TLS; GitHub webhook delivers; preflight `--stage full` passes._
- [ ] **Stage 4 — Deploy AIDA**
      _Gate: `/api/ping` + `/api/agent/health` green on the production domain._
- [ ] **Stage 5 — Testing & cutover**
      _Gate: smoke test passes incl. SSE; DNS cut over; Railway decommissioned._

## Current state
**Stage 0 — awaiting decision sign-off.** Nothing provisioned yet.
