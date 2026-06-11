#!/usr/bin/env bash
# coolify-preflight.sh — network & host diagnostics for the Coolify VPS.
#
# Usage (on the VPS, as root):
#   bash coolify-preflight.sh --stage provision                          # Stage 1: before installing Coolify
#   bash coolify-preflight.sh --stage coolify  --domain coolify.example  # Stage 2: after install + domain
#   bash coolify-preflight.sh --stage full     --domain coolify.example  # Stage 3: everything
#
# Exits 0 only if every check PASSes. Designed to give pasteable evidence for
# service desk tickets instead of "it doesn't work".

set -u

STAGE="provision"
DOMAIN=""
while [ $# -gt 0 ]; do
  case "$1" in
    --stage)  STAGE="$2"; shift 2 ;;
    --domain) DOMAIN="$2"; shift 2 ;;
    *) echo "Unknown arg: $1"; exit 2 ;;
  esac
done

PASS=0; FAIL=0; WARN=0
ok()   { printf 'PASS  %s\n' "$1"; PASS=$((PASS+1)); }
bad()  { printf 'FAIL  %s\n' "$1"; FAIL=$((FAIL+1)); }
warn() { printf 'WARN  %s\n' "$1"; WARN=$((WARN+1)); }
hdr()  { printf '\n── %s ──────────────────────────────\n' "$1"; }

# ── Host basics ─────────────────────────────────────────────────────────────
hdr "Host"
. /etc/os-release 2>/dev/null
case "${ID:-}-${VERSION_ID:-}" in
  ubuntu-24.*|ubuntu-22.*|debian-12*) ok "OS: $PRETTY_NAME" ;;
  *) warn "OS: ${PRETTY_NAME:-unknown} (Coolify supports Ubuntu/Debian best)" ;;
esac

CPUS=$(nproc)
[ "$CPUS" -ge 2 ] && ok "CPU: ${CPUS} cores" || bad "CPU: ${CPUS} core(s) — minimum 2"

MEM_MB=$(awk '/MemTotal/ {print int($2/1024)}' /proc/meminfo)
[ "$MEM_MB" -ge 1900 ] && ok "RAM: ${MEM_MB} MB" || bad "RAM: ${MEM_MB} MB — minimum 2048"

DISK_GB=$(df -BG --output=avail / | tail -1 | tr -dc '0-9')
[ "$DISK_GB" -ge 25 ] && ok "Disk free on /: ${DISK_GB} GB" || bad "Disk free: ${DISK_GB} GB — want 30+"

# ── Public IP / NAT detection ───────────────────────────────────────────────
hdr "Public IP / NAT"
PUB_IP=$(curl -4 -fsS --max-time 10 https://ifconfig.me 2>/dev/null || true)
if [ -n "$PUB_IP" ]; then
  ok "Public IPv4 (as seen from internet): $PUB_IP"
  if ip -4 addr show | grep -q "inet ${PUB_IP}/"; then
    ok "Public IP is bound directly to an interface (no NAT)"
  else
    warn "Public IP not on any local interface — server is behind NAT. Inbound 80/443 must be forwarded; this broke attempt #1-style setups."
  fi
else
  bad "Could not determine public IP (no IPv4 egress?)"
fi

# ── Egress connectivity ─────────────────────────────────────────────────────
hdr "Egress (TLS reachability)"
# Reachability test: any HTTP status counts as reachable (registries answer 401
# by design); only DNS/connect/TLS/timeout failures (code 000) are a FAIL.
check_egress() {
  local code
  code=$(curl -sS -o /dev/null -w '%{http_code}' --max-time 12 "$1" 2>/dev/null || true)
  if [ -n "$code" ] && [ "$code" != "000" ]; then
    ok "egress: $1 (HTTP $code)"
  else
    bad "egress: $1 — $(curl -sS -o /dev/null --max-time 12 "$1" 2>&1 | tail -c 120)"
  fi
}
# Coolify platform needs
check_egress https://github.com
check_egress https://api.github.com
check_egress https://cdn.coollabs.io
check_egress https://registry-1.docker.io/v2/
check_egress https://ghcr.io/v2/
check_egress https://acme-v02.api.letsencrypt.org/directory
# AIDA application needs
check_egress https://openrouter.ai
check_egress https://eu-api.ninjarmm.com
if [ -n "${HALO_BASE_URL:-}" ]; then
  check_egress "$HALO_BASE_URL"
else
  warn "HALO_BASE_URL not set in env — skipped Halo egress check (export it to test)"
fi

# ── DNS ─────────────────────────────────────────────────────────────────────
hdr "DNS"
if [ -n "$DOMAIN" ]; then
  RESOLVED=$(getent ahostsv4 "$DOMAIN" 2>/dev/null | awk '{print $1; exit}')
  if [ -z "$RESOLVED" ]; then
    bad "DNS: $DOMAIN does not resolve"
  elif [ "$RESOLVED" = "$PUB_IP" ]; then
    ok "DNS: $DOMAIN → $RESOLVED (matches public IP)"
  else
    bad "DNS: $DOMAIN → $RESOLVED but public IP is $PUB_IP — fix the A record before TLS will issue"
  fi
else
  warn "No --domain given — DNS checks skipped"
fi

# ── Firewall sanity ─────────────────────────────────────────────────────────
hdr "Firewall"
if command -v ufw >/dev/null && ufw status 2>/dev/null | grep -q "Status: active"; then
  warn "UFW is ACTIVE. Docker bypasses UFW via iptables NAT — rules here are misleading. Use the cloud provider's panel firewall instead (see docs/coolify/01-requirements.md)."
else
  ok "UFW inactive/absent (provider-panel firewall is the intended control)"
fi

# ── Stage: provision — ports must be FREE ───────────────────────────────────
if [ "$STAGE" = "provision" ]; then
  hdr "Ports (must be free before install)"
  if command -v ss >/dev/null; then
    for p in 80 443 8000 6001 6002; do
      if ss -ltn "sport = :$p" | grep -q LISTEN; then
        bad "port $p already has a listener: $(ss -ltnp "sport = :$p" | tail -1)"
      else
        ok "port $p free"
      fi
    done
  else
    bad "'ss' not found — install iproute2 (apt install -y iproute2) and re-run"
  fi
fi

# ── Stage: coolify / full — Coolify must be healthy ─────────────────────────
if [ "$STAGE" = "coolify" ] || [ "$STAGE" = "full" ]; then
  hdr "Coolify health"
  if command -v docker >/dev/null && docker info >/dev/null 2>&1; then
    ok "Docker daemon running ($(docker --version))"
  else
    bad "Docker not running"
  fi
  for c in coolify coolify-proxy; do
    STATE=$(docker inspect -f '{{.State.Status}}' "$c" 2>/dev/null || echo missing)
    [ "$STATE" = "running" ] && ok "container $c: running" || bad "container $c: $STATE"
  done
  for p in 80 443; do
    ss -ltn "sport = :$p" | grep -q LISTEN && ok "port $p listening (Traefik)" || bad "port $p has no listener"
  done
  if [ -n "$DOMAIN" ]; then
    CODE=$(curl -s -o /dev/null -w '%{http_code}' --max-time 15 "https://$DOMAIN" || echo 000)
    case "$CODE" in
      200|302) ok "https://$DOMAIN responds ($CODE) with valid TLS" ;;
      000)     bad "https://$DOMAIN unreachable or TLS invalid: $(curl -s -o /dev/null -w '%{errormsg}' --max-time 15 "https://$DOMAIN" 2>&1 | tail -c 120)" ;;
      *)       warn "https://$DOMAIN returned HTTP $CODE" ;;
    esac
  fi
fi

# ── Stage: full — bootstrap ports closed externally, webhook path ───────────
if [ "$STAGE" = "full" ]; then
  hdr "Lockdown"
  # From the host these may listen on docker bridges; the *external* test in the
  # runbook (nc from a laptop) is authoritative. Here we check the docker port maps.
  for p in 8000 6001 6002; do
    if docker ps --format '{{.Ports}}' 2>/dev/null | grep -q "0.0.0.0:$p->"; then
      warn "port $p still published by a container — confirm provider firewall blocks it externally (run: nc -zv <VPS_IP> $p from your laptop)"
    else
      ok "port $p not published"
    fi
  done
fi

# ── Summary ─────────────────────────────────────────────────────────────────
hdr "Summary"
echo "PASS=$PASS  WARN=$WARN  FAIL=$FAIL  (stage: $STAGE)"
if [ "$FAIL" -gt 0 ]; then
  echo "Result: FAILED — paste this full output into a service desk ticket if the fix needs external help (docs/coolify/ticket-templates.md, template 5)."
  exit 1
fi
echo "Result: OK to proceed to the next stage gate."
exit 0
