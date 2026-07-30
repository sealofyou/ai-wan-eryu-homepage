#!/usr/bin/env bash
set -euo pipefail

EXPECTED_IP="5.253.38.249"
ROOT_IP="$(getent ahostsv4 eryu.fun | awk 'NR == 1 { print $1 }')"
WWW_IP="$(getent ahostsv4 www.eryu.fun | awk 'NR == 1 { print $1 }')"

if [[ "$ROOT_IP" != "$EXPECTED_IP" || "$WWW_IP" != "$EXPECTED_IP" ]]; then
  exit 0
fi

ln -sfn /etc/caddy/sites-available/eryu.fun.caddy /etc/caddy/sites-enabled/eryu.fun.caddy
caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile
systemctl reload caddy
systemctl disable --now eryu-domain-cutover.timer >/dev/null 2>&1 || true
