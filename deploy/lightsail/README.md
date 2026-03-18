# Lightsail Deploy

このアプリを AWS Lightsail の Ubuntu インスタンスへ公開するための最小構成です。

## 前提

- Lightsail インスタンスを作成済み
- Static IP を割り当て済み
- DNS をその IP に向けられる
- Supabase の本番プロジェクトがある

## 推奨構成

- Ubuntu
- Node.js LTS
- PM2
- Nginx
- Let's Encrypt

## 1. サーバー初期設定

サーバーへ SSH 接続して、`setup-server.sh` を実行します。

```bash
chmod +x deploy/lightsail/setup-server.sh
./deploy/lightsail/setup-server.sh
```

## 2. アプリ配置

`/var/www/kurapuro/web` にこの `web` フォルダを配置します。

例:

```bash
mkdir -p /var/www/kurapuro
cd /var/www/kurapuro
git clone <your-repo-url> .
cd web
```

## 3. 本番環境変数

`.env.production` を作成します。

```bash
cp deploy/lightsail/.env.production.example .env.production
nano .env.production
```

最低限必要:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SERVICE_ROLE_KEY=
NEXT_PUBLIC_APP_URL=https://example.com
AUTH_ALLOWED_EMAILS=allowed1@example.com,allowed2@example.com
AUDIT_LOG_RETENTION_DAYS=90
```

## 4. アプリ起動

```bash
chmod +x deploy/lightsail/deploy-app.sh
./deploy/lightsail/deploy-app.sh
pm2 startup
```

`pm2 startup` の出力で表示された `sudo` コマンドも実行します。

## 5. Nginx 設定

`deploy/lightsail/nginx-kurapuro.conf` を `/etc/nginx/sites-available/kurapuro` に配置し、`server_name` を本番ドメインへ書き換えます。

```bash
sudo cp deploy/lightsail/nginx-kurapuro.conf /etc/nginx/sites-available/kurapuro
sudo nano /etc/nginx/sites-available/kurapuro
sudo ln -s /etc/nginx/sites-available/kurapuro /etc/nginx/sites-enabled/kurapuro
sudo nginx -t
sudo systemctl reload nginx
```

不要なら default サイトを外します。

```bash
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl reload nginx
```

## 6. HTTPS 化

```bash
sudo certbot --nginx -d example.com -d www.example.com
```

## 7. Supabase 側の更新

- Site URL を `https://example.com`
- Google Provider の Redirect URL に `https://example.com/auth/callback`

## 8. 公開確認

- `https://example.com/login`
- Google ログイン
- `/chat` の検索
- CSV インポート
- メンバー管理
- `logs/audit.ndjson`

## 運用コマンド

```bash
pm2 status
pm2 logs kurapuro-web
pm2 restart kurapuro-web
sudo systemctl status nginx
sudo journalctl -u nginx -n 100
```
