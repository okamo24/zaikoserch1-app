#!/usr/bin/env bash
set -euo pipefail

APP_ROOT="/var/www/kurapuro"
WEB_ROOT="${APP_ROOT}/web"

if [ ! -d "${WEB_ROOT}" ]; then
  echo "Web root not found: ${WEB_ROOT}" >&2
  exit 1
fi

cd "${WEB_ROOT}"

if [ ! -f ".env.production" ]; then
  echo ".env.production not found in ${WEB_ROOT}" >&2
  exit 1
fi

npm ci
npm run build

pm2 startOrReload ecosystem.config.cjs --env production
pm2 save

echo "Application deployed."
