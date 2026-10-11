const SPREADSHEET_ID = '1AIHMmcZEfCh7QvNza8HlxHSjAjhj8sPPyQgUbTGvAGU';
const SHEET_GID = 0;
const ADMIN_ID = 'admin';
const ADMIN_SESSION_SECONDS = 21600;
const COUPON_SHEET_NAME = 'クーポンDB';
const COUPON_REDEEM_URL = 'https://wed20220202-collab.github.io/MySite/www.%E3%81%A1%E3%82%83%E3%82%93%E3%81%93%E7%A5%AD%E3%82%8A/coupon-redeem.html';
const COUPON_HEADERS = [
  'クーポンID',
  'トークンハッシュ',
  '割引額（円）',
  '状態',
  '発行日時',
  '有効期限',
  '利用日時',
  '利用店舗',
  '発行者',
  '備考'
];
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
  const page = e && e.parameter ? String(e.parameter.page || '') : '';
  const pages = {
    dashboard: ['Dashboard', '千駄木ちゃんこ祭り 回答状況'],
    coupon_issue: ['CouponIssue', '千駄木ちゃんこ祭り クーポン発行'],
    coupon_redeem: ['CouponRedeem', '千駄木ちゃんこ祭り クーポン確認']
  };
  if (pages[page]) {
    return HtmlService
      .createTemplateFromFile(pages[page][0])
      .evaluate()
      .setTitle(pages[page][1])
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

function setupCouponSystem() {
  const sheet = getCouponSheet_();
  ensureCouponHeaders_(sheet);
  return { ok: true, sheetName: sheet.getName(), columns: COUPON_HEADERS.length };
}

function issueCoupon(sessionToken, request) {
  requireAdmin_(sessionToken);
  const amount = Number(request && request.amount);
  if (!Number.isInteger(amount) || amount < 1 || amount > 5000) {
    throw new Error('割引額は1円から5,000円の整数で指定してください。');
  }

  const expiryText = clean_(request && request.expiresOn, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(expiryText)) {
    throw new Error('有効期限を指定してください。');
  }
  const expiresAt = new Date(expiryText + 'T23:59:59+09:00');
  if (isNaN(expiresAt.getTime()) || expiresAt.getTime() < Date.now()) {
    throw new Error('有効期限は本日以降にしてください。');
  }

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const sheet = getCouponSheet_();
    ensureCouponHeaders_(sheet);
    const rawToken = (Utilities.getUuid() + Utilities.getUuid()).replace(/-/g, '');
    const issuedAt = new Date();
    const couponId = 'SNDG-' + Utilities.formatDate(issuedAt, 'Asia/Tokyo', 'yyyyMMdd') + '-' + rawToken.slice(0, 8).toUpperCase();
    sheet.appendRow([
      couponId,
      sha256_(rawToken),
      amount,
      '未使用',
      issuedAt,
      expiresAt,
      '',
      '',
      ADMIN_ID,
      clean_(request && request.note, 200)
    ]);
    CacheService.getScriptCache().put('admin:' + sessionToken, '1', ADMIN_SESSION_SECONDS);
    return {
      ok: true,
      couponId: couponId,
      amount: amount,
      expiresOn: expiryText.replace(/-/g, '/'),
      token: rawToken,
      redeemUrl: COUPON_REDEEM_URL + '?c=' + encodeURIComponent(rawToken)
    };
  } finally {
    lock.releaseLock();
  }
}

function lookupCoupon(rawToken) {
  const token = normalizeCouponToken_(rawToken);
  if (!token) return { ok: false, status: 'INVALID', message: 'クーポンを読み取れませんでした。' };

  const record = findCouponByHash_(sha256_(token));
  if (!record) return { ok: false, status: 'NOT_FOUND', message: '登録されていないクーポンです。' };
  return couponPublicResult_(record);
}

function redeemCoupon(sessionToken, rawToken, storeName) {
  requireAdmin_(sessionToken);
  const token = normalizeCouponToken_(rawToken);
  if (!token) return { ok: false, status: 'INVALID', message: 'クーポンを読み取れませんでした。' };

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const record = findCouponByHash_(sha256_(token));
    if (!record) return { ok: false, status: 'NOT_FOUND', message: '登録されていないクーポンです。' };
    const current = couponPublicResult_(record);
    if (!current.ok) return current;

    const redeemedAt = new Date();
    record.sheet.getRange(record.row, 4, 1, 5).setValues([[
      '使用済み',
      record.values[4],
      record.values[5],
      redeemedAt,
      clean_(storeName, 80) || '店舗名未入力'
    ]]);
    SpreadsheetApp.flush();
    CacheService.getScriptCache().put('admin:' + sessionToken, '1', ADMIN_SESSION_SECONDS);
    return {
      ok: true,
      status: 'USED',
      message: current.amount + '円引きを適用しました。',
      couponId: current.couponId,
      amount: current.amount,
      redeemedAt: formatDate_(redeemedAt, 'Asia/Tokyo')
    };
  } finally {
    lock.releaseLock();
  }
}

function couponPublicResult_(record) {
  const values = record.values;
  const status = String(values[3] || '');
  const expiresAt = values[5] instanceof Date ? values[5] : new Date(values[5]);
  const base = {
    couponId: String(values[0] || ''),
    amount: Number(values[2] || 0),
    expiresAt: formatDate_(expiresAt, 'Asia/Tokyo')
  };
  if (status === '使用済み') {
    return Object.assign(base, {
      ok: false,
      status: 'USED',
      message: 'このクーポンは使用済みです。',
      redeemedAt: formatDate_(values[6], 'Asia/Tokyo'),
      storeName: String(values[7] || '')
    });
  }
  if (!isNaN(expiresAt.getTime()) && expiresAt.getTime() < Date.now()) {
    return Object.assign(base, { ok: false, status: 'EXPIRED', message: 'このクーポンは有効期限切れです。' });
  }
  if (status !== '未使用') {
    return Object.assign(base, { ok: false, status: 'INVALID', message: 'このクーポンは現在利用できません。' });
  }
  return Object.assign(base, { ok: true, status: 'AVAILABLE', message: base.amount + '円引きクーポンです。' });
}

function normalizeCouponToken_(value) {
  const text = clean_(value, 500);
  if (!text) return '';
  const match = text.match(/[?&]c=([A-Za-z0-9_-]+)/);
  const token = match ? match[1] : text;
  return /^[a-f0-9]{64}$/i.test(token) ? token : '';
}

function findCouponByHash_(tokenHash) {
  const sheet = getCouponSheet_();
  ensureCouponHeaders_(sheet);
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return null;
  const match = sheet.getRange(2, 2, lastRow - 1, 1)
    .createTextFinder(tokenHash)
    .matchEntireCell(true)
    .findNext();
  if (!match) return null;
  const row = match.getRow();
  return { sheet: sheet, row: row, values: sheet.getRange(row, 1, 1, COUPON_HEADERS.length).getValues()[0] };
}

function getCouponSheet_() {
  const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
  return spreadsheet.getSheetByName(COUPON_SHEET_NAME) || spreadsheet.insertSheet(COUPON_SHEET_NAME);
}

function ensureCouponHeaders_(sheet) {
  const existing = sheet.getRange(1, 1, 1, COUPON_HEADERS.length).getDisplayValues()[0];
  if (existing.some((value, index) => value !== COUPON_HEADERS[index])) {
    const range = sheet.getRange(1, 1, 1, COUPON_HEADERS.length);
    range.setValues([COUPON_HEADERS]);
    range.setFontWeight('bold').setBackground('#4a1118').setFontColor('#ffffff');
    range.setHorizontalAlignment('center').setWrap(true);
    sheet.setFrozenRows(1);
    sheet.setColumnWidths(1, COUPON_HEADERS.length, 150);
    sheet.setColumnWidth(2, 340);
    sheet.setColumnWidth(10, 260);
    sheet.getRange('C:C').setNumberFormat('#,##0');
    sheet.getRange('E:G').setNumberFormat('yyyy/MM/dd HH:mm:ss');
  }
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
