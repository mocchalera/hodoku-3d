# デプロイ手順（Cloudflare Pages + hodoku.mocchalera.app）

公開構成:

- `/` … LP（別エージェントが本格LP・PVを実装する場所。今はプレースホルダー）
- `/play/` … ゲーム本体（単一HTML、外部依存なし）

デプロイ元: `public/` ディレクトリ（Cloudflare Pages のビルド出力先）

## 前提

- GitHub: `mocchalera/hodoku-3d`（本リポジトリ）
- Cloudflare アカウントに `mocchalera.app` ゾーンがあること
- Pages プロジェクト名: `hodoku-3d`

## ゲームの再ビルド → Pages 用コピー

```sh
python3 build.py
mkdir -p public/play
cp index.html public/play/index.html
python3 serve.py --port 8000
# http://127.0.0.1:8000/ がLP、http://127.0.0.1:8000/play/ がゲーム
```

`public/` 直下でサーブすると Pages と同じパス構成で確認できます:

```sh
cd public && python3 -m http.server 8000
```

## 方法A: wrangler から直接デプロイ（初回公開用・即時）

```sh
export PATH="/opt/homebrew/bin:$HOME/.local/bin:$HOME/.bun/bin:$PATH"
npx -y wrangler@latest login
npx -y wrangler@latest pages deploy ./public --project-name hodoku-3d
```

初回デプロイ後にカスタムドメインを追加（wrangler に `pages domain` コマンドは無いため API で追加。
ダッシュボード → Pages → `hodoku-3d` → Custom domains からでも可）:

```sh
TOKEN=$(grep -o 'oauth_token *= *"[^"]*"' ~/.wrangler/config/default.toml | cut -d'"' -f2)
curl -X POST "https://api.cloudflare.com/client/v4/accounts/<ACCOUNT_ID>/pages/projects/hodoku-3d/domains" \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  --data '{"name":"hodoku.mocchalera.app"}'
```

`hodoku.mocchalera.app` が有効化されると、同一アカウントのゾーンには Cloudflare が自動で DNS を設定します。

## 方法B: GitHub 連携で自動デプロイ（LP継続開発用・推奨）

別エージェントがLP・PVを継続実装するため、方法Aの後にこちらも設定すると更新が自動化されます。

1. Cloudflare ダッシュボード → Workers & Pages → Create → Pages → Connect to Git
2. `mocchalera/hodoku-3d` を選択
3. Build settings:
   - Framework preset: `None`
   - Build command: （空欄。静的 `public/` をそのまま配信）
   - Build output directory: `public`
4. Deploy → `https://hodoku-3d.pages.dev` で確認
5. Custom domains → `hodoku.mocchalera.app` を追加

## 動作確認チェック

- [ ] `https://hodoku.mocchalera.app/` がLPを表示する
- [ ] LPの「ゲームを遊ぶ」が `https://hodoku.mocchalera.app/play/` へ遷移する
- [ ] `/play/` で3Dゲームが起動し、操作（回転・拡大・交差点選択・試走）できる
- [ ] 共有リンク（`#plan=` ハッシュURL）が `/play/` 配下で再現できる

## 注意

- ゲームは単一HTML・外部fetchなしのため、`/play/` 配下への配置でそのまま動作します。
- `index.html`（リポジトリ直下）はローカル配布用ビルド成果物、`public/play/index.html` は公開用コピーです。両者は同一内容に保ってください。
- 音・保存はブラウザ内完結です。サーバー側の個人情報保持はありません。
