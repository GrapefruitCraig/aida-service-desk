#!/usr/bin/env bash
# coolify-smoke-test.sh — post-deploy validation of AIDA on Coolify.
#
# Usage (from any machine with bash + curl):
#   bash scripts/coolify-smoke-test.sh https://aida.example.com
#
# Checks: ping, integration health, TLS cert, HTTP→HTTPS redirect, SSE streaming,
# and response time. Exits 0 only if all checks pass.

set -u

BASE="${1:-}"
if [ -z "$BASE" ]; then echo "Usage: $0 https://aida.<your-domain>"; exit 2; fi
BASE="${BASE%/}"
HOST=$(echo "$BASE" | sed -E 's#^https?://##; s#/.*##')

PASS=0; FAIL=0
ok()  { printf 'PASS  %s\n' "$1"; PASS=$((PASS+1)); }
bad() { printf 'FAIL  %s\n' "$1"; FAIL=$((FAIL+1)); }

# 1. Ping
BODY=$(curl -fsS --max-time 10 "$BASE/api/ping" 2>&1)
if echo "$BODY" | grep -q '"ok":true'; then ok "/api/ping → $BODY"; else bad "/api/ping → $BODY"; fi

# 2. Integration health
HEALTH=$(curl -fsS --max-time 30 "$BASE/api/agent/health" 2>&1)
if [ -n "$HEALTH" ]; then
  echo "      health: $HEALTH"
  if echo "$HEALTH" | grep -Eq '"(error|unknown)"'; then
    bad "/api/agent/health reports a degraded integration"
  else
    ok "/api/agent/health all integrations ok"
  fi
else
  bad "/api/agent/health returned nothing"
fi

# 3. TLS certificate validity + expiry
if command -v openssl >/dev/null; then
  END=$(echo | openssl s_client -servername "$HOST" -connect "$HOST:443" 2>/dev/null \
        | openssl x509 -noout -enddate 2>/dev/null | cut -d= -f2)
  if [ -n "$END" ]; then
    END_TS=$(date -d "$END" +%s 2>/dev/null || date -j -f '%b %d %T %Y %Z' "$END" +%s 2>/dev/null)
    NOW_TS=$(date +%s)
    DAYS=$(( (END_TS - NOW_TS) / 86400 ))
    [ "$DAYS" -gt 14 ] && ok "TLS cert valid, expires in ${DAYS} days ($END)" \
                       || bad "TLS cert expires in ${DAYS} days — renewal is broken"
  else
    bad "Could not read TLS certificate for $HOST"
  fi
else
  echo "skip  openssl not found — TLS expiry not checked"
fi

# 4. HTTP→HTTPS redirect
CODE=$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 "http://$HOST/api/ping" || echo 000)
case "$CODE" in
  301|302|307|308) ok "HTTP→HTTPS redirect ($CODE)" ;;
  *) bad "http://$HOST returned $CODE (expected 30x redirect)" ;;
esac

# 5. SSE streaming on the chat endpoint (the thing proxies break most often)
SSE_OUT=$(curl -sN --max-time 60 -X POST "$BASE/api/agent/chat" \
  -H 'Content-Type: application/json' \
  -H 'Accept: text/event-stream' \
  -d '{"messages":[{"role":"user","content":"Reply with the single word: pong"}]}' \
  | head -c 2000)
if echo "$SSE_OUT" | grep -q '^event: '; then
  ok "SSE stream delivered events from /api/agent/chat"
else
  bad "SSE stream broken — first bytes: $(echo "$SSE_OUT" | head -c 200)"
fi

# 6. Response time on ping
MS=$(curl -s -o /dev/null -w '%{time_total}' --max-time 10 "$BASE/api/ping" | awk '{printf "%d", $1*1000}')
[ "$MS" -lt 2000 ] && ok "/api/ping latency ${MS}ms" || bad "/api/ping latency ${MS}ms (>2s)"

echo
echo "PASS=$PASS FAIL=$FAIL"
if [ "$FAIL" -gt 0 ]; then
  echo "Result: FAILED — see docs/coolify/06-stage-5-testing-cutover.md troubleshooting."
  exit 1
fi
echo "Result: all smoke tests passed."
exit 0
