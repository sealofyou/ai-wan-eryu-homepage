#!/usr/bin/env bash
set -euo pipefail

export DEBIAN_FRONTEND=noninteractive
export NEEDRESTART_MODE=a

DEPLOY_USER="${DEPLOY_USER:-deploy}"

apt-get update
apt-get -y upgrade
apt-get install -y \
  apt-transport-https \
  ca-certificates \
  curl \
  debian-archive-keyring \
  debian-keyring \
  gnupg \
  rsync \
  sudo \
  ufw \
  unattended-upgrades

timedatectl set-timezone Asia/Shanghai

if ! id "$DEPLOY_USER" >/dev/null 2>&1; then
  useradd --create-home --shell /bin/bash "$DEPLOY_USER"
fi

usermod -aG sudo "$DEPLOY_USER"
passwd -l "$DEPLOY_USER"

install -d -m 0700 -o "$DEPLOY_USER" -g "$DEPLOY_USER" "/home/$DEPLOY_USER/.ssh"
install -m 0600 -o "$DEPLOY_USER" -g "$DEPLOY_USER" \
  /root/.ssh/authorized_keys "/home/$DEPLOY_USER/.ssh/authorized_keys"

cat >/etc/sudoers.d/90-deploy-caddy <<EOF
$DEPLOY_USER ALL=(root) NOPASSWD: /usr/bin/systemctl reload caddy, /usr/bin/systemctl status caddy, /usr/bin/journalctl -u caddy
EOF
chmod 0440 /etc/sudoers.d/90-deploy-caddy
visudo -cf /etc/sudoers.d/90-deploy-caddy

cat >/etc/ssh/sshd_config.d/60-vps2-hardening.conf <<'EOF'
PubkeyAuthentication yes
PasswordAuthentication no
KbdInteractiveAuthentication no
PermitRootLogin prohibit-password
X11Forwarding no
EOF

sshd -t
systemctl reload ssh

cat >/etc/apt/apt.conf.d/20auto-upgrades <<'EOF'
APT::Periodic::Update-Package-Lists "1";
APT::Periodic::Unattended-Upgrade "1";
EOF

if ! swapon --show=NAME --noheadings | grep -q .; then
  fallocate -l 1G /swapfile
  chmod 0600 /swapfile
  mkswap /swapfile
  swapon /swapfile
fi

if ! grep -q '^/swapfile ' /etc/fstab; then
  echo '/swapfile none swap sw 0 0' >>/etc/fstab
fi

if ! command -v caddy >/dev/null 2>&1; then
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' \
    | gpg --dearmor --yes -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' \
    | tee /etc/apt/sources.list.d/caddy-stable.list >/dev/null
  chmod o+r /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  chmod o+r /etc/apt/sources.list.d/caddy-stable.list
  apt-get update
  apt-get install -y caddy
fi

install -d -m 0755 -o "$DEPLOY_USER" -g "$DEPLOY_USER" /srv/eryu-homepage/releases
install -d -m 0755 /etc/caddy/sites-available /etc/caddy/sites-enabled

ufw default deny incoming
ufw default allow outgoing
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable
systemctl enable --now ufw

# This VPS image uses ifupdown, so networkd cannot determine when eth0 is online.
if systemctl is-enabled --quiet networking.service \
  && grep -q '^iface eth0 ' /etc/network/interfaces; then
  systemctl disable --now systemd-networkd-wait-online.service
  systemctl reset-failed systemd-networkd-wait-online.service || true
fi

systemctl enable caddy

echo "DEPLOY_USER=$DEPLOY_USER"
echo "TIMEZONE=$(timedatectl show -p Timezone --value)"
echo "CADDY=$(caddy version)"
echo "UFW=$(ufw status | head -n 1)"
echo "SWAP=$(swapon --show=SIZE --noheadings | xargs)"
if [ -f /var/run/reboot-required ]; then
  echo "REBOOT_REQUIRED=yes"
else
  echo "REBOOT_REQUIRED=no"
fi
