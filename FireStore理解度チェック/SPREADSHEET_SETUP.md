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

## 回答数などをサイトへ反映する場合

`回答数`、`正答率`、`得意問題`、`復習候補` はSpreadsheetの `回答ログ` から読み戻します。

`spreadsheet-apps-script.js` を更新したら、Apps Script側でも必ず貼り替えてから `デプロイを管理` > `編集` > `新バージョン` で再デプロイしてください。

確認URL:

```text
発行されたURL?action=progress&userId=user01
```

`{"ok":true,"progress":...}` が返れば、サイト側へ反映できます。
`unknown action` が返る場合は、Apps Scriptの再デプロイがまだ古いままです。

回答記録の確認URL:

```text
発行されたURL?action=history&userId=user01&limit=50
```

`{"ok":true,"history":[...]}` が返れば、Web画面の `回答記録` に表示できます。

表示名の確認URL:

```text
発行されたURL?action=profile&userId=user01
```

ランキングの確認URL:

```text
発行されたURL?action=ranking&prefix=FSQ&limit=30
発行されたURL?action=ranking&prefix=FPQ&limit=30
```

`unknown action` が返る場合は、Apps Scriptの再デプロイがまだ古いままです。

アカウント管理の確認URL:

```text
発行されたURL?action=accounts
```

`アカウント管理` シートで、ログインID・パスワード・表示名・顔アイコン・回答できる問題IDのPrefixを一元管理します。

| ID | パスワード | 表示名 | 回答可能Prefix | 有効 | アイコンID |
| --- | --- | --- | --- | --- | --- |
| user01 | mizu7421 | 赤池秀斗 | FSQ | TRUE | avatar-1 |
| user07 | 1111AAAA | user07 | FPQ | TRUE | avatar-1 |

- `FSQ` は `user01` から `user06` 用です。
- `FPQ` は `Puser01` から `Puser06` 用です。
- 複数Prefixを許可する場合は `FSQ,FPQ` のように入力します。
- `有効` を `FALSE` にすると、そのアカウントではログインできません。

## 401 Unauthorized が出る場合

現在のURLは外部からPOSTすると `401 Unauthorized` になります。
これはWebアプリがログイン必須、または学校ドメイン内のみ許可になっている状態です。

GitHub Pagesなどから記録したい場合は、`アクセスできるユーザー` を `全員` にする必要があります。
もし学校のGoogle Workspace設定で `全員` が選べない場合は、Apps Script方式ではなくGoogleフォーム送信方式に変えるのが一番簡単です。

## 作られるシート

- `回答ログ`
- `問題マスタ`
- `アカウント管理`
