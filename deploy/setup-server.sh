#!/usr/bin/env bash
# One-time setup of an Ubuntu server for the Memory Card Game web edition.
#
#   sudo bash setup-server.sh
#
# Installs Caddy from its official repository, opens only SSH (22) and the web
# ports Caddy needs (80 for certificates and redirects, 443 for HTTPS), creates
# the site folder for the deploying user, and installs the Caddyfile that sits
# beside this script. Safe to run again.
set -euo pipefail

SITE_DIR=/var/www/memory-card-game
DEPLOY_USER="${DEPLOY_USER:-${SUDO_USER:-}}"
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [ "$(id -u)" -ne 0 ]; then echo "Run this with sudo." >&2; exit 1; fi
if [ -z "$DEPLOY_USER" ] || [ "$DEPLOY_USER" = root ]; then echo "Run with sudo from the account that will deploy, or set DEPLOY_USER." >&2; exit 1; fi
if [ ! -f "$HERE/Caddyfile" ]; then echo "Caddyfile not found beside this script." >&2; exit 1; fi

echo "== Packages"
apt-get update
DEBIAN_FRONTEND=noninteractive apt-get install -y ufw curl gpg

echo "== Caddy (official repository)"
if [ ! -f /usr/share/keyrings/caddy-stable-archive-keyring.gpg ]; then
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' > /etc/apt/sources.list.d/caddy-stable.list
  chmod o+r /usr/share/keyrings/caddy-stable-archive-keyring.gpg /etc/apt/sources.list.d/caddy-stable.list
  apt-get update
fi
DEBIAN_FRONTEND=noninteractive apt-get install -y caddy

echo "== Firewall: SSH first, so this session is never cut off"
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw default deny incoming
ufw default allow outgoing
ufw --force enable
ufw status verbose

echo "== Site folder for $DEPLOY_USER"
install -d -o "$DEPLOY_USER" -g "$DEPLOY_USER" -m 755 "$SITE_DIR" "$SITE_DIR/releases"
install -d -o caddy -g caddy -m 755 /var/log/caddy

echo "== Caddy configuration"
install -m 644 "$HERE/Caddyfile" /etc/caddy/Caddyfile
caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile
systemctl enable caddy
systemctl restart caddy
systemctl --no-pager --lines=5 status caddy

echo "Done. Deploy with deploy/deploy.mjs; the certificate is issued on the first HTTPS request once DNS points here."
