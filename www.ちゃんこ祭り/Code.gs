const SPREADSHEET_ID = '1AIHMmcZEfCh7QvNza8HlxHSjAjhj8sPPyQgUbTGvAGU';
const SHEET_GID = 0;
const ADMIN_ID = 'admin';
const ADMIN_SESSION_SECONDS = 21600;
const HEADERS = [
  '受付日時',
  '味',
  '量',
  '価格',
  '味付けの濃さ',
  'また来年も食べたい',
  '知ったきっかけ',
  '意見・来年食べたい味や具材',
  '年代'
];

function doGet(e) {
  if (e && e.parameter && e.parameter.page === 'dashboard') {
    return HtmlService
      .createTemplateFromFile('Dashboard')
      .evaluate()
      .setTitle('千駄木ちゃんこ祭り 回答状況')
      .addMetaTag('viewport', 'width=device-width, initial-scale=1')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  }

  return ContentService
    .createTextOutput('千駄木ちゃんこ祭りアンケート回答受付中')
    .setMimeType(ContentService.MimeType.TEXT);
}

function adminLogin(id, password) {
  const configuredHash = PropertiesService.getScriptProperties().getProperty('ADMIN_PASSWORD_SHA256') || '';
  const validId = safeEqual_(String(id || ''), ADMIN_ID);
  const validPassword = configuredHash && safeEqual_(sha256_(String(password || '')), configuredHash);
  if (!validId || !validPassword) {
    return { ok: false, message: 'IDまたはパスワードが違います。' };
  }

  const token = (Utilities.getUuid() + Utilities.getUuid()).replace(/-/g, '');
  CacheService.getScriptCache().put('admin:' + token, '1', ADMIN_SESSION_SECONDS);
  return { ok: true, token: token };
}

function getDashboardData(token) {
  requireAdmin_(token);
  CacheService.getScriptCache().put('admin:' + token, '1', ADMIN_SESSION_SECONDS);

  const sheet = getResponseSheet_();
  ensureHeaders_(sheet);
  const values = sheet.getDataRange().getValues();
  const rows = values.slice(1).filter((row) => row[0]);
  const timeZone = Session.getScriptTimeZone() || 'Asia/Tokyo';
  const todayKey = Utilities.formatDate(new Date(), timeZone, 'yyyy-MM-dd');
  const todayCount = rows.filter((row) => {
    const date = row[0] instanceof Date ? row[0] : new Date(row[0]);
    return !isNaN(date.getTime()) && Utilities.formatDate(date, timeZone, 'yyyy-MM-dd') === todayKey;
  }).length;
  const lastDate = rows.length ? rows[rows.length - 1][0] : null;

  const questions = [
    distribution_('味', rows, 1, ['とてもおいしい', 'おいしい', 'ふつう', 'あまり好みではない', '好みではない']),
    distribution_('量', rows, 2, ['多い', 'ちょうどよい', '少ない']),
    distribution_('価格', rows, 3, ['安い', 'ちょうどよい', '高い']),
    distribution_('味付けの濃さ', rows, 4, ['濃い', 'ちょうどよい', '薄い']),
    distribution_('また来年も食べたい', rows, 5, ['ぜひ食べたい', 'できれば食べたい', 'どちらともいえない', 'あまり思わない']),
    distribution_('知ったきっかけ', rows, 6, ['チラシ・ポスター', '家族・知人', '商店街', 'Web・SNS', '通りかかって', 'その他']),
    distribution_('年代', rows, 8, ['10代以下', '20代', '30代', '40代', '50代', '60代', '70代以上'], true)
  ];

  const recentComments = rows
    .filter((row) => String(row[7] || '').trim())
    .slice(-10)
    .reverse()
    .map((row) => ({
      date: formatDate_(row[0], timeZone),
      comment: String(row[7] || '').trim()
    }));

  return {
    total: rows.length,
    today: todayCount,
    updatedAt: formatDate_(lastDate, timeZone),
    fetchedAt: Utilities.formatDate(new Date(), timeZone, 'yyyy/MM/dd HH:mm:ss'),
    questions: questions,
    recentComments: recentComments
  };
}

function adminLogout(token) {
  if (token) CacheService.getScriptCache().remove('admin:' + token);
  return true;
}

function distribution_(title, rows, columnIndex, labels, includeBlank) {
  const counts = {};
  labels.forEach((label) => counts[label] = 0);
  let blankCount = 0;
  let otherCount = 0;

  rows.forEach((row) => {
    const value = String(row[columnIndex] || '').trim();
    if (!value) {
      blankCount += 1;
    } else if (Object.prototype.hasOwnProperty.call(counts, value)) {
      counts[value] += 1;
    } else {
      otherCount += 1;
    }
  });

  const items = labels.map((label) => ({ label: label, count: counts[label] }));
  if (otherCount) items.push({ label: 'その他・過去回答', count: otherCount });
  if (includeBlank && blankCount) items.push({ label: '未回答', count: blankCount });
  const answered = items.reduce((sum, item) => sum + item.count, 0);
  items.forEach((item) => item.percent = answered ? Math.round(item.count / answered * 1000) / 10 : 0);
  return { title: title, answered: answered, items: items };
}

function requireAdmin_(token) {
  if (!token || CacheService.getScriptCache().get('admin:' + token) !== '1') {
    throw new Error('SESSION_EXPIRED');
  }
}

function sha256_(value) {
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, value, Utilities.Charset.UTF_8)
    .map((byte) => ('0' + ((byte + 256) % 256).toString(16)).slice(-2))
    .join('');
}

function safeEqual_(left, right) {
  if (left.length !== right.length) return false;
  let different = 0;
  for (let index = 0; index < left.length; index += 1) {
    different |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return different === 0;
}

function formatDate_(value, timeZone) {
  if (!value) return 'まだ回答はありません';
  const date = value instanceof Date ? value : new Date(value);
  if (isNaN(date.getTime())) return String(value);
  return Utilities.formatDate(date, timeZone, 'yyyy/MM/dd HH:mm:ss');
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

    const required = ['taste', 'portion', 'price', 'seasoning', 'returnIntent', 'discovery'];
    if (required.some((key) => !clean_(e.parameter[key], 80))) {
      return response_('invalid');
    }

    const lock = LockService.getScriptLock();
    lock.waitLock(10000);
    try {
      const sheet = getResponseSheet_();
      ensureHeaders_(sheet);

      sheet.appendRow([
        new Date(),
        clean_(e.parameter.taste, 80),
        clean_(e.parameter.portion, 80),
        clean_(e.parameter.price, 80),
        clean_(e.parameter.seasoning, 80),
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
  if (existing.some((value, index) => value !== HEADERS[index])) {
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
