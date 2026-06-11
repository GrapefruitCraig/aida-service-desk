# Stage 1 — VPS Provisioning & Hardening

**Prerequisite:** Stage 0 decision record complete.
**Raise now (parallel):** DNS ticket (template 1) if the zone is managed elsewhere —
records must exist by Stage 2.

## 1. Provision

1. Create the VPS per the Stage 0 spec, Ubuntu 24.04 LTS.
2. Add your SSH **public key** at creation time (do not use provider-emailed passwords).
3. Create the provider-panel firewall and attach it to the VPS:
   - Allow inbound: 22, 80, 443, 8000, 6001, 6002 (last three are temporary).
   - Note: configure this in the **provider panel**, not UFW on the host. Docker's
     iptables NAT rules bypass UFW, which produced misleading results in attempt #1.
4. Record the public IPv4 — referred to as `<VPS_IP>` below.

## 2. First login & base hardening

```bash
ssh root@<VPS_IP>

# Updates
apt update && apt upgrade -y

# SSH hardening: keys only
sed -i 's/^#\?PasswordAuthentication.*/PasswordAuthentication no/' /etc/ssh/sshd_config
sed -i 's/^#\?PermitRootLogin.*/PermitRootLogin prohibit-password/' /etc/ssh/sshd_config
systemctl restart ssh

# Sanity basics
timedatectl set-timezone Europe/London
apt install -y curl git ca-certificates
```

> Coolify's installer expects to run as root and manages Docker itself — do not
> pre-install Docker or create a deploy user unless you know you need to.

**Verify from a second terminal before closing the first** (so you can't lock
yourself out): `ssh root@<VPS_IP>` must succeed with your key, and
`ssh -o PubkeyAuthentication=no root@<VPS_IP>` must be **refused**.

## 3. Preflight check

From the repo, copy the diagnostics script up and run the Stage-1 checks:

```bash
scp scripts/coolify-preflight.sh root@<VPS_IP>:/root/
ssh root@<VPS_IP> 'bash /root/coolify-preflight.sh --stage provision'
```

This validates: OS/arch, CPU/RAM/disk minimums, all required egress endpoints,
public-IP/NAT detection, and that no service already squats on 80/443/8000.

## Gate to Stage 2 — all must be true

- [ ] SSH key login works; password auth refused.
- [ ] `coolify-preflight.sh --stage provision` exits 0 (no FAILs).
- [ ] Provider firewall attached with the Stage-1 ruleset.
- [ ] DNS ticket raised (or records already created): `coolify.<zone>` → `<VPS_IP>`.

**If blocked:** egress failures on a fresh cloud VPS usually mean a provider-level
filter — raise with the provider's support, not the T3C service desk. DNS blocked →
chase ticket from template 1.
