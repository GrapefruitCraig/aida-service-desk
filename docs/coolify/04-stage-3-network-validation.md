# Stage 3 — Network Validation (prove the platform before touching AIDA)

**Prerequisite:** Stage 2 gate passed.

This stage exists because attempt #1 deployed straight into a broken network and we
ended up debugging the app, Coolify, and the firewall simultaneously. Here we prove
each network path with a trivial app first, so any Stage 4 failure can only be AIDA
itself.

## 1. Deploy a throwaway test app

In Coolify: **+ New → Public Repository → Docker Image**, image `traefik/whoami`,
domain `whoami.<zone>` (add the A record, or reuse a wildcard if one was created).

Verify from outside:

```bash
curl -s https://whoami.<zone>          # returns request/host info
curl -sI http://whoami.<zone> | head -1  # expect 301/308 redirect to https
```

This proves: Traefik routing ✓, Let's Encrypt issuance for app domains ✓, 80→443
redirect ✓, container egress→ingress path ✓.

## 2. Prove the GitHub integration (webhooks + clone)

1. In Coolify: **Sources → + Add → GitHub App**, follow the flow to install it on the
   `grapefruitcraig` account with access to `aida-service-desk`.
2. Create a test application from the repo (any branch, Dockerfile build pack) but
   **do not** give it the production domain — use `aida-test.<zone>` or no domain.
3. Trigger a manual deploy → proves clone + Docker build work on the VPS.
4. Push a trivial commit to the branch → confirm Coolify auto-deploys within ~a
   minute → proves GitHub webhooks reach the instance on 443.

## 3. Full preflight + connectivity matrix

```bash
ssh root@<VPS_IP> 'bash /root/coolify-preflight.sh --stage full --domain coolify.<zone>'
```

Must show PASS for every row, including the AIDA egress endpoints (openrouter.ai,
Halo instance, NinjaRMM region API) — Stage 4 depends on those.

## 4. Clean up

Delete the `whoami` and `aida-test` apps (keep the GitHub App source — Stage 4 uses
it).

## Gate to Stage 4 — all must be true

- [ ] Test app served on its own domain with valid TLS and HTTP→HTTPS redirect.
- [ ] Push-to-deploy worked via GitHub webhook (no manual trigger).
- [ ] Dockerfile build of this repo succeeded on the VPS.
- [ ] `coolify-preflight.sh --stage full` exits 0.

**If blocked:**
- Webhook never arrives → check GitHub App "Recent Deliveries" (Settings →
  Developer settings) for the response code; 443 unreachable from GitHub means a
  provider firewall regression.
- Build OOM/slow → resize VPS (Stage 0 recommended 8 GB for this reason).
- Egress to Halo/Ninja fails from the VPS but works elsewhere → possible IP
  allow-listing on those tenants; raise ticket template 3 (integration access)
  with the VPS IP.
