#!/usr/bin/env bash
set -euo pipefail

APP_ROOT="/var/www/kurapuro"
WEB_ROOT="${APP_ROOT}/web"

sudo apt update
sudo apt install -y nginx certbot python3-certbot-nginx git curl unzip

if ! command -v node >/dev/null 2>&1; then
  curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -
  sudo apt install -y nodejs
fi

if ! command -v pm2 >/dev/null 2>&1; then
  sudo npm install -g pm2
fi

sudo mkdir -p "${APP_ROOT}"
sudo chown -R "$USER:$USER" "${APP_ROOT}"

mkdir -p "${WEB_ROOT}"

echo "Node version: $(node -v)"
echo "npm version: $(npm -v)"
echo "PM2 version: $(pm2 -v)"
echo "Server setup complete."
