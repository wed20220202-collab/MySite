// Google Apps Scriptにそのまま貼り付けて使うコードです。
// 1. Googleスプレッドシートを作成
// 2. 拡張機能 > Apps Script
// 3. このコードを貼り付け
// 4. デプロイ > 新しいデプロイ > ウェブアプリ
// 5. 実行ユーザー: 自分 / アクセスできるユーザー: 全員
// 6. 発行されたURLを app.js の SPREADSHEET_WEB_APP_URL に貼り付け

const ANSWER_SHEET = '回答ログ';
const QUESTION_SHEET = '問題マスタ';
const SUMMARY_SHEET = '学習サマリ';
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

  return jsonOutput_({ ok: false, error: 'unknown action' });
}

function doPost(e) {
  const data = JSON.parse(e.postData.contents || '{}');

  appendAnswerLog_(data);
  upsertQuestionMaster_(data);
  upsertLearningSummary_(data);

  return ContentService
    .createTextOutput(JSON.stringify({ ok: true }))
    .setMimeType(ContentService.MimeType.JSON);
}

function jsonOutput_(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
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

function upsertLearningSummary_(data) {
  const sheet = getSheet_(SUMMARY_SHEET, [
    'キー',
    'ユーザーID',
    'ユーザー名',
    '最終学習日',
    '最終回答日時',
    '累計回答数',
    '累計正解数',
    '正答率',
    '連続学習日数',
    '直近モード',
    '直近カテゴリ',
    '直近問題ID',
    '直近結果'
  ]);

  const userId = data.userId || '';
  if (!userId) return;

  const row = findRowByValue_(sheet, 1, userId);
  const values = [
    userId,
    userId,
    data.userName || '',
    data.date || '',
    data.answeredAt || '',
    data.totalAnswered || 0,
    data.totalCorrect || 0,
    `${data.accuracy || 0}%`,
    data.streak || 0,
    data.mode || '',
    data.category || '',
    data.questionId || '',
    data.isCorrect === true ? '正解' : '不正解'
  ];

  if (row) {
    sheet.getRange(row, 1, 1, values.length).setValues([values]);
  } else {
    sheet.appendRow(values);
  }
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
  const target = String(value);
  for (let i = 0; i < values.length; i++) {
    if (String(values[i][0]) === target) {
      return i + 2;
    }
  }
  return null;
}
