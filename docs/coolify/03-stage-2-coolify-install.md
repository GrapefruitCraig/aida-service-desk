# Stage 2 — Coolify Install & Dashboard Lockdown

**Prerequisite:** Stage 1 gate passed; `coolify.<zone>` DNS record resolves to `<VPS_IP>`
(check with `dig +short coolify.<zone>` — must print the VPS IP before you start).

## 1. Install Coolify (single-server mode)

```bash
ssh root@<VPS_IP>
curl -fsSL https://cdn.coollabs.io/coolify/install.sh | bash
```

The installer sets up Docker, Coolify, and its Traefik proxy. When it finishes it
prints the dashboard URL: `http://<VPS_IP>:8000`.

## 2. First-run setup (do immediately — the instance is briefly open)

1. Browse to `http://<VPS_IP>:8000`, create the **admin** account with a strong
   password. Enable 2FA straight away (profile → Two-factor Authentication).
2. **Settings → disable new user registration.** (Attempt #1 left open invitation
   links floating around email threads.)
3. When asked which server to deploy to, choose **localhost** — this is the
   single-server mode that removes the controller→server SSH hop that failed before.

## 3. Put the dashboard behind the domain + TLS

1. Settings → Instance Domain: `https://coolify.<zone>`.
2. Save and wait for Traefik to obtain the Let's Encrypt certificate (needs 80/443
   open and DNS already pointing here — both guaranteed by the Stage 1/2 gates).
3. Confirm `https://coolify.<zone>` loads with a valid certificate and log in there.

## 4. Close the temporary ports

In the **provider panel firewall**, remove inbound rules for **8000, 6001, 6002**.
Final inbound ruleset: 22, 80, 443 only.

> The dashboard, websockets, and terminal all run through Traefik on 443 once the
> instance domain is set — those three ports were only needed for bootstrap.

## 5. Verify

```bash
ssh root@<VPS_IP> 'bash /root/coolify-preflight.sh --stage coolify --domain coolify.<zone>'
```

And from **outside** (laptop, not the VPS):

```bash
curl -sI https://coolify.<zone> | head -1        # expect HTTP/2 200 or 302
nc -zv -w3 <VPS_IP> 8000 || echo "8000 closed ✓" # expect closed
nc -zv -w3 <VPS_IP> 6001 || echo "6001 closed ✓"
nc -zv -w3 <VPS_IP> 6002 || echo "6002 closed ✓"
```

## Gate to Stage 3 — all must be true

- [ ] Dashboard on `https://coolify.<zone>` with valid Let's Encrypt cert, 2FA on,
      registration disabled.
- [ ] localhost server shows **reachable & usable** in Coolify (Servers page).
- [ ] 8000/6001/6002 confirmed closed from the internet; only 22/80/443 open.
- [ ] Preflight `--stage coolify` exits 0.

**If blocked:**
- Cert fails to issue → almost always DNS not propagated or port 80 filtered; re-run
  preflight, check `dig`, check provider firewall. Do **not** work around by using
  `:8000` long-term — that recreates attempt #1's exposure.
- localhost server "not reachable" in Coolify → `docker ps` on the VPS, check
  `coolify` containers are running; reboot once; if persistent, capture
  `docker logs coolify` output before asking for help.
