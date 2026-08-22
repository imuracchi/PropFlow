# PropFlow V2 リリース判定（2026-08-22）

## 自動確認結果

- `pnpm test`: 合格
- `pnpm check`: 合格
- `VITE_V2_DEFAULT=true pnpm build`: 合格
- `pnpm test:v2:smoke`: 合格
- `pnpm test:v2:restriction-ui`: PC・スマホとも合格
- `pnpm test:v2:user-ui`: PC・スマホ・管理画面とも合格
- `pnpm release:preflight`（テストDB）: 合格
- PDF生成API: HTTP 200、A4 PDF 1ページ、日本語生成成功
- `pnpm db:push:test`: データ削除警告なしで合格

## 確認済み範囲

- ログイン、新規登録、パスワード再設定
- 物件一覧、詳細、登録、編集、公開・非公開、成約、論理削除・復元
- お気に入り、自分用メモ、検索ログ
- 商談、要返信、成約・閲覧制限後の履歴閲覧
- 関連資料、PDF直URL、紹介資料、ダウンロード資料
- 閲覧制限の一覧・直URL・資料URL回避防止
- 一般ユーザーによる物件編集・公開・成約・削除・資料操作のAPI拒否
- マイページ、興味者リスト、お知らせ
- 管理画面のPC・スマホ表示とページ横スクロール防止

## 本番作業前の必須手動確認

- [ ] Railwayで本番DBバックアップ／スナップショットを取得
- [ ] 現在の正常コミットID・デプロイIDを記録
- [ ] `DATABASE_URL`、`JWT_SECRET`、`SITE_URL=https://propflow.jp` を確認
- [ ] `RESEND_API_KEY` を確認し、社内宛て1通だけ送信テスト
- [ ] `ANTHROPIC_API_KEY` を確認し、社内資料1件だけAI抽出テスト
- [ ] `MLIT_API_KEY` を確認し、取引事例検索を1回テスト
- [ ] LINE・プッシュ通知を使う場合のみ各キーを確認
- [ ] 3本のDB移行SQLを存在確認付きで適用
- [ ] 本番環境変数で `pnpm release:preflight` を実行
- [ ] 未コミットのV2変更をリリース用コミットとして確定

## 切替方法

1. まず `VITE_V2_DEFAULT=false` のまま配備し、`/v2/properties` を社内確認する。
2. `/healthz`、件数一致、詳細、PDF、商談、マイページ、閲覧制限を確認する。
3. 問題がなければ夜間に `VITE_V2_DEFAULT=true` で再ビルド・配備する。
4. ログイン後の標準画面がV2であることをPC・スマホ各1台で確認する。
5. 旧画面 `/properties` は削除せず、緊急退避先として維持する。

## 切り戻し

1. `VITE_V2_DEFAULT=false` に戻し、直前の正常デプロイを再配備する。
2. `/healthz` と旧画面 `/properties` を確認する。
3. 追加カラム・テーブルは削除しない。
4. データ破損が確認された場合だけ利用を止め、取得済みバックアップから復元する。

## 判定

コードとテスト環境は切替準備完了。本番固有のキー・バックアップ・本番DB事前検査が完了するまでは本番切替を実行しない。
