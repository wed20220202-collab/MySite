# 千駄木ちゃんこ祭りアンケート

`index.html` を入口にした、スマートフォン向けのアンケートフォームです。

回答は Google Apps Script のウェブアプリを経由して、指定の Google スプレッドシート（gid=0）へ保存します。Apps Script のソースは `Code.gs` です。

## ファイル

- `index.html`：フォーム本体
- `styles.css`：デザイン
- `app.js`：入力チェックと送信処理
- `thank-you.html`：回答済み表示と壁紙プレゼント
- `thank-you.js`：回答済み判定
- `wallpaper.html`：3つの作品から1デザインを選び、端末別サイズを受け取るページ
- `wallpaper.js`：1デザインを確定し、iPhone・Android・PC版を何度でも保存できる処理
- `wallpaper-maker.html`：非公開で使う壁紙トリミングツール
- `wallpaper-maker.css` / `wallpaper-maker.js`：トリミング画面と画像処理
- `assets/chanko-wallpaper.png`：回答者向け壁紙
- `assets/wallpapers/`：「茜の千駄木」「蒼流の庭」「朱映の杜」それぞれのiPhone・Android・PC版（計9枚）
- `Code.gs`：Google スプレッドシートへの保存処理

`app.js` の `SCRIPT_URL` には、デプロイ後のウェブアプリURLを設定します。

回答完了後はCookieと`localStorage`へ回答済み状態を1年間保存し、同じブラウザからの再回答を止めます。ブラウザのデータを消去した場合、シークレットモード、または別端末からの回答までは識別できません。

壁紙は一度選択すると別デザイン・別端末版へ変更できません。同じ壁紙の再保存は可能です。
