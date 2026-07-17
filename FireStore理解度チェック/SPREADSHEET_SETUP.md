# Spreadsheet記録の設定メモ

サイトからSpreadsheetへ記録されない場合、ほぼApps Scriptの公開設定が原因です。

## 必須設定

Apps Scriptで `spreadsheet-apps-script.js` を貼り付けたあと、以下でデプロイしてください。

1. `デプロイ` > `新しいデプロイ`
2. 種類: `ウェブアプリ`
3. 実行ユーザー: `自分`
4. アクセスできるユーザー: `全員`
5. デプロイ
6. 発行された `/exec` URLを `app.js` の `SPREADSHEET_WEB_APP_URL` に貼る

## 401 Unauthorized が出る場合

現在のURLは外部からPOSTすると `401 Unauthorized` になります。
これはWebアプリがログイン必須、または学校ドメイン内のみ許可になっている状態です。

GitHub Pagesなどから記録したい場合は、`アクセスできるユーザー` を `全員` にする必要があります。
もし学校のGoogle Workspace設定で `全員` が選べない場合は、Apps Script方式ではなくGoogleフォーム送信方式に変えるのが一番簡単です。

## 作られるシート

- `回答ログ`
- `問題マスタ`
- `学習サマリ`
