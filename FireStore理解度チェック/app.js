const FALLBACK_QUESTIONS = [
    {
        id: "add-order",
        category: "基本操作",
        level: 1,
        type: "choice",
        question: "Order.htmlから新しい注文をFirestoreへ追加するときに使う操作はどれ？",
        code: "await addDoc(collection(db, 'orders'), {\n  table: '01',\n  status: 'waiting',\n  items: cart\n});",
        choices: ["addDoc(collection(...), data)", "getDocs(query(...))", "deleteDoc(doc(...))", "where('table', '==', '01')"],
        answer: 0,
        hint: "新しいドキュメントIDをFirestore側に作ってもらう操作です。",
        explanation: "addDocはコレクションに新しいドキュメントを追加します。注文送信のように、注文IDを自動採番したい場面に向いています。"
    },
    {
        id: "query-table",
        category: "検索",
        level: 1,
        type: "choice",
        question: "01卓の注文だけを取得したい。正しいwhere条件はどれ？",
        code: "query(collection(db, 'orders'), /* ここに条件 */)",
        choices: ["where('table', '==', '01')", "where('table', '!=', '01')", "where('orders', '==', '01')", "where('items.table', '==', '01')"],
        answer: 0,
        hint: "ordersドキュメントのtableフィールドを完全一致で見る。",
        explanation: "卓番検索は table フィールドを対象に where('table', '==', '01') を使います。テーブル変更や合算の確認でも同じ考え方です。"
    },
    {
        id: "update-table",
        category: "更新",
        level: 1,
        type: "choice",
        question: "テーブル変更で、伝票の卓番だけを01から02へ変更する操作はどれ？",
        code: "await updateDoc(doc(db, 'orders', orderId), {\n  table: '02'\n});",
        choices: ["updateDoc", "addDoc", "getDocs", "serverTimestamp"],
        answer: 0,
        hint: "既存ドキュメントの一部フィールドだけを変える操作です。",
        explanation: "updateDocは既存ドキュメントの指定フィールドだけを更新します。itemsを触らずtableだけ変更するのに向いています。"
    },
    {
        id: "delete-empty-order",
        category: "削除",
        level: 2,
        type: "choice",
        question: "注文済み商品の取消で、最後の商品まで消したときに行うべき処理は？",
        choices: ["ordersドキュメント自体をdeleteDocで削除する", "itemsを空配列にして必ず残す", "CookListを削除する", "statusをwaitingに戻す"],
        answer: 0,
        hint: "空の伝票が残るとKDSや履歴で扱いに困ります。",
        explanation: "最後の商品を取消したら、その注文伝票は意味を失うため deleteDoc で削除する設計が自然です。"
    },
    {
        id: "server-time",
        category: "時刻",
        level: 1,
        type: "choice",
        question: "注文時刻を端末の時計ではなくFirestore側の時刻で保存したい。使う値は？",
        choices: ["serverTimestamp()", "new Date().toLocaleString()", "Date.now()", "Math.random()"],
        answer: 0,
        hint: "複数端末で時計がずれても、サーバー基準でそろえられます。",
        explanation: "serverTimestamp()を使うとFirestoreサーバーの時刻で保存されます。KDSの並び順や提供時間計算で信頼しやすくなります。"
    },
    {
        id: "on-snapshot",
        category: "リアルタイム",
        level: 2,
        type: "choice",
        question: "KDS側で注文の追加・変更をリアルタイムに反映するために使うFirestore APIは？",
        choices: ["onSnapshot", "getDocs", "addDoc", "deleteDoc"],
        answer: 0,
        hint: "一度読むだけではなく、変更を監視し続けるAPIです。",
        explanation: "onSnapshotはクエリ結果やドキュメントの変更を監視します。KDSのように新規注文を即表示したい画面に向いています。"
    },
    {
        id: "getdocs",
        category: "検索",
        level: 1,
        type: "choice",
        question: "在庫マスタCookListを画面表示前に一度だけ読み込む場合に向いているAPIは？",
        choices: ["getDocs", "onSnapshot", "deleteDoc", "updateDoc"],
        answer: 0,
        hint: "リアルタイム監視ではなく、その時点の一覧取得です。",
        explanation: "getDocsはクエリ結果を一度だけ取得します。メニュー読み込みや検索ボタン押下時の確認に使いやすい操作です。"
    },
    {
        id: "collection-doc",
        category: "参照",
        level: 1,
        type: "choice",
        question: "ordersコレクション内の特定IDの注文を参照する書き方は？",
        choices: ["doc(db, 'orders', orderId)", "collection(db, 'orders', orderId)", "where(db, 'orders', orderId)", "query(db, orderId)"],
        answer: 0,
        hint: "特定の1件はcollectionではなくdocで参照します。",
        explanation: "doc(db, 'orders', orderId)でドキュメント参照を作ります。updateDocやdeleteDocに渡すときによく使います。"
    },
    {
        id: "array-update",
        category: "更新",
        level: 2,
        type: "choice",
        question: "注文済み商品の1行だけ取消したい。今回のようなitems配列では、基本的にどう更新する？",
        choices: ["items配列を作り直してupdateDocする", "whereで配列内の行だけ削除する", "collection('items')を必ず作る", "serverTimestampで消す"],
        answer: 0,
        hint: "配列内の何番目かを指定して、次の配列を保存する考え方です。",
        explanation: "itemsが配列の場合、対象行を除いた新しい配列を作って updateDoc({ items: nextItems }) するのが分かりやすい方法です。"
    },
    {
        id: "subcollection",
        category: "設計",
        level: 3,
        type: "choice",
        question: "注文商品が非常に多く、商品ごとの更新や監視が増える場合、items配列の代替として検討できる設計は？",
        choices: ["orders/{orderId}/items サブコレクション", "localStorageだけに保存", "CookListを毎回削除", "全注文を1ドキュメントにまとめる"],
        answer: 0,
        hint: "親の注文と子の商品明細に分ける考え方です。",
        explanation: "商品明細をサブコレクションに分けると、明細単位の追加・更新・削除がしやすくなります。小規模なら配列でも十分です。"
    },
    {
        id: "rules-auth",
        category: "セキュリティ",
        level: 2,
        type: "choice",
        question: "本番でFirestoreを使うとき、クライアントから直接書き込むなら必ず考えるべきものは？",
        choices: ["Security Rules", "CSSの色", "HTMLのtitleだけ", "ブラウザのズーム率"],
        answer: 0,
        hint: "誰がどのデータを読める・書けるかを決めます。",
        explanation: "Security RulesはFirestoreの読み書き権限を守る重要な設定です。デモでは動いても、本番では必ず設計が必要です。"
    },
    {
        id: "index-needed",
        category: "検索",
        level: 3,
        type: "choice",
        question: "whereで絞り込み、orderByで並び替える複合クエリが失敗した。Firestoreでよく必要になるものは？",
        choices: ["複合インデックス", "画像ファイル", "CSSリセット", "別のブラウザ"],
        answer: 0,
        hint: "Firestoreのエラーに作成リンクが出ることがあります。",
        explanation: "複数条件や並び替えを組み合わせるクエリでは、複合インデックスが必要になることがあります。エラー内のリンクから作成できます。"
    },
    {
        id: "batch-merge",
        category: "整合性",
        level: 3,
        type: "choice",
        question: "合算処理で「新しい注文を追加」して「元の注文を複数削除」する。より安全にまとめたい場合に検討するのは？",
        choices: ["writeBatchまたはtransaction", "setTimeout", "alert", "CSSアニメーション"],
        answer: 0,
        hint: "複数の書き込みをひとまとまりとして扱う仕組みです。",
        explanation: "複数書き込みをまとめたい場合は writeBatch や transaction を検討します。途中失敗による中途半端な状態を減らせます。"
    },
    {
        id: "transaction",
        category: "整合性",
        level: 3,
        type: "choice",
        question: "残数 stockQty を複数端末が同時に減らす可能性がある。競合を避けたいときに向いているのは？",
        choices: ["transaction", "toLocaleString", "querySelector", "location.hash"],
        answer: 0,
        hint: "読み取りと書き込みを一連の処理として再試行できます。",
        explanation: "在庫数のような競合しやすい値はtransactionで現在値を読み、条件を確認して更新すると安全性が上がります。"
    },
    {
        id: "status-field",
        category: "設計",
        level: 2,
        type: "choice",
        question: "注文の進行状況をKDSや履歴で扱いやすくするためにordersへ持たせるとよいフィールドは？",
        choices: ["status", "backgroundColor", "buttonSize", "fontFamily"],
        answer: 0,
        hint: "waiting、cooking、servedなどを入れられる名前です。",
        explanation: "statusフィールドを持たせると、提供待ち・調理中・提供済みなどの状態で絞り込みや表示切替ができます。"
    },
    {
        id: "hidden-item",
        category: "KDS",
        level: 2,
        type: "choice",
        question: "KDSで提供済みにした商品を注文履歴には残したい。今回の実装に近い考え方は？",
        choices: ["item.hidden = true と hiddenAt を付ける", "商品名を空にする", "注文全体を必ず削除する", "CookListから消す"],
        answer: 0,
        hint: "削除ではなく、表示対象から外すフラグです。",
        explanation: "hidden:true のようなフラグを付けると、KDS表示からは外しつつ、注文履歴や提供時間分析には残せます。"
    },
    {
        id: "table-format",
        category: "データ品質",
        level: 2,
        type: "choice",
        question: "卓番を 1 と 01 が混在しないようにする一番の目的は？",
        choices: ["検索条件の不一致を防ぐため", "文字を派手にするため", "価格を安くするため", "Firebase設定を隠すため"],
        answer: 0,
        hint: "where('table', '==', '01') で 1 はヒットしません。",
        explanation: "Firestoreの文字列比較は完全一致です。01と1が混在すると検索漏れが起きるため、保存前の正規化が大切です。"
    },
    {
        id: "order-method",
        category: "設計",
        level: 2,
        type: "choice",
        question: "orderMethod: 'SELF' のような値を保存する目的は？",
        choices: ["注文元の画面や担当区分を後から判別するため", "必ず価格を計算するため", "Firestoreを初期化するため", "画像を表示するため"],
        answer: 0,
        hint: "お客様セルフ注文と従業員注文を区別できます。",
        explanation: "orderMethodを保存すると、注文元や担当者コードを分析・表示できます。KDSや提供済み一覧で由来を見分ける助けになります。"
    },
    {
        id: "guest-count",
        category: "設計",
        level: 1,
        type: "choice",
        question: "人数入力を注文データに保存するなら、ordersドキュメントに追加する自然なフィールド名は？",
        choices: ["guestCount", "cssCount", "htmlCount", "queryCountOnly"],
        answer: 0,
        hint: "来店人数を意味する英語名です。",
        explanation: "guestCount のように意味が分かるフィールド名で保存すると、会計・席管理・分析で使いやすくなります。"
    },
    {
        id: "not-found",
        category: "UX",
        level: 1,
        type: "choice",
        question: "テーブル変更で入力された卓番の注文が存在しない場合、画面側で行うべき対応は？",
        choices: ["アラートやメッセージで存在しないことを伝える", "無関係な注文を更新する", "何も言わず成功扱いにする", "CookListを読み直すだけにする"],
        answer: 0,
        hint: "利用者が入力ミスに気づける必要があります。",
        explanation: "存在しない卓番は処理できないため、明確なメッセージを出すと誤操作を防げます。"
    },
    {
        id: "doc-id",
        category: "参照",
        level: 2,
        type: "choice",
        question: "getDocsの結果を後でupdateDoc/deleteDocしたい。data()だけでなく保持すべきものは？",
        choices: ["doc.id", "document.body", "CSS class", "alert text"],
        answer: 0,
        hint: "ドキュメントを指定するためのIDです。",
        explanation: "doc.data()だけではドキュメントIDが取れません。更新や削除に使うため、id: doc.id も一緒に保持します。"
    },
    {
        id: "limit",
        category: "検索",
        level: 2,
        type: "choice",
        question: "履歴一覧で最新20件だけ取得したい。orderByと一緒に使うとよいものは？",
        choices: ["limit(20)", "deleteDoc(20)", "serverTimestamp(20)", "collection(20)"],
        answer: 0,
        hint: "取得件数を制限するAPIです。",
        explanation: "limit(20)を使うと取得件数を絞れます。履歴やランキングなど、大量データを全部読まない工夫になります。"
    },
    {
        id: "offline-cache",
        category: "運用",
        level: 3,
        type: "choice",
        question: "通信状態が悪い環境でFirestoreを使うとき、設計上意識したいことは？",
        choices: ["失敗時の表示、再試行、二重送信防止", "文字サイズだけ", "背景色だけ", "HTMLコメントだけ"],
        answer: 0,
        hint: "注文送信は特に、成功・失敗が分かる必要があります。",
        explanation: "ネットワーク失敗時は、送信中ボタン、再試行、二重送信防止、エラーメッセージを考えると運用しやすくなります。"
    }
];
let QUESTIONS = [...FALLBACK_QUESTIONS];
let questionsLoadedFromSpreadsheet = false;

const DAILY_VARIANT_FACTORIES = [
    (seed) => {
        const tables = ["01", "02", "03-0", "05-1", "12", "18-2"];
        const table = tables[seed % tables.length];
        return {
            id: `daily-query-table-${todayKey()}-${table}`,
            category: "検索",
            level: 1,
            type: "choice",
            question: `${table}卓の注文だけをFirestoreから取得したい。正しい条件はどれ？`,
            code: "query(collection(db, 'orders'), /* 条件 */)",
            choices: [`where('table', '==', '${table}')`, `where('table', '!=', '${table}')`, `where('guestCount', '==', '${table}')`, `where('items.table', '==', '${table}')`],
            answer: 0,
            hint: "卓番はordersドキュメントのtableフィールドに保存されています。",
            explanation: `Firestoreのwhereは完全一致です。${table}卓を探すなら where('table', '==', '${table}') を使います。`
        };
    },
    (seed) => {
        const fields = [
            ["status", "調理状態"],
            ["guestCount", "人数"],
            ["table", "卓番"],
            ["orderMethod", "注文元"]
        ];
        const [field, label] = fields[seed % fields.length];
        return {
            id: `daily-update-field-${todayKey()}-${field}`,
            category: "更新",
            level: 2,
            type: "choice",
            question: `既存の注文ドキュメントの「${label}」だけを変更したい。使う操作は？`,
            code: `await updateDoc(doc(db, 'orders', orderId), {\n  ${field}: '...'\n});`,
            choices: ["updateDoc", "addDoc", "getDocs", "collection"],
            answer: 0,
            hint: "既存ドキュメントの一部だけを変える操作です。",
            explanation: `${label}のような一部フィールドだけを変える場合はupdateDocを使います。新規作成のaddDocとは役割が違います。`
        };
    },
    (seed) => {
        const counts = [10, 20, 30, 50, 100];
        const count = counts[seed % counts.length];
        return {
            id: `daily-limit-${todayKey()}-${count}`,
            category: "検索",
            level: 2,
            type: "choice",
            question: `提供済み履歴を最新${count}件だけ表示したい。取得件数を絞るために使うものは？`,
            choices: [`limit(${count})`, `deleteDoc(${count})`, `serverTimestamp(${count})`, `where('limit', '==', ${count})`],
            answer: 0,
            hint: "読み込む件数を制限するAPIです。",
            explanation: `大量データを毎回すべて読むと重くなります。最新${count}件だけならorderByとlimit(${count})を組み合わせます。`
        };
    },
    (seed) => {
        const actions = ["合算", "テーブル変更", "注文取消", "在庫更新"];
        const action = actions[seed % actions.length];
        return {
            id: `daily-safety-${todayKey()}-${action}`,
            category: "整合性",
            level: 3,
            type: "choice",
            question: `${action}で複数の書き込みが必要になった。途中失敗を減らすために検討したいものは？`,
            choices: ["writeBatchまたはtransaction", "alertを増やす", "CSSを分ける", "HTMLコメントを追加する"],
            answer: 0,
            hint: "複数書き込みをまとめて扱うFirestoreの仕組みです。",
            explanation: `${action}のように複数ドキュメントを更新する処理は、writeBatchやtransactionを検討すると中途半端な状態を減らせます。`
        };
    },
    (seed) => {
        const statuses = ["waiting", "cooking", "served", "canceled"];
        const status = statuses[seed % statuses.length];
        return {
            id: `daily-status-${todayKey()}-${status}`,
            category: "設計",
            level: 2,
            type: "choice",
            question: `注文状態を「${status}」として保存したい。ordersに持たせる自然なフィールド名は？`,
            choices: ["status", "style", "buttonText", "htmlMode"],
            answer: 0,
            hint: "注文の状態を表す一般的なフィールド名です。",
            explanation: "statusを持たせると、提供待ち・調理中・提供済み・取消などで絞り込みや表示切替がしやすくなります。"
        };
    },
    (seed) => {
        const collections = ["orders", "CookList", "StaffList"];
        const collectionName = collections[seed % collections.length];
        return {
            id: `daily-doc-ref-${todayKey()}-${collectionName}`,
            category: "参照",
            level: 1,
            type: "choice",
            question: `${collectionName}コレクションの特定IDのドキュメントを更新・削除したい。まず作る参照は？`,
            choices: [`doc(db, '${collectionName}', docId)`, `collection(db, '${collectionName}', docId)`, `query(db, '${collectionName}', docId)`, `where('${collectionName}', '==', docId)`],
            answer: 0,
            hint: "特定の1件はdocで参照します。",
            explanation: `特定IDの1件をupdateDoc/deleteDocするには doc(db, '${collectionName}', docId) でドキュメント参照を作ります。`
        };
    },
    (seed) => {
        const targets = ["注文送信", "取消処理", "KDS更新", "合算処理"];
        const target = targets[seed % targets.length];
        return {
            id: `daily-ux-${todayKey()}-${target}`,
            category: "UX",
            level: 2,
            type: "choice",
            question: `${target}でFirestoreへの通信に失敗した。画面として一番よい対応は？`,
            choices: ["失敗メッセージを出し、必要なら再試行できるようにする", "成功したことにする", "何も表示しない", "メニュー名を変える"],
            answer: 0,
            hint: "利用者が次に何をすればよいか分かる必要があります。",
            explanation: "通信失敗時は失敗を明確に伝え、二重送信を避けながら再試行できる設計が大切です。"
        };
    },
    (seed) => {
        const values = ["1", "01", "3-0", "03-0", "12-2"];
        const value = values[seed % values.length];
        return {
            id: `daily-normalize-${todayKey()}-${value}`,
            category: "データ品質",
            level: 2,
            type: "choice",
            question: `卓番「${value}」のような入力を保存前に整える目的は？`,
            choices: ["検索漏れを防ぐため", "文字数を増やすため", "価格計算を省くため", "ログインを不要にするため"],
            answer: 0,
            hint: "whereの文字列比較は完全一致です。",
            explanation: "Firestoreでは文字列が完全一致しないとヒットしません。卓番は保存前に01や03-0のように揃えると検索漏れを防げます。"
        };
    }
];

const STORAGE_KEY = "firestoreQuizProgressV1";
const USER_ID_KEY = "firestoreQuizUserIdV1";
const AUTH_SESSION_KEY = "firestoreQuizLoginV1";
const DISPLAY_NAME_KEY = "firestoreQuizDisplayNameV1";
const AVATAR_ID_KEY = "firestoreQuizAvatarIdV1";
const ACCOUNT_CACHE_KEY = "firestoreQuizAccountsCacheV1";
const QUESTION_CACHE_KEY = "firestoreQuizQuestionsCacheV1";
// Spreadsheetへ記録したい場合は、Apps ScriptのウェブアプリURLをここに貼り付ける。
// 空欄のままなら、これまで通りブラウザ内だけに記録する。
const SPREADSHEET_WEB_APP_URL = "https://script.google.com/macros/s/AKfycbziQ7twF_xfY43ecDPZe05_c1X14KfyQwLQwLX_xd7cozzu548gaYPo5zgpVrdN2Qpweg/exec";
const QUESTION_FETCH_TIMEOUT_MS = 8000;
const PROGRESS_FETCH_TIMEOUT_MS = 8000;
const HISTORY_FETCH_TIMEOUT_MS = 8000;
const RANKING_FETCH_TIMEOUT_MS = 8000;
const FALLBACK_AUTH_ACCOUNTS = [];
let authAccounts = [];
const COURSE_INFO = {
    daily: { label: "今日の必修", guide: "日替わり10問でFirestoreの基礎を確認します。" },
    weak: { label: "復習BOX", guide: "間違えた問題だけを集めて復習します。正解するとBOXから外れます。" },
    all: { label: "全問演習", guide: "Spreadsheetに登録されている全問題を、1問ずつ最後まで解けます。" },
    scenario: { label: "実装判断", guide: "設計・運用・KDS連携の判断問題を出題します。" }
};
let progress = createEmptyProgress();
let currentMode = "daily";
let currentSet = [];
let currentIndex = 0;
let answeredCurrent = false;
let answerHistory = [];
let rankingItems = { FSQ: [], FPQ: [] };
let activeView = "record";

const $ = (id) => document.getElementById(id);

function todayKey() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function dateSeed(key) {
    return [...key].reduce((sum, ch) => sum + ch.charCodeAt(0), 0);
}

function seededShuffle(items, seed) {
    const list = [...items];
    let value = seed || 1;
    for (let i = list.length - 1; i > 0; i--) {
        value = (value * 9301 + 49297) % 233280;
        const j = Math.floor((value / 233280) * (i + 1));
        [list[i], list[j]] = [list[j], list[i]];
    }
    return list;
}

function generatedDailyQuestions(key = todayKey()) {
    const seed = dateSeed(key);
    return DAILY_VARIANT_FACTORIES.map((factory, index) => factory(seed + index * 37));
}

function shuffleQuestionChoices(question, seed, questionIndex) {
    const correctChoice = question.choices[question.answer];
    const wrongChoices = question.choices.filter((_, index) => index !== question.answer);
    const shuffledWrong = seededShuffle(wrongChoices, seed);
    const targetIndex = Math.abs(seed + questionIndex * 2) % question.choices.length;
    const shuffled = [...shuffledWrong];
    shuffled.splice(targetIndex, 0, correctChoice);

    return {
        ...question,
        choices: shuffled,
        answer: targetIndex
    };
}

function prepareQuestionSet(questions, seed) {
    return questions.map((question, index) => shuffleQuestionChoices(question, seed + index * 101, index));
}

function normalizeFetchedQuestion(row, index) {
    const choices = Array.isArray(row.choices)
        ? row.choices
        : [row.choice1, row.choice2, row.choice3, row.choice4];
    const cleanChoices = choices.map(choice => String(choice || "").trim()).filter(Boolean);
    const answerNumber = Number(row.answerNumber ?? row.correctNumber ?? row.answerIndex ?? row.answer);
    const answerIndex = Number.isFinite(answerNumber)
        ? Math.max(0, Math.min(3, answerNumber > 0 ? answerNumber - 1 : answerNumber))
        : 0;

    if (!row || !row.question || cleanChoices.length < 2) return null;

    while (cleanChoices.length < 4) {
        cleanChoices.push(`選択肢${cleanChoices.length + 1}`);
    }

    return {
        id: String(row.id || row.questionId || `sheet-${index + 1}`).trim(),
        category: String(row.category || "未分類").trim(),
        level: row.level || "初級",
        type: row.type || "choice",
        question: String(row.question).trim(),
        code: String(row.code || "").trim(),
        choices: cleanChoices.slice(0, 4),
        answer: answerIndex,
        hint: String(row.hint || "問題文と選択肢をもう一度見比べてみましょう。").trim(),
        explanation: String(row.explanation || "Spreadsheetの問題マスタから読み込まれた問題です。").trim()
    };
}

function normalizeAccount(account) {
    const id = String(account?.id || "").trim();
    const fallbackPrefixes = id.startsWith("Puser") ? ["FPQ"] : ["FSQ"];
    const allowedPrefixes = Array.isArray(account?.allowedPrefixes)
        ? account.allowedPrefixes
        : String(account?.allowedPrefixes || "").split(/\s*,\s*|\s*\/\s*|\s+/);

    return {
        id,
        pass: String(account?.pass || "").trim(),
        name: String(account?.name || "").trim(),
        enabled: isAccountEnabled(account?.enabled),
        allowedPrefixes: allowedPrefixes.map(prefix => String(prefix || "").trim()).filter(Boolean).length
            ? allowedPrefixes.map(prefix => String(prefix || "").trim()).filter(Boolean)
            : fallbackPrefixes
    };
}

function isAccountEnabled(value) {
    if (value === false) return false;
    if (value === true) return true;
    if (value === null || value === undefined || value === "") return true;
    const text = String(value).trim().toUpperCase();
    return !["FALSE", "0", "NO", "OFF", "無効"].includes(text);
}

function saveCache(key, value) {
    try {
        localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
        // Cache is only a speed-up. Ignore storage failures.
    }
}

function readCache(key, fallback) {
    try {
        return JSON.parse(localStorage.getItem(key) || "null") || fallback;
    } catch (error) {
        return fallback;
    }
}

function hydrateFastCaches() {
    const cachedAccounts = readCache(ACCOUNT_CACHE_KEY, []);
    if (Array.isArray(cachedAccounts) && cachedAccounts.length) {
        authAccounts = cachedAccounts.map(normalizeAccount).filter(account => account.id && account.pass);
    }

    const cachedQuestions = readCache(QUESTION_CACHE_KEY, []);
    if (Array.isArray(cachedQuestions) && cachedQuestions.length) {
        QUESTIONS = cachedQuestions.map(normalizeFetchedQuestion).filter(Boolean);
        questionsLoadedFromSpreadsheet = QUESTIONS.length > 0;
    }
}

async function loadAccountsFromSpreadsheet() {
    if (!SPREADSHEET_WEB_APP_URL) {
        authAccounts = FALLBACK_AUTH_ACCOUNTS.map(normalizeAccount);
        return false;
    }

    try {
        const url = new URL(SPREADSHEET_WEB_APP_URL);
        url.searchParams.set("action", "accounts");
        url.searchParams.set("t", Date.now().toString());
        const response = await fetch(url.toString(), { cache: "no-store" });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const data = await response.json();
        const fetched = (data.accounts || []).map(normalizeAccount).filter(account => account.id && account.pass && account.enabled);
        if (!fetched.length) throw new Error("Spreadsheetに有効なアカウントがありません");
        authAccounts = fetched;
        saveCache(ACCOUNT_CACHE_KEY, fetched);
        return true;
    } catch (error) {
        if (!authAccounts.length) authAccounts = FALLBACK_AUTH_ACCOUNTS.map(normalizeAccount);
        return false;
    }
}

async function loadQuestionsFromSpreadsheet() {
    if (!SPREADSHEET_WEB_APP_URL) return false;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), QUESTION_FETCH_TIMEOUT_MS);

    try {
        const url = new URL(SPREADSHEET_WEB_APP_URL);
        url.searchParams.set("action", "questions");
        url.searchParams.set("t", Date.now().toString());
        const response = await fetch(url.toString(), { signal: controller.signal, cache: "no-store" });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const data = await response.json();
        const fetched = (data.questions || [])
            .map(normalizeFetchedQuestion)
            .filter(Boolean);

        if (!fetched.length) throw new Error("Spreadsheetに有効な問題がありません");

        QUESTIONS = fetched;
        questionsLoadedFromSpreadsheet = true;
        saveCache(QUESTION_CACHE_KEY, fetched);
        return true;
    } catch (error) {
        if (!QUESTIONS.length) {
            QUESTIONS = [...FALLBACK_QUESTIONS];
            questionsLoadedFromSpreadsheet = false;
        }
        return false;
    } finally {
        clearTimeout(timeout);
    }
}

function normalizeRemoteProgress(remote) {
    const safeRemote = remote || {};
    return {
        total: Number(safeRemote.total || 0),
        correct: Number(safeRemote.correct || 0),
        byQuestion: safeRemote.byQuestion || {},
        wrongBank: safeRemote.wrongBank || {},
        dailyDone: progress.dailyDone || {},
        streak: Number(safeRemote.streak || 0),
        lastStudyDate: safeRemote.lastStudyDate || progress.lastStudyDate || ""
    };
}

async function loadProgressFromSpreadsheet() {
    const account = getCurrentAccount();
    if (!SPREADSHEET_WEB_APP_URL || !account) return false;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), PROGRESS_FETCH_TIMEOUT_MS);

    try {
        const url = new URL(SPREADSHEET_WEB_APP_URL);
        url.searchParams.set("action", "progress");
        url.searchParams.set("userId", account.id);
        url.searchParams.set("t", Date.now().toString());

        const response = await fetch(url.toString(), { signal: controller.signal, cache: "no-store" });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const data = await response.json();
        if (!data || data.ok === false || !data.progress) return false;

        const remoteProgress = normalizeRemoteProgress(data.progress);
        if (remoteProgress.total > 0 || Object.keys(remoteProgress.byQuestion).length > 0) {
            progress = remoteProgress;
            saveProgress();
            updateStats();
            renderReviewState();
            renderDailyList();
            renderQuestionBank();
        }
        return true;
    } catch (error) {
        return false;
    } finally {
        clearTimeout(timeout);
    }
}

function normalizeHistoryItem(item) {
    return {
        recordedAt: item.recordedAt || item.answeredAt || "",
        date: item.date || "",
        mode: item.mode || "",
        questionId: item.questionId || "",
        category: item.category || "未分類",
        level: item.level || "",
        question: item.question || "",
        selectedAnswer: item.selectedAnswer || "",
        correctAnswer: item.correctAnswer || "",
        result: item.result || (item.isCorrect ? "正解" : "不正解")
    };
}

async function loadAnswerHistoryFromSpreadsheet() {
    const account = getCurrentAccount();
    if (!SPREADSHEET_WEB_APP_URL || !account) {
        renderAnswerHistory();
        return false;
    }

    const status = $("history-status");
    if (status) status.textContent = "読込中";
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), HISTORY_FETCH_TIMEOUT_MS);

    try {
        const url = new URL(SPREADSHEET_WEB_APP_URL);
        url.searchParams.set("action", "history");
        url.searchParams.set("userId", account.id);
        url.searchParams.set("limit", "150");
        url.searchParams.set("t", Date.now().toString());

        const response = await fetch(url.toString(), { signal: controller.signal, cache: "no-store" });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const data = await response.json();
        if (!data || data.ok === false || !Array.isArray(data.history)) throw new Error("history unavailable");

        answerHistory = data.history.map(normalizeHistoryItem);
        renderAnswerHistory();
        return true;
    } catch (error) {
        if (status) status.textContent = "読込失敗";
        renderAnswerHistory();
        return false;
    } finally {
        clearTimeout(timeout);
    }
}

function createEmptyProgress() {
    return { total: 0, correct: 0, byQuestion: {}, wrongBank: {}, dailyDone: {}, streak: 0, lastStudyDate: "" };
}

function getProgressStorageKey() {
    const account = getCurrentAccount();
    return account ? `${STORAGE_KEY}:${account.id}` : `${STORAGE_KEY}:guest`;
}

function loadProgress() {
    try {
        const data = JSON.parse(localStorage.getItem(getProgressStorageKey()) || "{}");
        return {
            total: data.total || 0,
            correct: data.correct || 0,
            byQuestion: data.byQuestion || {},
            wrongBank: data.wrongBank || {},
            dailyDone: data.dailyDone || {},
            streak: data.streak || 0,
            lastStudyDate: data.lastStudyDate || ""
        };
    } catch (error) {
        return createEmptyProgress();
    }
}

function saveProgress() {
    localStorage.setItem(getProgressStorageKey(), JSON.stringify(progress));
}

function getDefaultAccountName() {
    return getCurrentAccount()?.name || "";
}

function getDisplayNameStorageKey() {
    const account = getCurrentAccount();
    return account ? `${DISPLAY_NAME_KEY}:${account.id}` : `${DISPLAY_NAME_KEY}:guest`;
}

function getAvatarStorageKey() {
    const account = getCurrentAccount();
    return account ? `${AVATAR_ID_KEY}:${account.id}` : `${AVATAR_ID_KEY}:guest`;
}

function getDisplayName() {
    return localStorage.getItem(getDisplayNameStorageKey()) || getDefaultAccountName();
}

function getAvatarId() {
    return localStorage.getItem(getAvatarStorageKey()) || "avatar-1";
}

function getAvatarImageSrc(avatarId) {
    const match = String(avatarId || "avatar-1").match(/^avatar-([1-8])$/);
    const number = match ? match[1].padStart(2, "0") : "01";
    return `https://api.dicebear.com/10.x/personas/svg?seed=avatar${number}`;
}

function setDisplayName(name) {
    const cleanName = String(name || "").trim().slice(0, 24);
    if (cleanName) {
        localStorage.setItem(getDisplayNameStorageKey(), cleanName);
    } else {
        localStorage.removeItem(getDisplayNameStorageKey());
    }
    renderProfile();
    updateAuthView();
    return cleanName || getDefaultAccountName();
}

function setAvatarId(avatarId) {
    const safeAvatarId = /^avatar-[1-8]$/.test(String(avatarId || "")) ? avatarId : "avatar-1";
    localStorage.setItem(getAvatarStorageKey(), safeAvatarId);
    renderProfile();
    return safeAvatarId;
}

async function loadProfileFromSpreadsheet() {
    const account = getCurrentAccount();
    if (!SPREADSHEET_WEB_APP_URL || !account) return false;

    try {
        const url = new URL(SPREADSHEET_WEB_APP_URL);
        url.searchParams.set("action", "profile");
        url.searchParams.set("userId", account.id);
        url.searchParams.set("t", Date.now().toString());
        const response = await fetch(url.toString(), { cache: "no-store" });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        if (data?.ok && data.profile) {
            if (data.profile.displayName) setDisplayName(data.profile.displayName);
            if (data.profile.avatarId) setAvatarId(data.profile.avatarId);
            renderProfile();
        } else {
            renderProfile();
        }
        return true;
    } catch (error) {
        renderProfile();
        return false;
    }
}

async function loadRankingFromSpreadsheet() {
    if (!SPREADSHEET_WEB_APP_URL) {
        renderRanking();
        return false;
    }

    const status = $("ranking-status");
    if (status) status.textContent = "読込中";
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), RANKING_FETCH_TIMEOUT_MS);

    try {
        const results = await Promise.all(getRankingPrefixesForAccount().map(async prefix => {
            const url = new URL(SPREADSHEET_WEB_APP_URL);
            url.searchParams.set("action", "ranking");
            url.searchParams.set("prefix", prefix);
            url.searchParams.set("limit", "50");
            url.searchParams.set("t", Date.now().toString());
            const response = await fetch(url.toString(), { signal: controller.signal, cache: "no-store" });
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const data = await response.json();
            if (!data || data.ok === false || !Array.isArray(data.ranking)) throw new Error("ranking unavailable");
            return [prefix, data.ranking.filter(item => isRankingItemForPrefix(item, prefix))];
        }));
        rankingItems = { FSQ: [], FPQ: [], ...Object.fromEntries(results) };
        renderRanking();
        return true;
    } catch (error) {
        if (status) status.textContent = "読込失敗";
        renderRanking();
        return false;
    } finally {
        clearTimeout(timeout);
    }
}

function saveProfileToSpreadsheet(displayName) {
    const account = getCurrentAccount();
    if (!SPREADSHEET_WEB_APP_URL || !account) return;
    fetch(SPREADSHEET_WEB_APP_URL, {
        method: "POST",
        mode: "no-cors",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({
            action: "profile",
            userId: account.id,
            displayName,
            avatarId: getAvatarId()
        })
    }).catch(() => {});
}

function getCurrentAccount() {
    const id = localStorage.getItem(AUTH_SESSION_KEY) || "";
    const normalizedId = id.toLowerCase();
    return authAccounts.find(account => account.id.toLowerCase() === normalizedId) || null;
}

function getUserId() {
    const account = getCurrentAccount();
    if (account) return account.id;

    let id = localStorage.getItem(USER_ID_KEY);
    if (!id) {
        id = `user-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        localStorage.setItem(USER_ID_KEY, id);
    }
    return id;
}

function renderDemoAccounts() {
    const wrap = $("demo-account-list");
    if (!wrap) return;
    wrap.innerHTML = authAccounts.map(account => `
        <div class="account-row">
            <span>${account.id}</span>
            <span>${account.pass}</span>
        </div>
    `).join("");
}

function updateAuthView() {
    const account = getCurrentAccount();
    document.body.classList.toggle("auth-locked", !account);
    const label = $("current-user-label");
    if (label) {
        label.textContent = account ? `${getDisplayName()} / ${account.id}` : "未ログイン";
    }
    if (!account) {
        $("login-id")?.focus();
    }
}

function setLoginLoading(isLoading) {
    const button = $("login-btn");
    const idInput = $("login-id");
    const passInput = $("login-pass");
    if (button) {
        button.disabled = isLoading;
        button.textContent = isLoading ? "ログイン確認中..." : "ログイン";
        button.classList.toggle("is-loading", isLoading);
    }
    if (idInput) idInput.disabled = isLoading;
    if (passInput) passInput.disabled = isLoading;
}

async function login() {
    if ($("login-btn")?.disabled) return;
    const id = $("login-id").value.trim();
    const normalizedId = id.toLowerCase();
    const pass = $("login-pass").value.trim();
    const error = $("login-error");
    error.classList.add("hidden");
    setLoginLoading(true);

    try {
        const loaded = await loadAccountsFromSpreadsheet();
        if (!loaded) {
            authAccounts = [];
        }
        if (!authAccounts.length) {
            error.textContent = "アカウント情報をSpreadsheetから読み込めませんでした。通信状態を確認してもう一度試してください。";
            error.classList.remove("hidden");
            return;
        }
        const account = authAccounts.find(item => item.enabled && item.id.toLowerCase() === normalizedId && item.pass === pass);

        if (!account) {
            error.textContent = "IDまたはパスワードが違います。";
            error.classList.remove("hidden");
            return;
        }

        localStorage.setItem(AUTH_SESSION_KEY, account.id);
        progress = loadProgress();
        currentMode = "daily";
        error.classList.add("hidden");
        $("login-pass").value = "";
        updateAuthView();
        renderProfile();
        updateStats();
        renderReviewState();
        renderCategoryFilter();
        renderQuestionBank();
        showView("record");
        startQuiz("daily");
        updateStats();
        renderReviewState();
        syncAfterLogin();
    } finally {
        setLoginLoading(false);
    }
}

function syncAfterLogin() {
    loadProfileFromSpreadsheet().then(() => {
        updateAuthView();
        renderProfile();
    }).catch(() => {});
    loadProgressFromSpreadsheet().then(() => {
        updateStats();
        renderReviewState();
        renderDailyList();
        renderQuestionBank();
    }).catch(() => {});
    loadAnswerHistoryFromSpreadsheet().catch(() => {});
}

function refreshCoreDataInBackground() {
    loadAccountsFromSpreadsheet().then(() => {
        renderDemoAccounts();
        updateAuthView();
        renderCategoryFilter();
        renderQuestionBank();
    }).catch(() => {});

    loadQuestionsFromSpreadsheet().then((updated) => {
        if (!updated) return;
        renderCategoryFilter();
        renderQuestionBank();
        startQuiz(currentMode || "daily");
    }).catch(() => {});
}

function logout() {
    localStorage.removeItem(AUTH_SESSION_KEY);
    progress = createEmptyProgress();
    currentMode = "daily";
    startQuiz("daily");
    updateStats();
    renderReviewState();
    answerHistory = [];
    rankingItems = { FSQ: [], FPQ: [] };
    renderAnswerHistory();
    renderRanking();
    showView("record");
    updateAuthView();
    renderCategoryFilter();
    renderQuestionBank();
}

function sendAnswerToSpreadsheet(question, choiceIndex, isCorrect) {
    if (!SPREADSHEET_WEB_APP_URL) return;

    const payload = {
        userId: getUserId(),
        userName: getDisplayName(),
        avatarId: getAvatarId(),
        date: todayKey(),
        mode: currentMode,
        questionId: question.id,
        category: question.category,
        level: question.level,
        question: question.question,
        code: question.code || "",
        choices: question.choices,
        selectedAnswer: question.choices[choiceIndex],
        correctAnswer: question.choices[question.answer],
        correctIndex: question.answer,
        isCorrect: isCorrect,
        hint: question.hint,
        explanation: question.explanation,
        totalAnswered: progress.total,
        totalCorrect: progress.correct,
        accuracy: progress.total ? Math.round((progress.correct / progress.total) * 100) : 0,
        streak: progress.streak || 0,
        questionCorrectCount: progress.byQuestion[question.id]?.correct || 0,
        questionWrongCount: progress.byQuestion[question.id]?.wrong || 0,
        answeredAt: new Date().toISOString()
    };

    fetch(SPREADSHEET_WEB_APP_URL, {
        method: "POST",
        mode: "no-cors",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify(payload)
    }).catch(() => {
        // 学習の邪魔をしないため、Spreadsheet送信失敗は画面に出さない。
    });
}

function getQuestionPrefix(questionId) {
    const id = String(questionId || "").trim();
    if (id.startsWith("FSQ")) return "FSQ";
    if (id.startsWith("FPQ")) return "FPQ";
    return "";
}

function getRankingPrefixesForAccount() {
    const account = getCurrentAccount();
    const prefixes = account?.allowedPrefixes || ["FSQ"];
    const filtered = prefixes.filter(prefix => prefix === "FSQ" || prefix === "FPQ");
    return filtered.length ? filtered : ["FSQ"];
}

function isRankingUserAllowedForPrefix(userId, prefix) {
    const id = String(userId || "").trim();
    if (prefix === "FPQ") return /^Puser\d{2}$/.test(id);
    if (prefix === "FSQ") return /^user\d{2}$/.test(id);
    return false;
}

function isRankingItemForPrefix(item, prefix) {
    const latestQuestionId = String(item?.latestQuestionId || "").trim();
    if (latestQuestionId && !latestQuestionId.startsWith(prefix)) return false;
    return isRankingUserAllowedForPrefix(item?.userId, prefix);
}

function canAccessQuestion(question) {
    const prefix = getQuestionPrefix(question?.id);
    if (!prefix) return true;
    const account = getCurrentAccount();
    if (!account) return false;
    return (account.allowedPrefixes || []).includes(prefix);
}

function availableQuestions() {
    return QUESTIONS.filter(canAccessQuestion);
}

function dailyQuestions() {
    const key = todayKey();
    const generated = questionsLoadedFromSpreadsheet ? [] : generatedDailyQuestions(key);
    const allowed = availableQuestions();
    const base = allowed.filter(q => !generated.some(g => g.category === q.category)).slice(0, 4);
    const mixed = seededShuffle([...generated, ...base, ...allowed], dateSeed(key));
    const required = [
        mixed.find(q => q.category === "基本操作"),
        mixed.find(q => q.category === "検索"),
        mixed.find(q => q.category === "更新"),
        mixed.find(q => q.category === "セキュリティ"),
        mixed.find(q => q.category === "設計")
    ].filter(Boolean);
    const rest = mixed.filter(q => !required.some(r => r.id === q.id));
    return [...required, ...rest].slice(0, 10);
}

function weakQuestions() {
    return Object.values(progress.wrongBank || {});
}

function scenarioQuestions() {
    return availableQuestions().filter(q => ["設計", "整合性", "KDS", "運用", "UX"].includes(q.category));
}

function buildSet(mode) {
    const seed = mode === "daily" ? dateSeed(todayKey()) : Date.now() % 100000;
    if (mode === "daily") return prepareQuestionSet(dailyQuestions(), seed + 1000);
    if (mode === "weak") return prepareQuestionSet(weakQuestions(), seed + 2000);
    if (mode === "scenario") return prepareQuestionSet(seededShuffle(scenarioQuestions(), seed).slice(0, 10), seed + 3000);
    const generated = questionsLoadedFromSpreadsheet ? [] : generatedDailyQuestions();
    return prepareQuestionSet(seededShuffle([...availableQuestions(), ...generated], seed), seed + 4000);
}

function startQuiz(mode = currentMode) {
    currentMode = mode;
    currentSet = buildSet(mode);
    currentIndex = 0;
    answeredCurrent = false;
    updateModeButtons();
    renderQuestion();
    renderDailyList();
    renderReviewState();
}

function startQuestionFromBank(questionId) {
    const ordered = prepareQuestionSet([...availableQuestions()], Date.now() % 100000);
    const targetIndex = ordered.findIndex(q => q.id === questionId);
    currentMode = "all";
    currentSet = ordered;
    currentIndex = Math.max(0, targetIndex);
    answeredCurrent = false;
    updateModeButtons();
    renderQuestion();
    renderDailyList();
    renderReviewState();
    document.querySelector(".quiz-panel")?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function updateModeButtons() {
    document.querySelectorAll(".course-card").forEach(btn => {
        btn.classList.toggle("active", btn.dataset.mode === currentMode);
    });
    const info = COURSE_INFO[currentMode] || COURSE_INFO.daily;
    $("today-title").textContent = info.label;
    $("today-label").textContent = `${todayKey()} / ${info.label}`;
    const heroText = document.querySelector(".hero-copy p");
    if (heroText) heroText.textContent = info.guide;
}

function renderQuestion() {
    if (!currentSet.length) {
        $("question-number").textContent = "Q0";
        $("question-category").textContent = currentMode === "weak" ? "復習BOX" : "準備";
        $("question-text").textContent = currentMode === "weak"
            ? "復習BOXは空です。間違えた問題がここに自動で入ります。"
            : "問題セットを準備できませんでした。";
        $("quiz-progress-bar").style.width = "0%";
        $("choices").innerHTML = "";
        $("code-block").classList.add("hidden");
        $("result-box").className = "result-box hidden";
        $("next-btn").disabled = true;
        return;
    }

    const q = currentSet[currentIndex];
    answeredCurrent = false;
    const progressRate = Math.round(((currentIndex + 1) / currentSet.length) * 100);
    $("question-number").textContent = `Q${currentIndex + 1}/${currentSet.length}`;
    $("question-category").textContent = q.category;
    $("question-text").textContent = q.question;
    $("quiz-progress-bar").style.width = `${progressRate}%`;
    $("next-btn").disabled = true;
    renderReviewState();
    $("result-box").className = "result-box hidden";
    $("result-box").innerHTML = "";

    if (q.code) {
        $("code-block").textContent = q.code;
        $("code-block").classList.remove("hidden");
    } else {
        $("code-block").classList.add("hidden");
    }

    $("choices").innerHTML = q.choices.map((choice, index) => (
        `<button class="choice-btn" data-index="${index}"><span>${String.fromCharCode(65 + index)}</span>${choice}</button>`
    )).join("");

    document.querySelectorAll(".choice-btn").forEach(btn => {
        btn.addEventListener("click", () => answerQuestion(Number(btn.dataset.index)));
    });
}

function normalizeQuestionForReview(question) {
    const correctChoice = question.choices[question.answer];
    const choices = [correctChoice, ...question.choices.filter((_, index) => index !== question.answer)];
    return {
        id: question.id,
        category: question.category,
        level: question.level,
        type: question.type,
        question: question.question,
        code: question.code || "",
        choices,
        answer: 0,
        hint: question.hint,
        explanation: question.explanation
    };
}

function updateReviewBox(question, isCorrect) {
    progress.wrongBank = progress.wrongBank || {};
    if (isCorrect) {
        delete progress.wrongBank[question.id];
        return;
    }
    progress.wrongBank[question.id] = normalizeQuestionForReview(question);
}

function renderReviewState() {
    const count = Object.keys(progress.wrongBank || {}).length;
    if ($("review-count")) $("review-count").textContent = `${count}問`;
    if ($("review-course-count")) $("review-course-count").textContent = `${count}問`;
    if ($("start-review-btn")) $("start-review-btn").disabled = count === 0;
}

function answerQuestion(choiceIndex) {
    if (answeredCurrent) return;
    const q = currentSet[currentIndex];
    if (!canAccessQuestion(q)) {
        $("result-box").className = "result-box bad";
        $("result-box").innerHTML = "<b>回答できません</b><br>このログインIDでは、この問題IDの問題に回答できません。";
        $("next-btn").disabled = false;
        return;
    }
    answeredCurrent = true;
    const isCorrect = choiceIndex === q.answer;

    progress.total += 1;
    if (isCorrect) progress.correct += 1;
    const record = progress.byQuestion[q.id] || { correct: 0, wrong: 0 };
    if (isCorrect) record.correct += 1;
    else record.wrong += 1;
    progress.byQuestion[q.id] = record;
    updateReviewBox(q, isCorrect);

    if (currentMode === "daily") {
        const key = todayKey();
        progress.dailyDone[key] = progress.dailyDone[key] || {};
        progress.dailyDone[key][q.id] = isCorrect ? "ok" : "ng";
        updateStreak(key);
    }

    saveProgress();
    sendAnswerToSpreadsheet(q, choiceIndex, isCorrect);
    answerHistory.unshift({
        recordedAt: new Date().toISOString(),
        date: todayKey(),
        mode: currentMode,
        questionId: q.id,
        category: q.category,
        level: q.level,
        question: q.question,
        selectedAnswer: q.choices[choiceIndex],
        correctAnswer: q.choices[q.answer],
        result: isCorrect ? "正解" : "不正解"
    });
    answerHistory = answerHistory.slice(0, 150);
    document.querySelectorAll(".choice-btn").forEach(btn => {
        const index = Number(btn.dataset.index);
        btn.disabled = true;
        if (index === q.answer) btn.classList.add("correct");
        if (index === choiceIndex && !isCorrect) btn.classList.add("wrong");
    });

    const result = $("result-box");
    result.className = `result-box ${isCorrect ? "good" : "bad"}`;
    result.innerHTML = `<b>${isCorrect ? "正解" : "不正解"}</b><br>${q.explanation}`;
    $("next-btn").disabled = false;
    updateStats();
    renderDailyList();
    renderReviewState();
    renderQuestionBank();
    renderAnswerHistory();
}

function updateStreak(key) {
    if (progress.lastStudyDate === key) return;

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yKey = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, "0")}-${String(yesterday.getDate()).padStart(2, "0")}`;
    progress.streak = progress.lastStudyDate === yKey ? progress.streak + 1 : 1;
    progress.lastStudyDate = key;
}

function nextQuestion() {
    if (currentIndex < currentSet.length - 1) {
        currentIndex += 1;
        renderQuestion();
        return;
    }
    const result = $("result-box");
    result.className = "result-box good";
    result.innerHTML = `<b>${COURSE_INFO[currentMode]?.label || "問題セット"} 完了</b><br>おつかれさまです。続けて問題一覧や復習BOXから別の問題にも取り組めます。`;
    $("next-btn").disabled = true;
}

function showHint() {
    const q = currentSet[currentIndex] || dailyQuestions()[0];
    const result = $("result-box");
    result.className = "result-box";
    result.innerHTML = `<b>ヒント</b><br>${q.hint}`;
    result.classList.remove("hidden");
}

function updateStats() {
    const accuracy = progress.total ? Math.round((progress.correct / progress.total) * 100) : 0;
    const mastered = Object.values(progress.byQuestion).filter(r => r.correct >= 2 && r.correct > r.wrong).length;
    const weak = Object.values(progress.byQuestion).filter(r => r.wrong >= r.correct && r.wrong > 0).length;
    $("answered-count").textContent = progress.total;
    $("accuracy-rate").textContent = `${accuracy}%`;
    $("mastered-count").textContent = mastered;
    $("weak-count").textContent = weak;
    $("streak-days").textContent = progress.streak || 0;
    const info = COURSE_INFO[currentMode] || COURSE_INFO.daily;
    $("today-label").textContent = `${todayKey()} / ${info.label}`;
}

function renderDailyList() {
    const todays = dailyQuestions();
    const done = progress.dailyDone[todayKey()] || {};
    $("daily-list").innerHTML = todays.map((q, index) => {
        const state = done[q.id] === "ok" ? "正解" : done[q.id] === "ng" ? "復習" : "未";
        return `
            <div class="daily-item">
                <span class="daily-index">${index + 1}</span>
                <span class="daily-title">${q.category}：${q.question}</span>
                <span class="daily-state">${state}</span>
            </div>
        `;
    }).join("");
}

function renderCategoryFilter() {
    const select = $("category-filter");
    if (!select) return;
    const currentValue = select.value || "all";
    const categories = [...new Set(availableQuestions().map(q => q.category || "未分類"))].sort((a, b) => a.localeCompare(b, "ja"));
    select.innerHTML = [
        `<option value="all">全カテゴリ</option>`,
        ...categories.map(category => `<option value="${escapeHtml(category)}">${escapeHtml(category)}</option>`)
    ].join("");
    select.value = categories.includes(currentValue) ? currentValue : "all";
}

function renderQuestionBank() {
    const list = $("question-bank-list");
    if (!list) return;
    const category = $("category-filter")?.value || "all";
    const filtered = availableQuestions().filter(q => category === "all" || q.category === category);
    if ($("question-bank-count")) $("question-bank-count").textContent = `${filtered.length}問`;

    list.innerHTML = filtered.map((q, index) => {
        const record = progress.byQuestion[q.id] || { correct: 0, wrong: 0 };
        const state = record.correct || record.wrong
            ? `正${record.correct || 0} / 誤${record.wrong || 0}`
            : "未回答";
        return `
            <button class="question-bank-item" type="button" data-question-id="${escapeHtml(q.id)}">
                <span class="bank-index">${index + 1}</span>
                <span class="bank-main">
                    <b>${escapeHtml(q.category)}：${escapeHtml(q.question)}</b>
                    <small>${escapeHtml(q.id)} / ${escapeHtml(q.level || "初級")}</small>
                </span>
                <em>${state}</em>
            </button>
        `;
    }).join("");

    document.querySelectorAll(".question-bank-item").forEach(btn => {
        btn.addEventListener("click", () => startQuestionFromBank(btn.dataset.questionId));
    });
}

function renderAnswerHistory() {
    const list = $("history-list");
    const status = $("history-status");
    if (!list) return;
    if (!answerHistory.length) {
        list.innerHTML = `<div class="empty-state">まだ表示できる回答記録がありません。</div>`;
        if (status && status.textContent !== "読込中" && status.textContent !== "読込失敗") status.textContent = "0件";
        return;
    }

    if (status) status.textContent = `${answerHistory.length}件`;
    list.innerHTML = answerHistory.map(item => {
        const good = item.result === "正解";
        return `
            <article class="history-item ${good ? "good" : "bad"}">
                <div class="history-head">
                    <b>${escapeHtml(item.result)}</b>
                    <span>${escapeHtml(formatHistoryDate(item.recordedAt || item.answeredAt || item.date))}</span>
                </div>
                <p>${escapeHtml(item.question)}</p>
                <dl>
                    <div><dt>選択</dt><dd>${escapeHtml(item.selectedAnswer)}</dd></div>
                    <div><dt>正解</dt><dd>${escapeHtml(item.correctAnswer)}</dd></div>
                    <div><dt>分類</dt><dd>${escapeHtml(item.category)} / ${escapeHtml(item.level)}</dd></div>
                </dl>
            </article>
        `;
    }).join("");
}

function renderRanking() {
    const fsqList = $("ranking-list");
    const fpqList = $("ranking-list-fpq");
    const status = $("ranking-status");
    if (!fsqList || !fpqList) return;

    const fsqItems = Array.isArray(rankingItems.FSQ) ? rankingItems.FSQ : [];
    const fpqItems = Array.isArray(rankingItems.FPQ) ? rankingItems.FPQ : [];
    const visiblePrefixes = getRankingPrefixesForAccount();
    const fsqGroup = fsqList.closest(".ranking-group");
    const fpqGroup = fpqList.closest(".ranking-group");
    if (fsqGroup) fsqGroup.classList.toggle("hidden", !visiblePrefixes.includes("FSQ"));
    if (fpqGroup) fpqGroup.classList.toggle("hidden", !visiblePrefixes.includes("FPQ"));

    if (visiblePrefixes.includes("FSQ")) renderRankingList(fsqList, fsqItems, "FSQ");
    if (visiblePrefixes.includes("FPQ")) renderRankingList(fpqList, fpqItems, "FPQ");

    if (status && status.textContent !== "読込失敗") {
        const visibleCount = visiblePrefixes.reduce((sum, prefix) => sum + (rankingItems[prefix]?.length || 0), 0);
        status.textContent = `${visibleCount}件`;
    }
}

function renderRankingList(list, items, prefix) {
    if (!items.length) {
        list.innerHTML = `<div class="empty-state">まだ${escapeHtml(prefix)}の回答ログがありません。</div>`;
        return;
    }

    list.innerHTML = items.map((item, index) => {
        const avatarId = item.avatarId || item.latestAvatarId || "avatar-1";
        const userName = item.userName || item.latestUserName || item.userId || "User";
        const todayAccuracy = formatRankingRate(item.todayAccuracy, item.todayTotal);
        const weekAccuracy = formatRankingRate(item.weekAccuracy, item.weekTotal);
        const monthAccuracy = formatRankingRate(item.monthAccuracy, item.monthTotal);
        return `
        <article class="ranking-item">
            <div class="rank-face">
                <span class="rank-no">${index + 1}</span>
                <img src="${escapeHtml(getAvatarImageSrc(avatarId))}" alt="${escapeHtml(userName)}">
            </div>
            <div class="rank-main">
                <b>${escapeHtml(userName)}</b>
                <p>${escapeHtml(item.userId || "")}</p>
                <small>${escapeHtml(prefix)}累計 ${Number(item.total || 0)}問 / 正答率 ${Number(item.accuracy || 0)}%</small>
                <span class="rank-user">直近 ${escapeHtml(item.latestQuestionId || prefix)} ${escapeHtml(item.latestCategory || "")}</span>
            </div>
            <div class="rank-score">
                <div><span>今日</span><strong>${todayAccuracy}</strong><em>${Number(item.todayTotal || 0)}件</em></div>
                <div><span>週間</span><strong>${weekAccuracy}</strong><em>${Number(item.weekTotal || 0)}件</em></div>
                <div><span>月間</span><strong>${monthAccuracy}</strong><em>${Number(item.monthTotal || 0)}件</em></div>
            </div>
        </article>
    `;
    }).join("");
}

function formatRankingRate(rate, total) {
    if (!Number(total || 0)) return "--";
    return `${Number(rate || 0)}%`;
}

function renderProfile() {
    const input = $("display-name-input");
    if (input) input.value = getDisplayName();
    const account = getCurrentAccount();
    const accountIdInput = $("account-id-input");
    const accountPassInput = $("account-pass-input");
    if (accountIdInput && account) accountIdInput.value = account.id;
    if (accountPassInput) accountPassInput.value = "";
    const avatarId = getAvatarId();
    document.querySelectorAll(".avatar-option").forEach(btn => {
        btn.classList.toggle("active", btn.dataset.avatarId === avatarId);
    });
}

function showView(viewName) {
    activeView = viewName || "record";
    document.querySelectorAll(".view-section").forEach(section => {
        section.classList.toggle("hidden-view", section.dataset.view !== activeView);
    });
    document.querySelectorAll("[data-nav-view]").forEach(btn => {
        btn.classList.toggle("active", btn.dataset.navView === activeView);
    });
    window.scrollTo({ top: 0, behavior: "smooth" });

    if (activeView === "record") loadAnswerHistoryFromSpreadsheet();
    if (activeView === "ranking") loadRankingFromSpreadsheet();
}

function saveDisplayNameFromInput() {
    const savedName = setDisplayName($("display-name-input")?.value || "");
    saveProfileToSpreadsheet(savedName);
    const status = $("profile-save-status");
    if (status) {
        status.textContent = "保存しました";
        setTimeout(() => {
            if (status.textContent === "保存しました") status.textContent = "保存済み";
        }, 1400);
    }
}

function selectAvatar(avatarId) {
    setAvatarId(avatarId);
    saveProfileToSpreadsheet(getDisplayName());
    const status = $("profile-save-status");
    if (status) status.textContent = "アイコン保存済み";
}

async function saveAccountFromInput() {
    const account = getCurrentAccount();
    const status = $("account-save-status");
    if (!account || !SPREADSHEET_WEB_APP_URL) return;

    const newId = $("account-id-input")?.value.trim() || account.id;
    const newPass = $("account-pass-input")?.value.trim() || "";
    if (!/^[A-Za-z0-9_-]{3,24}$/.test(newId)) {
        if (status) status.textContent = "ID形式エラー";
        return;
    }
    if (newPass && !/^[A-Za-z0-9!@#$%^&*_.-]{4,32}$/.test(newPass)) {
        if (status) status.textContent = "PASS形式エラー";
        return;
    }

    if (status) status.textContent = "保存中";
    try {
        const url = new URL(SPREADSHEET_WEB_APP_URL);
        url.searchParams.set("action", "accountUpdate");
        url.searchParams.set("currentId", account.id);
        url.searchParams.set("currentPass", account.pass);
        url.searchParams.set("newId", newId);
        if (newPass) url.searchParams.set("newPass", newPass);
        url.searchParams.set("t", Date.now().toString());
        const response = await fetch(url.toString(), { cache: "no-store" });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        if (!data?.ok || !data.account) throw new Error(data?.error || "account update failed");

        const updatedAccount = normalizeAccount(data.account);
        authAccounts = authAccounts.map(item => item.id.toLowerCase() === account.id.toLowerCase() ? updatedAccount : item);
        saveCache(ACCOUNT_CACHE_KEY, authAccounts);
        localStorage.setItem(AUTH_SESSION_KEY, updatedAccount.id);
        $("account-pass-input").value = "";
        updateAuthView();
        renderProfile();
        if (status) status.textContent = "保存しました";
    } catch (error) {
        if (status) status.textContent = "保存失敗";
    }
}

function formatHistoryDate(value) {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return `${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, "0")}/${String(date.getDate()).padStart(2, "0")} ${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function escapeHtml(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function resetToday() {
    progress.dailyDone[todayKey()] = {};
    saveProgress();
    startQuiz("daily");
    updateStats();
}

document.querySelectorAll(".course-card").forEach(btn => {
    btn.addEventListener("click", () => startQuiz(btn.dataset.mode));
});

$("start-daily-btn").addEventListener("click", () => startQuiz("daily"));
$("start-random-btn").addEventListener("click", () => startQuiz("all"));
$("start-all-btn")?.addEventListener("click", () => startQuiz("all"));
$("hint-btn").addEventListener("click", showHint);
$("next-btn").addEventListener("click", nextQuestion);
$("reset-today-btn").addEventListener("click", resetToday);
$("start-review-btn").addEventListener("click", () => startQuiz("weak"));
$("start-all-side-btn")?.addEventListener("click", () => startQuiz("all"));
$("refresh-history-btn")?.addEventListener("click", loadAnswerHistoryFromSpreadsheet);
$("refresh-ranking-btn")?.addEventListener("click", loadRankingFromSpreadsheet);
$("save-display-name-btn")?.addEventListener("click", saveDisplayNameFromInput);
$("save-account-btn")?.addEventListener("click", saveAccountFromInput);
$("display-name-input")?.addEventListener("keydown", event => {
    if (event.key === "Enter") saveDisplayNameFromInput();
});
$("account-id-input")?.addEventListener("keydown", event => {
    if (event.key === "Enter") saveAccountFromInput();
});
$("account-pass-input")?.addEventListener("keydown", event => {
    if (event.key === "Enter") saveAccountFromInput();
});
$("category-filter")?.addEventListener("change", renderQuestionBank);
document.querySelectorAll("[data-nav-view]").forEach(btn => {
    btn.addEventListener("click", () => showView(btn.dataset.navView));
});
document.querySelectorAll(".avatar-option").forEach(btn => {
    btn.addEventListener("click", () => selectAvatar(btn.dataset.avatarId));
});
$("login-btn").addEventListener("click", login);
$("logout-btn").addEventListener("click", logout);
$("login-id").addEventListener("keydown", event => {
    if (event.key === "Enter") $("login-pass").focus();
});
$("login-pass").addEventListener("keydown", event => {
    if (event.key === "Enter") login();
});

async function initializeApp() {
    hydrateFastCaches();
    $("question-number").textContent = "準備中";
    $("question-category").textContent = "Cache";
    $("question-text").textContent = "前回のデータで先に表示しています。";
    $("choices").innerHTML = "";
    $("code-block").classList.add("hidden");
    $("next-btn").disabled = true;

    progress = getCurrentAccount() ? loadProgress() : createEmptyProgress();
    updateStats();
    renderDemoAccounts();
    renderCategoryFilter();
    renderQuestionBank();
    renderAnswerHistory();
    renderRanking();
    renderProfile();
    startQuiz("daily");
    renderReviewState();
    updateAuthView();
    showView("record");
    refreshCoreDataInBackground();
    if (getCurrentAccount()) syncAfterLogin();
}

initializeApp();
