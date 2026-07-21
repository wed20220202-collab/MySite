// Google Apps Scriptにそのまま貼り付けて使うコードです。
// 1. Googleスプレッドシートを作成
// 2. 拡張機能 > Apps Script
// 3. このコードを貼り付け
// 4. デプロイ > 新しいデプロイ > ウェブアプリ
// 5. 実行ユーザー: 自分 / アクセスできるユーザー: 全員
// 6. 発行されたURLを app.js の SPREADSHEET_WEB_APP_URL に貼り付け

const ANSWER_SHEET = '回答ログ';
const QUESTION_SHEET = '問題マスタ';
const ACCOUNT_SHEET = 'アカウント管理';
const ACCOUNT_HEADERS = [
  'ID',
  'パスワード',
  '表示名',
  '回答可能Prefix',
  '有効',
  'アイコンID'
];
const DEFAULT_ACCOUNTS = [
  ['user01', 'mizu7421', '赤池秀斗', 'FSQ', 'TRUE', 'avatar-1'],
  ['user02', 'sora5386', 'アンサンヨウ', 'FSQ', 'TRUE', 'avatar-1'],
  ['user03', 'kumo9147', 'ブダトキマヘス', 'FSQ', 'TRUE', 'avatar-1'],
  ['user04', 'nami2068', '國谷光星', 'FSQ', 'TRUE', 'avatar-1'],
  ['user05', 'tsuki6753', '矢口颯人', 'FSQ', 'TRUE', 'avatar-1'],
  ['user06', 'hana8294', '藤井蒼太', 'FSQ', 'TRUE', 'avatar-1'],
  ['user07', '1111AAAA', 'user07', 'FPQ', 'TRUE', 'avatar-1'],
  ['user08', '1111AAAA', 'user08', 'FPQ', 'TRUE', 'avatar-1'],
  ['user09', '1111AAAA', 'user09', 'FPQ', 'TRUE', 'avatar-1'],
  ['user10', '1111AAAA', 'user10', 'FPQ', 'TRUE', 'avatar-1'],
  ['user11', '1111AAAA', 'user11', 'FPQ', 'TRUE', 'avatar-1'],
  ['user12', '1111AAAA', 'user12', 'FPQ', 'TRUE', 'avatar-1']
];
const QUESTION_HEADERS = [
  '問題ID',
  'カテゴリ',
  '難易度',
  '出題形式',
  '問題文',
  'コード例',
  '選択肢1',
  '選択肢2',
  '選択肢3',
  '選択肢4',
  '正解番号',
  '正解テキスト',
  'ヒント',
  '解説',
  'おすすめモード',
  'タグ'
];

function doGet(e) {
  const action = e && e.parameter && e.parameter.action ? e.parameter.action : 'questions';

  if (action === 'questions') {
    return jsonOutput_({
      ok: true,
      questions: getQuestionMaster_()
    });
  }

  if (action === 'accounts') {
    return jsonOutput_({
      ok: true,
      accounts: getAccountMaster_()
    });
  }

  if (action === 'accountUpdate') {
    const result = updateAccount_(e && e.parameter ? e.parameter : {});
    return jsonOutput_(result);
  }

  if (action === 'answer') {
    const data = answerDataFromParams_(e && e.parameter ? e.parameter : {});
    if (!isUserAllowedForQuestion_(data.userId, data.questionId)) {
      return jsonOutput_({
        ok: false,
        saved: false,
        error: 'user is not allowed for this question prefix'
      });
    }
    appendAnswerLog_(data);
    return jsonOutput_({
      ok: true,
      saved: true,
      userId: data.userId || '',
      questionId: data.questionId || ''
    });
  }

  if (action === 'progress') {
    const userId = e && e.parameter && e.parameter.userId ? e.parameter.userId : '';
    return jsonOutput_({
      ok: true,
      progress: getUserProgress_(userId)
    });
  }

  if (action === 'history') {
    const userId = e && e.parameter && e.parameter.userId ? e.parameter.userId : '';
    const limit = e && e.parameter && e.parameter.limit ? Number(e.parameter.limit) : 100;
    return jsonOutput_({
      ok: true,
      history: getUserAnswerHistory_(userId, limit)
    });
  }

  if (action === 'profile') {
    const userId = e && e.parameter && e.parameter.userId ? e.parameter.userId : '';
    return jsonOutput_({
      ok: true,
      profile: getUserProfile_(userId)
    });
  }

  if (action === 'ranking') {
    const limit = e && e.parameter && e.parameter.limit ? Number(e.parameter.limit) : 30;
    const prefix = e && e.parameter && e.parameter.prefix ? e.parameter.prefix : 'FSQ';
    return jsonOutput_({
      ok: true,
      ranking: getUserRanking_(limit, prefix),
      prefix: normalizeQuestionPrefix_(prefix)
    });
  }

  if (action === 'diagnostics') {
    const userId = e && e.parameter && e.parameter.userId ? e.parameter.userId : '';
    return jsonOutput_({
      ok: true,
      diagnostics: getDiagnostics_(userId)
    });
  }

  return jsonOutput_({ ok: false, error: 'unknown action' });
}

function doPost(e) {
  const data = JSON.parse(e.postData.contents || '{}');

  if (data.action === 'profile') {
    updateAccountProfile_(data);
    return ContentService
      .createTextOutput(JSON.stringify({ ok: true }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  if (!isUserAllowedForQuestion_(data.userId, data.questionId)) {
    return ContentService
      .createTextOutput(JSON.stringify({ ok: false, saved: false, error: 'user is not allowed for this question prefix' }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  appendAnswerLog_(data);
  upsertQuestionMaster_(data);

  return ContentService
    .createTextOutput(JSON.stringify({ ok: true }))
    .setMimeType(ContentService.MimeType.JSON);
}

function jsonOutput_(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

function normalizeId_(value) {
  return String(value || '').trim();
}

function answerDataFromParams_(params) {
  return {
    userId: normalizeId_(params.userId),
    userName: String(params.userName || '').trim(),
    avatarId: sanitizeAvatarId_(params.avatarId),
    date: String(params.date || '').trim(),
    mode: String(params.mode || '').trim(),
    questionId: String(params.questionId || '').trim(),
    category: String(params.category || '').trim(),
    level: String(params.level || '').trim(),
    question: String(params.question || '').trim(),
    selectedAnswer: String(params.selectedAnswer || '').trim(),
    correctAnswer: String(params.correctAnswer || '').trim(),
    isCorrect: String(params.isCorrect || '') === 'true',
    totalAnswered: Number(params.totalAnswered || 0),
    totalCorrect: Number(params.totalCorrect || 0),
    accuracy: Number(params.accuracy || 0),
    streak: Number(params.streak || 0),
    answeredAt: String(params.answeredAt || new Date().toISOString()).trim()
  };
}

function sanitizeAvatarId_(avatarId) {
  return /^avatar-[1-8]$/.test(String(avatarId || '')) ? String(avatarId) : 'avatar-1';
}

function isAccountEnabled_(value) {
  if (value === false) return false;
  if (value === true) return true;
  if (value === null || value === undefined || value === '') return true;
  const text = String(value).trim().toUpperCase();
  return text !== 'FALSE' && text !== '0' && text !== 'NO' && text !== 'OFF' && text !== '無効';
}

function getAccountMaster_() {
  const sheet = getSheet_(ACCOUNT_SHEET, ACCOUNT_HEADERS);
  if (sheet.getLastRow() < 2) {
    sheet.getRange(2, 1, DEFAULT_ACCOUNTS.length, DEFAULT_ACCOUNTS[0].length).setValues(DEFAULT_ACCOUNTS);
  }

  return getRowsAsObjects_(sheet).map(function(row) {
    return {
      id: normalizeId_(row['ID']),
      pass: String(row['パスワード'] || '').trim(),
      name: String(row['表示名'] || '').trim(),
      allowedPrefixes: String(row['回答可能Prefix'] || '')
        .split(/\s*,\s*|\s*\/\s*|\s+/)
        .map(function(prefix) { return String(prefix || '').trim(); })
        .filter(Boolean),
      enabled: isAccountEnabled_(row['有効']),
      avatarId: sanitizeAvatarId_(row['アイコンID'])
    };
  }).filter(function(account) {
    return account.id && account.pass && account.enabled;
  });
}

function updateAccount_(params) {
  const currentId = normalizeId_(params.currentId);
  const currentPass = String(params.currentPass || '').trim();
  const newId = normalizeId_(params.newId);
  const newPass = String(params.newPass || '').trim();
  const displayName = String(params.displayName || '').trim().slice(0, 24);
  const avatarId = sanitizeAvatarId_(params.avatarId);
  if (!currentId || !currentPass || !newId) {
    return { ok: false, error: 'missing account fields' };
  }
  if (!/^[A-Za-z0-9_-]{3,24}$/.test(newId)) {
    return { ok: false, error: 'invalid id format' };
  }
  if (newPass && !/^[A-Za-z0-9!@#$%^&*_.-]{4,32}$/.test(newPass)) {
    return { ok: false, error: 'invalid pass format' };
  }

  const sheet = getSheet_(ACCOUNT_SHEET, ACCOUNT_HEADERS);
  const rows = getRowsAsObjects_(sheet);
  let targetRow = null;
  let targetAccount = null;
  rows.forEach(function(row, index) {
    const rowId = normalizeId_(row['ID']);
    if (rowId.toLowerCase() === currentId.toLowerCase()) {
      targetRow = index + 2;
      targetAccount = row;
    }
  });
  if (!targetRow || String(targetAccount['パスワード'] || '').trim() !== currentPass || !isAccountEnabled_(targetAccount['有効'])) {
    return { ok: false, error: 'account not found' };
  }

  const duplicated = rows.some(function(row) {
    const rowId = normalizeId_(row['ID']);
    return rowId.toLowerCase() === newId.toLowerCase() && rowId.toLowerCase() !== currentId.toLowerCase();
  });
  if (duplicated) {
    return { ok: false, error: 'id already exists' };
  }

  sheet.getRange(targetRow, 1).setValue(newId);
  if (newPass) sheet.getRange(targetRow, 2).setValue(newPass);
  if (displayName) sheet.getRange(targetRow, 3).setValue(displayName);
  sheet.getRange(targetRow, 6).setValue(avatarId);

  return {
    ok: true,
    account: {
      id: newId,
      pass: newPass || currentPass,
      name: displayName || String(targetAccount['表示名'] || '').trim(),
      allowedPrefixes: String(targetAccount['回答可能Prefix'] || '')
        .split(/\s*,\s*|\s*\/\s*|\s+/)
        .map(function(prefix) { return String(prefix || '').trim(); })
        .filter(Boolean),
      enabled: true,
      avatarId: avatarId
    }
  };
}

function getQuestionMaster_() {
  const sheet = getSheet_(QUESTION_SHEET, QUESTION_HEADERS);
  const lastRow = sheet.getLastRow();
  const lastColumn = sheet.getLastColumn();
  if (lastRow < 2) return [];

  const values = sheet.getRange(1, 1, lastRow, lastColumn).getValues();
  const headers = values[0].map(function(header) {
    return String(header || '').trim();
  });

  return values.slice(1).map(function(row, index) {
    return rowToQuestion_(headers, row, index);
  }).filter(function(question) {
    return question && question.question && question.choices.length >= 2;
  });
}

function rowToQuestion_(headers, row, index) {
  function pick(names) {
    for (var i = 0; i < names.length; i++) {
      var col = headers.indexOf(names[i]);
      if (col >= 0 && row[col] !== '') return row[col];
    }
    return '';
  }

  var choices = [
    pick(['選択肢1']),
    pick(['選択肢2']),
    pick(['選択肢3']),
    pick(['選択肢4'])
  ].map(function(choice) {
    return String(choice || '').trim();
  }).filter(Boolean);

  if (choices.length < 2) {
    choices = String(pick(['選択肢', 'choices']) || '')
      .split(/\s*\/\s*|\n|\|/)
      .map(function(choice) {
        return String(choice || '').trim();
      })
      .filter(Boolean);
  }

  var answerNumber = Number(pick(['正解番号', 'answerNumber', 'correctNumber']));
  var correctText = String(pick(['正解テキスト', '正解', 'correctAnswer']) || '').trim();
  if ((!answerNumber || isNaN(answerNumber)) && correctText) {
    var found = choices.indexOf(correctText);
    answerNumber = found >= 0 ? found + 1 : 1;
  }
  if (!answerNumber || isNaN(answerNumber)) answerNumber = 1;

  return {
    id: String(pick(['問題ID', 'questionId', 'id']) || 'sheet-' + (index + 1)).trim(),
    category: String(pick(['カテゴリ', 'category']) || '未分類').trim(),
    level: pick(['難易度', 'level']) || '初級',
    type: pick(['出題形式', 'type']) || 'choice',
    question: String(pick(['問題文', 'question']) || '').trim(),
    code: String(pick(['コード例', 'コード', 'code']) || '').trim(),
    choices: choices.slice(0, 4),
    answerNumber: Math.max(1, Math.min(4, answerNumber)),
    hint: String(pick(['ヒント', 'hint']) || '').trim(),
    explanation: String(pick(['解説', 'explanation']) || '').trim(),
    mode: String(pick(['おすすめモード', 'mode']) || '').trim(),
    tags: String(pick(['タグ', 'tags']) || '').trim()
  };
}

function appendAnswerLog_(data) {
  const sheet = getSheet_(ANSWER_SHEET, [
    '記録日時',
    'ユーザーID',
    'ユーザー名',
    '学習日',
    'モード',
    '問題ID',
    'カテゴリ',
    '難易度',
    '問題文',
    '選択した答え',
    '正解',
    '結果',
    '回答時刻ISO'
  ]);

  sheet.appendRow([
    new Date(),
    data.userId || '',
    data.userName || '',
    data.date || '',
    data.mode || '',
    data.questionId || '',
    data.category || '',
    data.level || '',
    data.question || '',
    data.selectedAnswer || '',
    data.correctAnswer || '',
    data.isCorrect === true ? '正解' : '不正解',
    data.answeredAt || ''
  ]);
}

function upsertQuestionMaster_(data) {
  const sheet = getSheet_(QUESTION_SHEET, QUESTION_HEADERS);

  const questionId = data.questionId || '';
  if (!questionId) return;

  const row = findRowByValue_(sheet, 1, questionId);
  const values = [
    questionId,
    data.category || '',
    data.level || '',
    '4択',
    data.question || '',
    data.code || '',
    Array.isArray(data.choices) ? data.choices[0] || '' : '',
    Array.isArray(data.choices) ? data.choices[1] || '' : '',
    Array.isArray(data.choices) ? data.choices[2] || '' : '',
    Array.isArray(data.choices) ? data.choices[3] || '' : '',
    Number(data.correctIndex) + 1,
    data.correctAnswer || '',
    data.hint || '',
    data.explanation || '',
    data.mode || '',
    data.tags || ''
  ];

  if (row) {
    sheet.getRange(row, 1, 1, values.length).setValues([values]);
  } else {
    sheet.appendRow(values);
  }
}

function getUserProgress_(userId) {
  if (!userId) {
    return {
      total: 0,
      correct: 0,
      byQuestion: {},
      wrongBank: {},
      streak: 0,
      lastStudyDate: ''
    };
  }

  const answerSheet = getSheet_(ANSWER_SHEET, [
    '記録日時',
    'ユーザーID',
    'ユーザー名',
    '学習日',
    'モード',
    '問題ID',
    'カテゴリ',
    '難易度',
    '問題文',
    '選択した答え',
    '正解',
    '結果',
    '回答時刻ISO'
  ]);
  const questionMap = getQuestionMap_();
  const rows = getRowsAsObjects_(answerSheet);
  const byQuestion = {};
  const wrongBank = {};
  const studiedDates = {};
  let total = 0;
  let correct = 0;
  let lastStudyDate = '';

  rows.forEach(function(row) {
    if (normalizeId_(row['ユーザーID']) !== normalizeId_(userId)) return;

    const questionId = String(row['問題ID'] || '').trim();
    const isCorrect = String(row['結果'] || '') === '正解';
    const date = String(row['学習日'] || '').trim();

    total += 1;
    if (isCorrect) correct += 1;
    if (date) {
      studiedDates[date] = true;
      if (!lastStudyDate || date > lastStudyDate) lastStudyDate = date;
    }

    if (!byQuestion[questionId]) {
      byQuestion[questionId] = { correct: 0, wrong: 0 };
    }
    if (isCorrect) {
      byQuestion[questionId].correct += 1;
      delete wrongBank[questionId];
    } else {
      byQuestion[questionId].wrong += 1;
      wrongBank[questionId] = buildReviewQuestion_(row, questionMap[questionId]);
    }
  });

  Object.keys(wrongBank).forEach(function(questionId) {
    const record = byQuestion[questionId] || { correct: 0, wrong: 0 };
    if (record.correct > record.wrong) delete wrongBank[questionId];
  });

  return {
    total: total,
    correct: correct,
    byQuestion: byQuestion,
    wrongBank: wrongBank,
    streak: calculateStreak_(Object.keys(studiedDates)),
    lastStudyDate: lastStudyDate
  };
}

function getUserAnswerHistory_(userId, limit) {
  if (!userId) return [];

  const answerSheet = getSheet_(ANSWER_SHEET, [
    '記録日時',
    'ユーザーID',
    'ユーザー名',
    '学習日',
    'モード',
    '問題ID',
    'カテゴリ',
    '難易度',
    '問題文',
    '選択した答え',
    '正解',
    '結果',
    '回答時刻ISO'
  ]);
  const rows = getRowsAsObjects_(answerSheet);
  const max = Math.max(1, Math.min(300, limit || 100));

  return rows.filter(function(row) {
    return normalizeId_(row['ユーザーID']) === normalizeId_(userId);
  }).reverse().slice(0, max).map(function(row) {
    return {
      recordedAt: toIsoString_(row['記録日時']),
      userId: String(row['ユーザーID'] || ''),
      userName: String(row['ユーザー名'] || ''),
      date: String(row['学習日'] || ''),
      mode: String(row['モード'] || ''),
      questionId: String(row['問題ID'] || ''),
      category: String(row['カテゴリ'] || ''),
      level: String(row['難易度'] || ''),
      question: String(row['問題文'] || ''),
      selectedAnswer: String(row['選択した答え'] || ''),
      correctAnswer: String(row['正解'] || ''),
      result: String(row['結果'] || ''),
      answeredAt: String(row['回答時刻ISO'] || '')
    };
  });
}

function getUserProfileMap_() {
  const map = {};
  const accountSheet = getSheet_(ACCOUNT_SHEET, ACCOUNT_HEADERS);
  getRowsAsObjects_(accountSheet).forEach(function(row) {
    const userId = normalizeId_(row['ID']);
    if (!userId) return;
    map[userId] = {
      userId: userId,
      displayName: String(row['表示名'] || '').trim(),
      avatarId: sanitizeAvatarId_(row['アイコンID']),
      updatedAt: ''
    };
  });

  return map;
}

function getUserProfile_(userId) {
  if (!userId) return { userId: '', displayName: '', avatarId: 'avatar-1' };
  const profile = getUserProfileMap_()[normalizeId_(userId)];
  return profile || { userId: String(userId), displayName: '', avatarId: 'avatar-1' };
}

function updateAccountProfile_(data) {
  const userId = normalizeId_(data.userId);
  if (!userId) return;
  const sheet = getSheet_(ACCOUNT_SHEET, ACCOUNT_HEADERS);
  const row = findRowByValue_(sheet, 1, userId);
  if (!row) return;
  const displayName = String(data.displayName || '').trim().slice(0, 24);
  if (displayName) sheet.getRange(row, 3).setValue(displayName);
  sheet.getRange(row, 6).setValue(sanitizeAvatarId_(data.avatarId));
}

function getUserRanking_(limit, prefix) {
  const targetPrefix = normalizeQuestionPrefix_(prefix);
  const answerSheet = getSheet_(ANSWER_SHEET, [
    '記録日時',
    'ユーザーID',
    'ユーザー名',
    '学習日',
    'モード',
    '問題ID',
    'カテゴリ',
    '難易度',
    '問題文',
    '選択した答え',
    '正解',
    '結果',
    '回答時刻ISO'
  ]);
  const rows = getRowsAsObjects_(answerSheet);
  const profileMap = getUserProfileMap_();
  const today = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
  const weekStartDate = new Date();
  weekStartDate.setDate(weekStartDate.getDate() - 6);
  const weekStart = Utilities.formatDate(weekStartDate, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  const monthKey = today.slice(0, 7);
  const map = {};
  rows.forEach(function(row) {
    const questionId = String(row['問題ID'] || '').trim();
    if (!questionId.startsWith(targetPrefix)) return;

    const userId = normalizeId_(row['ユーザーID']);
    if (!userId) return;
    if (!isRankingUserAllowedForPrefix_(userId, targetPrefix)) return;
    const profile = profileMap[userId] || {};
    const studyDate = normalizeStudyDate_(row['学習日'], row['回答時刻ISO'], row['記録日時']);
    const isCorrect = String(row['結果'] || '') === '正解';
    if (!map[userId]) {
      map[userId] = {
        userId: userId,
        userName: profile.displayName || String(row['ユーザー名'] || '') || userId,
        avatarId: sanitizeAvatarId_(profile.avatarId),
        total: 0,
        correct: 0,
        todayTotal: 0,
        todayCorrect: 0,
        weekTotal: 0,
        weekCorrect: 0,
        monthTotal: 0,
        monthCorrect: 0,
        latestQuestionId: '',
        latestCategory: '',
        latestAnsweredAt: ''
      };
    }
    map[userId].total += 1;
    if (isCorrect) map[userId].correct += 1;
    if (studyDate === today) {
      map[userId].todayTotal += 1;
      if (isCorrect) map[userId].todayCorrect += 1;
    }
    if (studyDate && studyDate >= weekStart && studyDate <= today) {
      map[userId].weekTotal += 1;
      if (isCorrect) map[userId].weekCorrect += 1;
    }
    if (studyDate && studyDate.slice(0, 7) === monthKey) {
      map[userId].monthTotal += 1;
      if (isCorrect) map[userId].monthCorrect += 1;
    }
    map[userId].latestQuestionId = questionId;
    map[userId].latestCategory = String(row['カテゴリ'] || '');
    map[userId].latestAnsweredAt = String(row['回答時刻ISO'] || row['記録日時'] || '');
  });

  return Object.keys(map).map(function(userId) {
    const item = map[userId];
    item.accuracy = item.total ? Math.round((item.correct / item.total) * 100) : 0;
    item.todayAccuracy = item.todayTotal ? Math.round((item.todayCorrect / item.todayTotal) * 100) : null;
    item.weekAccuracy = item.weekTotal ? Math.round((item.weekCorrect / item.weekTotal) * 100) : null;
    item.monthAccuracy = item.monthTotal ? Math.round((item.monthCorrect / item.monthTotal) * 100) : null;
    return item;
  }).sort(function(a, b) {
    const bScore = b.todayAccuracy !== null ? b.todayAccuracy : -1;
    const aScore = a.todayAccuracy !== null ? a.todayAccuracy : -1;
    if (bScore !== aScore) return bScore - aScore;
    if (b.todayTotal !== a.todayTotal) return b.todayTotal - a.todayTotal;
    if (b.weekAccuracy !== a.weekAccuracy) return (b.weekAccuracy || -1) - (a.weekAccuracy || -1);
    return b.monthTotal - a.monthTotal;
  }).slice(0, Math.max(1, Math.min(100, limit || 30)));
}

function normalizeQuestionPrefix_(prefix) {
  const safePrefix = String(prefix || 'FSQ').trim().toUpperCase();
  return safePrefix === 'FPQ' ? 'FPQ' : 'FSQ';
}

function isRankingUserAllowedForPrefix_(userId, prefix) {
  const id = normalizeId_(userId);
  if (prefix === 'FPQ') return /^Puser\d{2}$/.test(id);
  if (prefix === 'FSQ') return /^user\d{2}$/.test(id);
  return false;
}

function isUserAllowedForQuestion_(userId, questionId) {
  const id = normalizeId_(userId);
  const qid = String(questionId || '').trim();
  if (qid.startsWith('FPQ')) return /^Puser\d{2}$/.test(id);
  if (qid.startsWith('FSQ')) return /^user\d{2}$/.test(id);
  return true;
}

function normalizeStudyDate_(studyDate, answeredAt, recordedAt) {
  const direct = String(studyDate || '').trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(direct)) return direct;

  const source = answeredAt || recordedAt;
  if (Object.prototype.toString.call(source) === '[object Date]' && !isNaN(source.getTime())) {
    return Utilities.formatDate(source, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  }

  const parsed = new Date(String(source || ''));
  if (!isNaN(parsed.getTime())) {
    return Utilities.formatDate(parsed, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  }
  return '';
}

function toIsoString_(value) {
  if (Object.prototype.toString.call(value) === '[object Date]' && !isNaN(value.getTime())) {
    return value.toISOString();
  }
  return String(value || '');
}

function getQuestionMap_() {
  const map = {};
  getQuestionMaster_().forEach(function(question) {
    map[question.id] = question;
  });
  return map;
}

function buildReviewQuestion_(logRow, master) {
  if (master) {
    const correctIndex = Math.max(0, Number(master.answerNumber || 1) - 1);
    const correctChoice = master.choices[correctIndex] || String(logRow['正解'] || '');
    const choices = [correctChoice].concat(master.choices.filter(function(choice) {
      return choice !== correctChoice;
    })).slice(0, 4);

    return {
      id: master.id,
      category: master.category,
      level: master.level,
      type: master.type || 'choice',
      question: master.question,
      code: master.code || '',
      choices: choices,
      answer: 0,
      hint: master.hint || '',
      explanation: master.explanation || ''
    };
  }

  return {
    id: String(logRow['問題ID'] || ''),
    category: String(logRow['カテゴリ'] || '未分類'),
    level: String(logRow['難易度'] || '初級'),
    type: 'choice',
    question: String(logRow['問題文'] || ''),
    code: '',
    choices: [
      String(logRow['正解'] || '正解'),
      String(logRow['選択した答え'] || '選択した答え'),
      'もう一度確認する',
      '解説を読む'
    ],
    answer: 0,
    hint: 'Spreadsheetの回答ログから復習BOXへ戻した問題です。',
    explanation: '前回不正解だった問題です。正解と解説を確認してから、もう一度解き直しましょう。'
  };
}

function calculateStreak_(dates) {
  if (!dates.length) return 0;
  const dateSet = {};
  dates.forEach(function(date) {
    dateSet[date] = true;
  });

  let cursor = new Date();
  let streak = 0;
  while (true) {
    const key = Utilities.formatDate(cursor, Session.getScriptTimeZone(), 'yyyy-MM-dd');
    if (!dateSet[key]) break;
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

function getDiagnostics_(userId) {
  const answerSheet = getSheet_(ANSWER_SHEET, [
    '記録日時',
    'ユーザーID',
    'ユーザー名',
    '学習日',
    'モード',
    '問題ID',
    'カテゴリ',
    '難易度',
    '問題文',
    '選択した答え',
    '正解',
    '結果',
    '回答時刻ISO'
  ]);
  const targetUserId = normalizeId_(userId);
  const rows = getRowsAsObjects_(answerSheet);
  const userCounts = {};
  let matchedRows = 0;
  let latestAnsweredAt = '';

  rows.forEach(function(row) {
    const rowUserId = normalizeId_(row['ユーザーID']);
    if (!rowUserId) return;
    userCounts[rowUserId] = (userCounts[rowUserId] || 0) + 1;
    if (rowUserId === targetUserId) {
      matchedRows += 1;
      const answeredAt = String(row['回答時刻ISO'] || row['記録日時'] || '');
      if (answeredAt) latestAnsweredAt = answeredAt;
    }
  });

  return {
    answerRows: rows.length,
    userId: targetUserId,
    matchedRows: matchedRows,
    latestAnsweredAt: latestAnsweredAt,
    userCounts: userCounts
  };
}

function getRowsAsObjects_(sheet) {
  const lastRow = sheet.getLastRow();
  const lastColumn = sheet.getLastColumn();
  if (lastRow < 2) return [];

  const values = sheet.getRange(1, 1, lastRow, lastColumn).getValues();
  const headers = values[0].map(function(header) {
    return String(header || '').trim();
  });

  return values.slice(1).map(function(row) {
    const item = {};
    headers.forEach(function(header, index) {
      item[header] = row[index];
    });
    return item;
  });
}

function getSheet_(name, headers) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
  }

  if (sheet.getLastRow() === 0) {
    sheet.appendRow(headers);
  } else {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  }

  return sheet;
}

function findRowByValue_(sheet, column, value) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return null;

  const values = sheet.getRange(2, column, lastRow - 1, 1).getValues();
  const target = normalizeId_(value);
  for (let i = 0; i < values.length; i++) {
    if (normalizeId_(values[i][0]) === target) {
      return i + 2;
    }
  }
  return null;
}
