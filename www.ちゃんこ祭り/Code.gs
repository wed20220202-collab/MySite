const SPREADSHEET_ID = '1AIHMmcZEfCh7QvNza8HlxHSjAjhj8sPPyQgUbTGvAGU';
const SHEET_GID = 0;
const HEADERS = [
  '受付日時',
  '味',
  '量',
  '価格',
  'おいしかったところ',
  'また来年も食べたい',
  '知ったきっかけ',
  '意見・来年食べたい味や具材',
  '年代'
];

function doGet() {
  return ContentService
    .createTextOutput('千駄木ちゃんこ祭りアンケート回答受付中')
    .setMimeType(ContentService.MimeType.TEXT);
}

function setup() {
  const sheet = getResponseSheet_();
  ensureHeaders_(sheet);
}

function doPost(e) {
  try {
    if (!e || !e.parameter || e.parameter.website) {
      return response_('ok');
    }

    const required = ['taste', 'portion', 'price', 'returnIntent', 'discovery'];
    if (required.some((key) => !clean_(e.parameter[key], 80))) {
      return response_('invalid');
    }

    const lock = LockService.getScriptLock();
    lock.waitLock(10000);
    try {
      const sheet = getResponseSheet_();
      ensureHeaders_(sheet);

      const favorites = (e.parameters.favoriteParts || [])
        .map((value) => clean_(value, 80))
        .filter(Boolean);
      const other = clean_(e.parameter.favoriteOther, 80);
      if (other) favorites.push(`その他：${other}`);

      sheet.appendRow([
        new Date(),
        clean_(e.parameter.taste, 80),
        clean_(e.parameter.portion, 80),
        clean_(e.parameter.price, 80),
        favorites.join('、'),
        clean_(e.parameter.returnIntent, 80),
        clean_(e.parameter.discovery, 80),
        clean_(e.parameter.comments, 500),
        clean_(e.parameter.ageGroup, 80)
      ]);
    } finally {
      lock.releaseLock();
    }

    return response_('ok');
  } catch (error) {
    console.error(error);
    return response_('error');
  }
}

function getResponseSheet_() {
  const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = spreadsheet.getSheets().find((item) => item.getSheetId() === SHEET_GID);
  if (!sheet) throw new Error('回答先シートが見つかりません。');
  return sheet;
}

function ensureHeaders_(sheet) {
  const existing = sheet.getRange(1, 1, 1, HEADERS.length).getDisplayValues()[0];
  if (existing.every((value) => value === '')) {
    const range = sheet.getRange(1, 1, 1, HEADERS.length);
    range.setValues([HEADERS]);
    range.setFontWeight('bold');
    range.setBackground('#8f1f28');
    range.setFontColor('#ffffff');
    range.setHorizontalAlignment('center');
    range.setWrap(true);
    sheet.setFrozenRows(1);
    sheet.setColumnWidth(1, 160);
    sheet.setColumnWidths(2, 8, 150);
    sheet.setColumnWidth(8, 300);
    sheet.getRange('A:A').setNumberFormat('yyyy/MM/dd HH:mm:ss');
  }
}

function clean_(value, maxLength) {
  return String(value || '')
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .trim()
    .slice(0, maxLength);
}

function response_(status) {
  return ContentService
    .createTextOutput(status)
    .setMimeType(ContentService.MimeType.TEXT);
}
