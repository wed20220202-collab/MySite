Firebaseなしローカルテスト方法

【PCの1ブラウザだけで確認】
1. movie.html を開く
2. 動画を選択して「色を抽出」→「保存」
3. admin.html と index.html を別タブで開く
4. admin.htmlでシーケンス選択→START

【スマホ複数台で同期テスト】
1. PCでこのフォルダを開く
2. アドレスバーに cmd と入力してEnter
3. 以下を実行
   node server.js
4. 表示された LAN URL をスマホで開く
   例: http://192.168.x.x:3000/index.html
5. PCで admin.html を開いてSTART

※Firebaseは未使用です。
※スマホ複数台で同期する場合は、PCとスマホを同じWi-Fiに接続してください。
