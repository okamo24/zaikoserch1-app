## 在庫確認アプリ

`Next.js + Vercel + Supabase` を前提にした新しい実装基盤です。
既存の `FastAPI + SQLite` 試作は [../src](/c:/Projects/kurapuro/src) に残し、この `web` ディレクトリを今後の本体として育てます。

## 前提
- Node.js LTS
- npm
- Supabase プロジェクト

PowerShell の実行ポリシーで `npm.ps1` が止まる場合は、`npm.cmd` を使います。

## 開発コマンド

```powershell
npm.cmd install
npm.cmd run dev
```

PWA の HTTPS テストが必要な場合:

```powershell
npm.cmd run dev:https
```

開発サーバー起動後、`http://localhost:3000` を開きます。

## 直近の実装順
1. Supabase 接続
2. ログイン画面
3. `inventory_items` / `import_logs` / `profiles` テーブル作成
4. CSV取込管理画面
5. 検索API
6. チャットUI

## 環境変数
`.env.example` をコピーして `.env.local` を作成し、Supabase の値を入れます。

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SERVICE_ROLE_KEY=
NEXT_PUBLIC_APP_URL=http://localhost:3000
AUTH_ALLOWED_EMAILS=allowed1@example.com,allowed2@example.com
```

設定確認:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\check-setup.ps1
```

## デプロイ
Vercel へ接続すれば、Next.js アプリとしてそのままデプロイできます。

## Supabase
- SQL は [supabase/migrations/202603120001_initial_app.sql](/c:/Projects/kurapuro/web/supabase/migrations/202603120001_initial_app.sql) を実行
- Google Provider の Redirect URL には `/auth/callback` を登録
- 最初の管理者は `profiles.role = 'admin'` に更新

## PWA メモ
- `app/manifest.ts` で Web App Manifest を生成
- `public/icon.svg` と `public/apple-icon.svg` を暫定アイコンとして利用
- 端末追加の最終調整は、認証と主要画面実装後に行う
