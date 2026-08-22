# PropFlow V2 本番移行手順

既存画面を止めず、`/v2/*` を並行公開してから段階的に標準画面へ切り替える。

## 1. 移行方針

- 旧画面のURLは削除しない。
- V2は `/v2/properties` から利用する。
- 最初は社内アカウント、次に協力会社2〜3社だけへV2のURLを案内する。
- 問題があれば案内URLを旧画面 `/properties` に戻す。DBは共通なのでデータ移行は不要。
- 旧画面の廃止とルートURLのV2転送は、並行運用完了後の別リリースで行う。
- 標準画面の切替はビルド環境変数 `VITE_V2_DEFAULT` で制御する。未設定または `false` は旧画面、`true` はV2。旧URL `/properties` は切替後も残る。

## 2. デプロイ前

1. Railwayで本番DBのバックアップ／スナップショットを作成する。
2. 現在稼働中のコミットIDとデプロイIDを記録する。
3. 次の環境変数を確認する。値をログや手順書へ貼り付けない。
   - `DATABASE_URL`
   - `JWT_SECRET`
   - `SITE_URL=https://propflow.jp`
   - `RESEND_API_KEY`（メールを使用する場合）
   - `LINE_CHANNEL_ACCESS_TOKEN`（LINEを使用する場合）
   - `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY`（プッシュ通知を使用する場合）
   - `ANTHROPIC_API_KEY`（AI抽出・AI検索を使用する場合）
   - `MLIT_API_KEY`（取引事例検索を使用する場合）
   - `VITE_V2_DEFAULT=false`（段階公開中）または `true`（標準画面切替時）
4. 本番と同じコードをステージングへデプロイし、`/healthz` がHTTP 200を返すことを確認する。
5. `pnpm check`、`pnpm test`、`pnpm build` を完了させる。

## 3. DB変更

今回の新規変更は次の3件。アプリ配備より先に、記載順で一度だけ実行する。

1. [20260822_add_published_at.sql](../drizzle/migrations/20260822_add_published_at.sql)
2. [20260822_add_owner_deleted_at.sql](../drizzle/migrations/20260822_add_owner_deleted_at.sql)
3. [20260822_remove_pending_approval.sql](../drizzle/migrations/20260822_remove_pending_approval.sql)

実行前確認：

```sql
SELECT COLUMN_NAME
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME = 'properties'
  AND COLUMN_NAME = 'publishedAt';
```

- 0件の場合だけ移行SQLを実行する。
- 1件の場合は既に適用済みなので、`ALTER TABLE`を再実行しない。
- `ownerDeletedAt` も同様に存在確認し、存在する場合は追加SQLを再実行しない。
- ユーザー状態移行後、`status='pending'` が0件であることを確認する。
- 移行後に `pnpm release:preflight` を本番環境変数付きで実行する。このスクリプトは読み取り専用。

## 4. デプロイ

1. 通知の一斉送信や物件更新が少ない時間帯を選ぶ。
2. 新バージョンをRailwayへデプロイする。既存インスタンスは新インスタンスのヘルスチェック成功まで維持する。
3. `/healthz` がHTTP 200、`{"ok":true,"database":true}` を返すことを確認する。
4. 社内アカウントで `/v2/properties` にログインする。
5. 次を確認する。
   - 物件件数が旧画面と一致する。
   - 物件詳細と関連資料を開ける。
   - PDFが別タブで表示される。
   - お気に入り追加・解除が反映される。
   - 商談履歴が表示される。テストメッセージは社内アカウント間だけで行う。
   - マイページを編集できる。
   - 下書きは物件登録者以外から開けない。
   - 閲覧制限対象者は一覧・直URL・PDF直URLから対象物件を開けない。
6. 本番メールの送信確認は、社内宛て1通だけで行う。一斉配信は実行しない。
7. AI抽出と取引事例検索は、各1回だけ実行して本番APIキーの疎通を確認する。

## 5. 段階公開

1. 社内だけで1営業日利用する。
2. 協力会社2〜3社へV2 URLを案内し、1週間並行運用する。
3. エラーログ、問い合わせ、PDF生成失敗、ログイン失敗を毎日確認する。
4. 問題がなければ案内対象を増やす。
5. 全利用者の移行後、Railwayの `VITE_V2_DEFAULT=true` でビルド・デプロイし、ログイン後の標準画面をV2へ切り替える。

## 6. ロールバック

画面上の問題だけなら、利用者へ旧URL `/properties` を案内する。V2 URLは残しても旧画面の稼働には影響しない。

標準画面切替後に問題が出た場合は、`VITE_V2_DEFAULT=false` に戻して直前の正常デプロイを再配備する。DB追加カラムは削除しない。

サーバー障害の場合：

1. Railwayで直前の正常なデプロイへロールバックする。
2. `/healthz` と旧画面 `/properties` を確認する。
3. `publishedAt` は旧コードが参照しない追加カラムなので、DBから削除しない。
4. データ破損が確認された場合のみ、利用を停止してバックアップから復元する。推測でDBを巻き戻さない。

## 7. 合格条件

- 既存データ件数が変わらない。
- 旧画面とV2を同時に開ける。
- ログイン、物件閲覧、商談、資料表示、マイページ編集が成功する。
- 権限外の編集・削除・下書き閲覧・閲覧制限回避ができない。
- エラー時に旧画面へ即時案内できる。
