## Supabase セットアップ

1. Supabase プロジェクトを作成
2. SQL Editor で [202603120001_initial_app.sql](/c:/Projects/kurapuro/web/supabase/migrations/202603120001_initial_app.sql) を実行
3. Authentication で Google Provider を有効化
4. Redirect URL に以下を追加
   - `http://localhost:3000/auth/callback`
   - `https://<your-vercel-domain>/auth/callback`
5. `profiles` テーブルで最初の利用者の `role` を `admin` に更新

補足:
- `auth.users` から `profiles` へは trigger で自動作成されます
- callback 側でも `upsert` しているので、既存ユーザーの補完にも対応しています

MVPでは、CSV取込はサービスロールキーを使うサーバー側APIで実行します。
