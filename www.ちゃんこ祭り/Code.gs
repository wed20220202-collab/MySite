const SPREADSHEET_ID = '1AIHMmcZEfCh7QvNza8HlxHSjAjhj8sPPyQgUbTGvAGU';
const SHEET_GID = 0;
const ADMIN_ID = 'admin';
const ADMIN_SESSION_SECONDS = 21600;
const MANAGER_ID = 'manager';
const MANAGER_SESSION_SECONDS = 21600;
const MANAGER_LOGIN_RATE_KEY = 'manager-login-failures';
const MANAGER_LOGIN_WINDOW_MS = 60000;
const MANAGER_LOGIN_COOLDOWN_MS = 30000;
const MANAGER_LOGIN_MAX_FAILURES = 8;
const MERCHANT_SESSION_SECONDS = 21600;
const MERCHANT_PASSWORD_ROUNDS = 5000;
const MERCHANT_LOGIN_WINDOW_MS = 300000;
const MERCHANT_LOGIN_COOLDOWN_MS = 300000;
const MERCHANT_LOGIN_MAX_FAILURES = 5;
const MERCHANT_GLOBAL_RATE_KEY = 'merchant-login-global-failures';
const MERCHANT_GLOBAL_WINDOW_MS = 60000;
const MERCHANT_GLOBAL_COOLDOWN_MS = 60000;
const MERCHANT_GLOBAL_MAX_FAILURES = 60;
const COUPON_SHEET_NAME = 'クーポンDB';
const STORE_SHEET_NAME = '加盟店';
const COUPON_AUDIT_SHEET_NAME = 'クーポン操作履歴';
const COUPON_WALLET_URL = 'https://wed20220202-collab.github.io/MySite/www.%E3%81%A1%E3%82%83%E3%82%93%E3%81%93%E7%A5%AD%E3%82%8A/coupon.html';
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
const STORE_HEADERS = [
  '店舗ID', '店舗名', '店舗責任者', '住所', '緯度', '経度', '公開', '登録日時', '更新日時',
  'ログインID', 'パスワードソルト', 'パスワードハッシュ', '認証バージョン', '認証更新日時'
];
const COUPON_AUDIT_HEADERS = [
  '操作日時', '操作', '対象件数', '操作アカウント', '結果', '備考',
  '操作ID', 'クーポンID', '割引額（円）', '変更前の状態', '変更後の状態', 'クーポンDB行'
];
const COUPON_AUDIT_PROTECTION_DESCRIPTION = '千駄木ちゃんこ祭り クーポン操作履歴（システム保護）';
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
    management: ['ManagementApp', '千駄木二丁目町会商店街総括管理サイト'],
    stores: ['StoresApp', '千駄木二丁目町会 利用可能店舗'],
    coupon_issue: ['CouponIssue', '千駄木ちゃんこ祭り クーポン発行'],
    coupon_wallet: ['CouponWallet', '千駄木ちゃんこ祭り マイクーポン'],
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

function managerLogin(id, password) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const cache = CacheService.getScriptCache();
    const now = Date.now();
    let rate = {};
    try { rate = JSON.parse(cache.get(MANAGER_LOGIN_RATE_KEY) || '{}'); } catch (error) { rate = {}; }
    if (!rate || typeof rate !== 'object') rate = {};
    if (Number(rate.blockedUntil) > now) {
      return { ok: false, message: 'ログイン試行が集中しています。30秒ほど待ってから再試行してください。' };
    }
    if (Number(rate.blockedUntil) > 0) rate = {};

    const validId = safeEqual_(String(id || ''), MANAGER_ID);
    const properties = PropertiesService.getScriptProperties();
    const enteredPassword = String(password || '');
    const passwordHash = sha256_(enteredPassword);
    const configuredHash = properties.getProperty('MANAGER_PASSWORD_SHA256') || '';
    const temporaryPassword = configuredHash ? '' : (properties.getProperty('MANAGER_PASSWORD_TEMP') || '');
    const validPassword = configuredHash
      ? safeEqual_(passwordHash, configuredHash)
      : !!temporaryPassword && safeEqual_(enteredPassword, temporaryPassword);
    if (validId && validPassword) {
      if (!configuredHash) {
        properties.setProperty('MANAGER_PASSWORD_SHA256', passwordHash);
        properties.deleteProperty('MANAGER_PASSWORD_TEMP');
      }
      cache.remove(MANAGER_LOGIN_RATE_KEY);
      const token = (Utilities.getUuid() + Utilities.getUuid()).replace(/-/g, '');
      cache.put('manager:' + token, '1', MANAGER_SESSION_SECONDS);
      return { ok: true, token: token };
    }

    const previousStart = Number(rate.windowStart) || 0;
    const withinWindow = previousStart > 0 && now - previousStart < MANAGER_LOGIN_WINDOW_MS;
    const failures = (withinWindow ? (Number(rate.failures) || 0) : 0) + 1;
    cache.put(MANAGER_LOGIN_RATE_KEY, JSON.stringify({
      windowStart: withinWindow ? previousStart : now,
      failures: failures,
      blockedUntil: failures >= MANAGER_LOGIN_MAX_FAILURES ? now + MANAGER_LOGIN_COOLDOWN_MS : 0
    }), 90);
    return {
      ok: false,
      message: failures >= MANAGER_LOGIN_MAX_FAILURES
        ? 'ログイン試行が集中しています。30秒ほど待ってから再試行してください。'
        : 'IDまたはパスワードが違います。'
    };
  } finally {
    lock.releaseLock();
  }
}

function managerLogout(token) {
  if (token) CacheService.getScriptCache().remove('manager:' + token);
  return true;
}

function merchantLogin(id, password) {
  let loginId = '';
  try { loginId = merchantLoginId_(id, true); } catch (error) { loginId = ''; }
  const enteredPassword = String(password === null || password === undefined ? '' : password);
  const cache = CacheService.getScriptCache();
  const rateKey = 'merchant-login-rate:' + sha256_(loginId || String(id || '').slice(0, 80).trim().toLowerCase());
  const lockedMessage = 'ログイン試行が多すぎます。5分ほど待ってから再試行してください。';
  const busyMessage = 'ログインが混み合っています。1分ほど待ってから再試行してください。';
  if (merchantRateBlocked_(cache, MERCHANT_GLOBAL_RATE_KEY, Date.now())) return { ok: false, message: busyMessage };
  if (merchantRateBlocked_(cache, rateKey, Date.now())) return { ok: false, message: lockedMessage };

  let candidate = null;
  let attemptedSheet = false;
  if (loginId && enteredPassword.length >= 12 && enteredPassword.length <= 128 && !/[\u0000-\u001F\u007F]/.test(enteredPassword)) {
    attemptedSheet = true;
    const matches = getStoreRows_().filter((row) => String(row[9] || '').trim().toLowerCase() === loginId);
    if (matches.length === 1 && String(matches[0][10] || '') && String(matches[0][11] || '')) {
      const row = matches[0];
      const attemptedHash = merchantPasswordHash_(enteredPassword, String(row[10]), false);
      if (safeEqual_(attemptedHash, String(row[11]))) {
        candidate = { storeId: String(row[0]), hash: String(row[11]), version: merchantCredentialVersion_(row) };
      }
    }
  }

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const now = Date.now();
    if (merchantRateBlocked_(cache, MERCHANT_GLOBAL_RATE_KEY, now)) return { ok: false, message: busyMessage };
    if (merchantRateBlocked_(cache, rateKey, now)) return { ok: false, message: lockedMessage };
    if (candidate) {
      // A manager may reset credentials while the password hash is being calculated.
      const currentRows = getStoreRows_();
      const currentMatches = currentRows.filter((row) => String(row[0] || '') === candidate.storeId);
      const loginMatches = currentRows.filter((row) => String(row[9] || '').trim().toLowerCase() === loginId);
      if (currentMatches.length === 1 && loginMatches.length === 1) {
        const row = currentMatches[0];
        if (String(row[9] || '').trim().toLowerCase() === loginId &&
            safeEqual_(String(row[11] || ''), candidate.hash) &&
            merchantCredentialVersion_(row) === candidate.version) {
          cache.remove(rateKey);
          const token = (Utilities.getUuid() + Utilities.getUuid()).replace(/-/g, '').toLowerCase();
          cache.put('merchant:' + token, JSON.stringify({ storeId: candidate.storeId, version: candidate.version }), MERCHANT_SESSION_SECONDS);
          return { ok: true, token: token, storeId: candidate.storeId, storeName: String(row[1] || ''), loginId: loginId };
        }
      }
    }
    const failures = merchantRecordFailure_(cache, rateKey, now);
    if (attemptedSheet) {
      merchantRecordFailure_(cache, MERCHANT_GLOBAL_RATE_KEY, now,
        MERCHANT_GLOBAL_MAX_FAILURES, MERCHANT_GLOBAL_WINDOW_MS, MERCHANT_GLOBAL_COOLDOWN_MS);
    }
    return {
      ok: false,
      message: failures >= MERCHANT_LOGIN_MAX_FAILURES
        ? lockedMessage
        : 'IDまたはパスワードが違います。'
    };
  } finally {
    lock.releaseLock();
  }
}

function merchantLogout(token) {
  if (/^[a-f0-9]{64}$/.test(String(token || ''))) {
    CacheService.getScriptCache().remove('merchant:' + token);
  }
  return true;
}

function merchantUpdateCredentials(token, currentPassword, newId, newPassword) {
  const nextLoginId = merchantLoginId_(newId, true);
  const nextPassword = String(newPassword === null || newPassword === undefined ? '' : newPassword);
  if (nextPassword) validateMerchantPassword_(nextPassword);
  const enteredPassword = String(currentPassword === null || currentPassword === undefined ? '' : currentPassword);
  if (!enteredPassword) throw new Error('現在のパスワードを入力してください。');
  if (enteredPassword.length > 128) throw new Error('現在のパスワードが違います。');

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const merchant = requireMerchant_(token);
    const cache = CacheService.getScriptCache();
    const rateKey = 'merchant-change-rate:' + merchant.storeId;
    const nowMs = Date.now();
    if (merchantRateBlocked_(cache, rateKey, nowMs)) {
      throw new Error('認証の試行が多すぎます。5分ほど待ってから再試行してください。');
    }
    const sheet = getStoreSheet_();
    ensureStoreHeaders_(sheet);
    const lastRow = sheet.getLastRow();
    const rows = lastRow > 1 ? sheet.getRange(2, 1, lastRow - 1, STORE_HEADERS.length).getValues() : [];
    const indexes = rows.map((row, index) => String(row[0] || '') === merchant.storeId ? index : -1).filter((index) => index >= 0);
    if (indexes.length !== 1) throw new Error('SESSION_EXPIRED');
    const row = rows[indexes[0]];
    const attemptedHash = merchantPasswordHash_(enteredPassword, String(row[10] || ''), false);
    if (!safeEqual_(attemptedHash, String(row[11] || ''))) {
      merchantRecordFailure_(cache, rateKey, nowMs);
      throw new Error('現在のパスワードが違います。');
    }
    if (nextLoginId === merchant.loginId && !nextPassword) {
      throw new Error('変更するログインIDか新しいパスワードを入力してください。');
    }
    ensureMerchantLoginAvailable_(rows, nextLoginId, merchant.storeId);
    const now = new Date();
    const salt = nextPassword ? merchantSalt_() : String(row[10]);
    const hash = nextPassword ? merchantPasswordHash_(nextPassword, salt, false) : String(row[11]);
    sheet.getRange(indexes[0] + 2, 10, 1, 5).setValues([[
      nextLoginId, salt, hash, merchantCredentialVersion_(row) + 1, now
    ]]);
    SpreadsheetApp.flush();
    cache.remove(rateKey);
    cache.remove('merchant:' + token);
    return { ok: true, storeId: merchant.storeId, storeName: String(row[1] || ''), loginId: nextLoginId };
  } finally {
    lock.releaseLock();
  }
}

function merchantRateBlocked_(cache, key, now) {
  let rate = {};
  try { rate = JSON.parse(cache.get(key) || '{}'); } catch (error) { rate = {}; }
  return !!rate && Number(rate.blockedUntil) > now;
}

function merchantRecordFailure_(cache, key, now, limit, windowMs, cooldownMs) {
  let rate = {};
  try { rate = JSON.parse(cache.get(key) || '{}'); } catch (error) { rate = {}; }
  const maxFailures = limit || MERCHANT_LOGIN_MAX_FAILURES;
  const windowDuration = windowMs || MERCHANT_LOGIN_WINDOW_MS;
  const cooldownDuration = cooldownMs || MERCHANT_LOGIN_COOLDOWN_MS;
  const windowStart = Number(rate.windowStart) || 0;
  const withinWindow = windowStart > 0 && now - windowStart < windowDuration;
  const failures = (withinWindow ? Number(rate.failures) || 0 : 0) + 1;
  cache.put(key, JSON.stringify({
    windowStart: withinWindow ? windowStart : now,
    failures: failures,
    blockedUntil: failures >= maxFailures ? now + cooldownDuration : 0
  }), 600);
  return failures;
}

function getManagementData(token, page) {
  requireManager_(token);
  const sheet = getCouponSheet_();
  ensureCouponHeaders_(sheet);
  const lastRow = sheet.getLastRow();
  const rows = lastRow > 1 ? sheet.getRange(2, 1, lastRow - 1, COUPON_HEADERS.length).getValues() : [];
  const now = Date.now();
  const stats = { active: 0, used: 0, invalid: 0, expired: 0, issued: 0 };
  const activeCoupons = [];
  const activeParts = [];

  rows.forEach((row, index) => {
    if (!String(row[0] || '').trim()) return;
    stats.issued += 1;
    const status = String(row[3] || '');
    if (isCouponActive_(status, row[5], now)) {
      stats.active += 1;
      activeParts.push(couponSnapshotPart_(row, index + 2));
      activeCoupons.push({
        couponId: String(row[0]),
        amount: Number(row[2]) || 0,
        issuedAt: formatManagementDate_(row[4]),
        expiresAt: formatManagementDate_(row[5])
      });
    } else if (status === '使用済み') {
      stats.used += 1;
    } else if (status === '未使用' && couponExpiryTime_(row[5]) !== null) {
      stats.expired += 1;
    } else {
      stats.invalid += 1;
    }
  });

  activeCoupons.reverse();
  const pageSize = 50;
  const totalPages = Math.max(1, Math.ceil(activeCoupons.length / pageSize));
  const requestedPage = Number(page);
  const currentPage = Number.isInteger(requestedPage) && requestedPage > 0
    ? Math.min(requestedPage, totalPages)
    : 1;
  const start = (currentPage - 1) * pageSize;
  const stores = getStoreRows_().map(storeManagementResult_);
  stores.sort((left, right) => left.name.localeCompare(right.name, 'ja'));
  const audit = getCouponAuditSnapshot_();
  CacheService.getScriptCache().put('manager:' + token, '1', MANAGER_SESSION_SECONDS);
  return {
    stats: stats,
    activeDigest: sha256_(activeParts.join('\n')),
    activeCoupons: activeCoupons.slice(start, start + pageSize),
    pagination: { page: currentPage, pageSize: pageSize, totalPages: totalPages, total: activeCoupons.length },
    stores: stores,
    auditLogs: audit.logs,
    auditWarning: audit.warning,
    fetchedAt: Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy/MM/dd HH:mm:ss')
  };
}

function getPublicStores() {
  return getStoreRows_()
    .filter((row) => row[6] === true && String(row[0] || '').trim() && String(row[1] || '').trim() && String(row[3] || '').trim() && isValidStoreCoordinate_(row[4], -90, 90) && isValidStoreCoordinate_(row[5], -180, 180))
    .map((row) => ({
      storeId: String(row[0] || ''),
      name: String(row[1] || ''),
      address: String(row[3] || ''),
      lat: Number(row[4]),
      lng: Number(row[5])
    }))
    .sort((left, right) => left.name.localeCompare(right.name, 'ja'));
}

function saveStore(token, store) {
  requireManager_(token);
  const request = store && typeof store === 'object' ? store : {};
  const requestedId = clean_(request.storeId, 32).toUpperCase();
  if (requestedId && !/^STORE-[A-F0-9]{12}$/.test(requestedId)) {
    throw new Error('店舗IDの形式が正しくありません。');
  }
  const name = safeStoreText_(request.name, 80, '店舗名', true);
  const manager = safeStoreText_(request.manager, 80, '店舗責任者', true);
  const address = safeStoreText_(request.address, 180, '住所', false);
  const lat = storeCoordinate_(request.lat, -90, 90, '緯度');
  const lng = storeCoordinate_(request.lng, -180, 180, '経度');
  const published = request.published === true;
  const requestedLoginId = merchantLoginId_(request.loginId, false);
  const requestedPassword = request.password === null || request.password === undefined ? '' : String(request.password);
  if (requestedPassword) validateMerchantPassword_(requestedPassword);
  if (published && (!address || lat === null || lng === null)) {
    throw new Error('公開する店舗は住所・緯度・経度を入力してください。');
  }

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const sheet = getStoreSheet_();
    ensureStoreHeaders_(sheet);
    const lastRow = sheet.getLastRow();
    const rows = lastRow > 1 ? sheet.getRange(2, 1, lastRow - 1, STORE_HEADERS.length).getValues() : [];
    const ids = rows.map((row) => String(row[0] || ''));
    const now = new Date();
    let storeId = requestedId;
    let savedRow;
    if (storeId) {
      const indexes = ids.map((id, index) => id === storeId ? index : -1).filter((index) => index >= 0);
      if (indexes.length !== 1) throw new Error('更新対象の店舗が見つからないか、店舗IDが重複しています。');
      const rowNumber = indexes[0] + 2;
      const current = rows[indexes[0]];
      const currentLoginId = String(current[9] || '').trim().toLowerCase();
      const hasCredentials = !!currentLoginId && !!String(current[10] || '') && !!String(current[11] || '');
      const nextLoginId = requestedLoginId || currentLoginId;
      if (!hasCredentials && (requestedLoginId || requestedPassword) && (!nextLoginId || !requestedPassword)) {
        throw new Error('この店舗にはログインIDとパスワードの両方を設定してください。');
      }
      if (nextLoginId && (nextLoginId !== currentLoginId || !hasCredentials || requestedPassword)) {
        ensureMerchantLoginAvailable_(rows, nextLoginId, storeId);
      }
      savedRow = current.slice(0, STORE_HEADERS.length);
      savedRow[1] = name;
      savedRow[2] = manager;
      savedRow[3] = address;
      savedRow[4] = lat === null ? '' : lat;
      savedRow[5] = lng === null ? '' : lng;
      savedRow[6] = published;
      savedRow[8] = now;
      if (nextLoginId && (nextLoginId !== currentLoginId || requestedPassword || !hasCredentials)) {
        savedRow[9] = nextLoginId;
        if (requestedPassword) {
          savedRow[10] = merchantSalt_();
          savedRow[11] = merchantPasswordHash_(requestedPassword, String(savedRow[10]), true);
        }
        savedRow[12] = merchantCredentialVersion_(current) + 1;
        savedRow[13] = now;
      }
      sheet.getRange(rowNumber, 1, 1, STORE_HEADERS.length).setValues([savedRow]);
    } else {
      if (!requestedLoginId || !requestedPassword) {
        throw new Error('新規加盟店にはログインIDとパスワードを設定してください。');
      }
      ensureMerchantLoginAvailable_(rows, requestedLoginId, '');
      do {
        storeId = 'STORE-' + Utilities.getUuid().replace(/-/g, '').slice(0, 12).toUpperCase();
      } while (ids.indexOf(storeId) !== -1);
      const salt = merchantSalt_();
      savedRow = [
        storeId, name, manager, address, lat === null ? '' : lat, lng === null ? '' : lng,
        published, now, now, requestedLoginId, salt,
        merchantPasswordHash_(requestedPassword, salt, true), 1, now
      ];
      sheet.appendRow(savedRow);
    }
    SpreadsheetApp.flush();
    CacheService.getScriptCache().put('manager:' + token, '1', MANAGER_SESSION_SECONDS);
    return {
      ok: true,
      store: storeManagementResult_(savedRow)
    };
  } finally {
    lock.releaseLock();
  }
}

function revokeActiveCoupons(token, expectedCount, confirmation, expectedDigest) {
  requireManager_(token);
  if (confirmation !== '全件無効化') throw new Error('確認文字列が一致しません。');
  const expected = Number(expectedCount);
  if (!Number.isSafeInteger(expected) || expected < 0) throw new Error('対象件数を再確認してください。');
  const digest = String(expectedDigest || '').toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(digest)) throw new Error('対象一覧の確認情報がありません。画面を更新してください。');

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const sheet = getCouponSheet_();
    ensureCouponHeaders_(sheet);
    const lastRow = sheet.getLastRow();
    const count = Math.max(0, lastRow - 1);
    const couponRows = count ? sheet.getRange(2, 1, count, 6).getValues() : [];
    const now = Date.now();
    const activeIndexes = [];
    const activeParts = [];
    couponRows.forEach((row, index) => {
      if (String(row[0] || '').trim() && isCouponActive_(String(row[3] || ''), row[5], now)) {
        activeIndexes.push(index);
        activeParts.push(couponSnapshotPart_(row, index + 2));
      }
    });
    if (activeIndexes.length !== expected) {
      throw new Error('対象件数が変わりました。画面を更新してから再実行してください。');
    }
    if (!safeEqual_(sha256_(activeParts.join('\n')), digest)) {
      throw new Error('対象クーポンが変わりました。画面を更新してから再実行してください。');
    }
    if (!activeIndexes.length) return { ok: true, revoked: 0, at: Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy/MM/dd HH:mm:ss') };

    // Never change coupon states if the append-only audit cannot first be protected and written.
    const auditSheet = getCouponAuditSheet_();
    ensureCouponAuditHeaders_(auditSheet);
    ensureCouponAuditProtection_(auditSheet);
    const operatedAt = new Date();
    const batchId = 'REV-' + Utilities.formatDate(operatedAt, 'Asia/Tokyo', 'yyyyMMddHHmmss') + '-' + Utilities.getUuid().replace(/-/g, '').slice(0, 8).toUpperCase();
    const targets = activeIndexes.map((index) => ({
      row: index + 2,
      couponId: String(couponRows[index][0]),
      amount: Number(couponRows[index][2]) || 0,
      previousStatus: String(couponRows[index][3] || '')
    }));
    try {
      appendCouponAuditRows_(auditSheet, targets.map((target) => [
        operatedAt, '未使用クーポン全件無効化', targets.length, MANAGER_ID, '開始',
        '対象券を記録。DBへの反映は未確認', batchId, target.couponId, target.amount,
        target.previousStatus, '無効', target.row
      ]));
    } catch (error) {
      try {
        appendCouponAuditRows_(auditSheet, [[
          new Date(), '未使用クーポン全件無効化', targets.length, MANAGER_ID, '要確認',
          '開始履歴の記録確認に失敗。クーポンDBは変更していません。',
          batchId, '', '', '', '', ''
        ]]);
      } catch (auditError) {
        console.error(auditError);
      }
      throw new Error('操作履歴の記録を確認できないため、クーポンは無効化していません。操作ID ' + batchId + ' を確認してください。');
    }

    let dbVerified = false;
    try {
      writeCouponStatuses_(sheet, targets, '無効');
      SpreadsheetApp.flush();
      const resultRows = sheet.getRange(2, 1, count, 4).getValues();
      dbVerified = targets.every((target) => {
        const actual = resultRows[target.row - 2];
        return actual && String(actual[0]) === target.couponId && String(actual[3]) === '無効';
      });
      if (!dbVerified) throw new Error('クーポンDBの反映確認に失敗しました。');

      const completedAt = new Date();
      appendCouponAuditRows_(auditSheet, targets.map((target) => [
        completedAt, '未使用クーポン全件無効化', targets.length, MANAGER_ID, '完了',
        'クーポンDBで無効を確認', batchId, target.couponId, target.amount,
        target.previousStatus, '無効', target.row
      ]));
    } catch (error) {
      // A Sheets write can fail after partial work. Keep the original start rows intact;
      // append a separate alert instead of editing history or claiming a rollback.
      try {
        appendCouponAuditRows_(auditSheet, [[
          new Date(), '未使用クーポン全件無効化', targets.length, MANAGER_ID, '要確認',
          '処理中にエラー。クーポンDBと操作IDの対象券を照合してください。',
          batchId, '', '', '', '', ''
        ]]);
      } catch (auditError) {
        console.error(auditError);
      }
      throw new Error(dbVerified
        ? 'クーポンは無効になりましたが、完了履歴の記録に失敗しました。操作ID ' + batchId + ' を管理者が確認してください。'
        : '無効化の途中でエラーが発生しました。操作ID ' + batchId + ' の対象券とDBの状態を管理者が確認してください。');
    }
    CacheService.getScriptCache().put('manager:' + token, '1', MANAGER_SESSION_SECONDS);
    return { ok: true, revoked: targets.length, at: formatManagementDate_(operatedAt), batchId: batchId };
  } finally {
    lock.releaseLock();
  }
}

function setupCouponAuditProtection() {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const sheet = getCouponAuditSheet_();
    ensureCouponAuditHeaders_(sheet);
    ensureCouponAuditProtection_(sheet);
    return { ok: true, sheetName: sheet.getName(), protected: true, columns: COUPON_AUDIT_HEADERS.length };
  } finally {
    lock.releaseLock();
  }
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
  if (isNaN(expiresAt.getTime()) || Utilities.formatDate(expiresAt, 'Asia/Tokyo', 'yyyy-MM-dd') !== expiryText || expiresAt.getTime() < Date.now()) {
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
      walletUrl: COUPON_WALLET_URL + '?c=' + encodeURIComponent(rawToken),
      redeemUrl: COUPON_REDEEM_URL + '?c=' + encodeURIComponent(rawToken)
    };
  } finally {
    lock.releaseLock();
  }
}

function getCouponWallet(rawToken) {
  const token = normalizeCouponToken_(rawToken);
  const result = lookupCoupon(token);
  if (result.ok) {
    result.redeemUrl = COUPON_REDEEM_URL + '?c=' + encodeURIComponent(token);
  }
  return result;
}

function lookupCoupon(rawToken) {
  const token = normalizeCouponToken_(rawToken);
  if (!token) return { ok: false, status: 'INVALID', message: 'クーポンを読み取れませんでした。' };

  const record = findCouponByHash_(sha256_(token));
  if (!record) return { ok: false, status: 'NOT_FOUND', message: '登録されていないクーポンです。' };
  return couponPublicResult_(record);
}

function couponPublicResult_(record) {
  const values = record.values;
  const status = String(values[3] || '');
  const expiryTime = couponExpiryTime_(values[5]);
  const base = {
    couponId: String(values[0] || ''),
    amount: Number(values[2] || 0),
    expiresAt: expiryTime === null ? '' : formatDate_(new Date(expiryTime), 'Asia/Tokyo')
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
  if (expiryTime === null) {
    return Object.assign(base, { ok: false, status: 'INVALID', message: '有効期限を確認できないため利用できません。' });
  }
  if (expiryTime < Date.now()) {
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

function getStoreSheet_() {
  const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
  return spreadsheet.getSheetByName(STORE_SHEET_NAME) || spreadsheet.insertSheet(STORE_SHEET_NAME);
}

function ensureStoreHeaders_(sheet) {
  const maxColumns = sheet.getMaxColumns();
  if (maxColumns < STORE_HEADERS.length) {
    sheet.insertColumnsAfter(maxColumns, STORE_HEADERS.length - maxColumns);
  }
  const legacyHeaders = STORE_HEADERS.slice(0, 9);
  const legacyExisting = sheet.getRange(1, 1, 1, legacyHeaders.length).getDisplayValues()[0];
  if (legacyExisting.every((value) => !value) && sheet.getLastRow() <= 1) {
    const range = sheet.getRange(1, 1, 1, STORE_HEADERS.length);
    range.setValues([STORE_HEADERS]);
    range.setFontWeight('bold').setBackground('#4a1118').setFontColor('#ffffff');
    range.setHorizontalAlignment('center').setWrap(true);
    sheet.setFrozenRows(1);
    sheet.setColumnWidths(1, STORE_HEADERS.length, 150);
    sheet.setColumnWidth(2, 220);
    sheet.setColumnWidth(4, 320);
    sheet.getRange('E:F').setNumberFormat('0.000000');
    sheet.getRange('H:I').setNumberFormat('yyyy/MM/dd HH:mm:ss');
    sheet.getRange('N:N').setNumberFormat('yyyy/MM/dd HH:mm:ss');
  } else if (legacyExisting.some((value, index) => value !== legacyHeaders[index])) {
    throw new Error('加盟店シートの列構成が異なります。管理者に確認してください。');
  } else {
    const addedHeaders = STORE_HEADERS.slice(9);
    const addedRange = sheet.getRange(1, 10, 1, addedHeaders.length);
    const addedExisting = addedRange.getDisplayValues()[0];
    if (addedExisting.some((value, index) => value && value !== addedHeaders[index])) {
      throw new Error('加盟店シートの認証列構成が異なります。管理者に確認してください。');
    }
    if (addedExisting.some((value, index) => value !== addedHeaders[index])) {
      const lastRow = sheet.getLastRow();
      if (lastRow > 1) {
        const missingIndexes = addedExisting.map((value, index) => value ? -1 : index).filter((index) => index >= 0);
        for (const index of missingIndexes) {
          const cells = sheet.getRange(2, 10 + index, lastRow - 1, 1).getValues();
          if (cells.some((row) => row[0] !== '' && row[0] !== null)) {
            throw new Error('加盟店シートの認証列に見出しのないデータがあります。管理者に確認してください。');
          }
        }
      }
      addedRange.setValues([addedHeaders]);
      addedRange.setFontWeight('bold').setBackground('#4a1118').setFontColor('#ffffff');
      addedRange.setHorizontalAlignment('center').setWrap(true);
      sheet.setColumnWidths(10, addedHeaders.length, 160);
      sheet.setColumnWidth(12, 580);
      sheet.getRange('N:N').setNumberFormat('yyyy/MM/dd HH:mm:ss');
    }
  }
}

function getStoreRows_() {
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(STORE_SHEET_NAME);
  if (!sheet) return [];
  ensureStoreHeaders_(sheet);
  const lastRow = sheet.getLastRow();
  return lastRow > 1 ? sheet.getRange(2, 1, lastRow - 1, STORE_HEADERS.length).getValues().filter((row) => String(row[0] || '').trim()) : [];
}

function storeManagementResult_(row) {
  const loginId = String(row[9] || '').trim().toLowerCase();
  return {
    storeId: String(row[0] || ''),
    name: String(row[1] || ''),
    manager: String(row[2] || ''),
    address: String(row[3] || ''),
    lat: isValidStoreCoordinate_(row[4], -90, 90) ? Number(row[4]) : null,
    lng: isValidStoreCoordinate_(row[5], -180, 180) ? Number(row[5]) : null,
    published: row[6] === true,
    updatedAt: formatManagementDate_(row[8]),
    loginId: loginId,
    hasLogin: !!loginId && !!String(row[10] || '') && !!String(row[11] || '')
  };
}

function getCouponAuditSheet_() {
  const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
  return spreadsheet.getSheetByName(COUPON_AUDIT_SHEET_NAME) || spreadsheet.insertSheet(COUPON_AUDIT_SHEET_NAME);
}

function ensureCouponAuditHeaders_(sheet) {
  const legacyHeaders = COUPON_AUDIT_HEADERS.slice(0, 6);
  const legacyRange = sheet.getRange(1, 1, 1, legacyHeaders.length);
  const legacyExisting = legacyRange.getDisplayValues()[0];
  if (legacyExisting.every((value) => !value) && sheet.getLastRow() <= 1) {
    const range = sheet.getRange(1, 1, 1, COUPON_AUDIT_HEADERS.length);
    range.setValues([COUPON_AUDIT_HEADERS]);
    range.setFontWeight('bold').setBackground('#4a1118').setFontColor('#ffffff');
    range.setHorizontalAlignment('center').setWrap(true);
    sheet.setFrozenRows(1);
    sheet.setColumnWidths(1, COUPON_AUDIT_HEADERS.length, 170);
    sheet.setColumnWidth(6, 320);
    sheet.setColumnWidth(7, 280);
    sheet.setColumnWidth(8, 250);
    sheet.getRange('A:A').setNumberFormat('yyyy/MM/dd HH:mm:ss');
    sheet.getRange('I:I').setNumberFormat('#,##0');
  } else if (legacyExisting.some((value, index) => value !== legacyHeaders[index])) {
    throw new Error('クーポン操作履歴シートの列構成が異なります。管理者に確認してください。');
  } else {
    // Keep old six-column audit entries untouched; add only the new columns.
    const addedHeaders = COUPON_AUDIT_HEADERS.slice(6);
    const addedRange = sheet.getRange(1, 7, 1, addedHeaders.length);
    const addedExisting = addedRange.getDisplayValues()[0];
    if (addedExisting.every((value) => !value)) {
      const lastRow = sheet.getLastRow();
      if (lastRow > 1 && sheet.getRange(2, 7, lastRow - 1, addedHeaders.length)
        .getDisplayValues().some((row) => row.some((value) => value))) {
        throw new Error('クーポン操作履歴の追加列に既存データがあります。管理者に確認してください。');
      }
      addedRange.setValues([addedHeaders]);
      addedRange.setFontWeight('bold').setBackground('#4a1118').setFontColor('#ffffff');
      addedRange.setHorizontalAlignment('center').setWrap(true);
      sheet.setColumnWidths(7, addedHeaders.length, 170);
      sheet.setColumnWidth(7, 280);
      sheet.setColumnWidth(8, 250);
      sheet.getRange('I:I').setNumberFormat('#,##0');
    } else if (addedExisting.some((value, index) => value !== addedHeaders[index])) {
      throw new Error('クーポン操作履歴シートの追加列構成が異なります。管理者に確認してください。');
    }
  }
}

function ensureCouponAuditProtection_(sheet) {
  const protections = sheet.getProtections(SpreadsheetApp.ProtectionType.SHEET);
  let protection = protections.find((item) => item.getDescription() === COUPON_AUDIT_PROTECTION_DESCRIPTION);
  if (!protection) {
    if (protections.length) {
      throw new Error('クーポン操作履歴シートには別の編集保護があります。設定を確認してください。');
    }
    protection = sheet.protect().setDescription(COUPON_AUDIT_PROTECTION_DESCRIPTION);
  }
  protection.setWarningOnly(false);
  protection.setUnprotectedRanges([]);
  // protect() alone is not restrictive until the editor list or domain setting changes.
  protection.addEditor(Session.getEffectiveUser());
  protection.removeEditors(protection.getEditors());
  if (protection.canDomainEdit()) protection.setDomainEdit(false);
  if (protection.isWarningOnly() || protection.getUnprotectedRanges().length ||
    protection.canDomainEdit() || protection.getTargetAudiences().length) {
    throw new Error('クーポン操作履歴シートの編集保護を設定できませんでした。');
  }
  return protection;
}

function appendCouponAuditRows_(sheet, rows) {
  if (!rows.length) return;
  const firstRow = sheet.getLastRow() + 1;
  sheet.getRange(firstRow, 1, rows.length, COUPON_AUDIT_HEADERS.length).setValues(rows);
  SpreadsheetApp.flush();
  const written = sheet.getRange(firstRow, 1, rows.length, COUPON_AUDIT_HEADERS.length).getValues();
  if (written.length !== rows.length || written.some((row, index) =>
    row.some((value, column) => snapshotField_(value) !== snapshotField_(rows[index][column])))) {
    throw new Error('クーポン操作履歴の記録確認に失敗しました。');
  }
}

function writeCouponStatuses_(sheet, targets, status) {
  // RangeList updates non-adjacent coupon rows without overwriting other states.
  for (let index = 0; index < targets.length; index += 100) {
    sheet.getRangeList(targets.slice(index, index + 100).map((target) => 'D' + target.row)).setValue(status);
  }
}

function getCouponAuditSnapshot_() {
  let sheet;
  try {
    sheet = getCouponAuditSheet_();
    ensureCouponAuditHeaders_(sheet);
  } catch (error) {
    console.error(error);
    return { logs: [], warning: '操作履歴シートを確認できません。管理者に連絡してください。' };
  }
  let warning = '';
  try {
    ensureCouponAuditProtection_(sheet);
  } catch (error) {
    console.error(error);
    warning = '操作履歴シートの編集保護を確認できません。無効化は実行しないでください。';
  }
  try {
    const lastRow = sheet.getLastRow();
    if (lastRow < 2) return { logs: [], warning: warning };
    const firstRow = Math.max(2, lastRow - 99);
    const rows = sheet.getRange(firstRow, 1, lastRow - firstRow + 1, COUPON_AUDIT_HEADERS.length).getValues();
    return {
      logs: rows.reverse().map((row) => ({
        operatedAt: formatManagementDate_(row[0]),
        action: String(row[1] || ''),
        couponId: String(row[7] || ''),
        amount: row[8] === '' ? '' : Number(row[8]) || 0,
        actor: String(row[3] || ''),
        result: String(row[4] || ''),
        batchId: String(row[6] || ''),
        previousStatus: String(row[9] || ''),
        nextStatus: String(row[10] || ''),
        note: String(row[5] || '')
      })),
      warning: warning
    };
  } catch (error) {
    console.error(error);
    return { logs: [], warning: '操作履歴を読み取れません。管理者に連絡してください。' };
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

function requireManager_(token) {
  if (!token || CacheService.getScriptCache().get('manager:' + token) !== '1') {
    throw new Error('SESSION_EXPIRED');
  }
}

function requireMerchant_(token) {
  const sessionToken = String(token || '');
  if (!/^[a-f0-9]{64}$/.test(sessionToken)) throw new Error('SESSION_EXPIRED');
  const cache = CacheService.getScriptCache();
  let session;
  try { session = JSON.parse(cache.get('merchant:' + sessionToken) || 'null'); } catch (error) { session = null; }
  if (!session || !/^STORE-[A-F0-9]{12}$/.test(String(session.storeId || ''))) throw new Error('SESSION_EXPIRED');
  const matches = getStoreRows_().filter((row) => String(row[0] || '') === session.storeId);
  if (matches.length !== 1) throw new Error('SESSION_EXPIRED');
  const row = matches[0];
  const loginId = String(row[9] || '').trim().toLowerCase();
  if (!loginId || !String(row[10] || '') || !String(row[11] || '') ||
      merchantCredentialVersion_(row) !== Number(session.version)) {
    throw new Error('SESSION_EXPIRED');
  }
  cache.put('merchant:' + sessionToken, JSON.stringify({ storeId: session.storeId, version: session.version }), MERCHANT_SESSION_SECONDS);
  return { storeId: session.storeId, storeName: String(row[1] || ''), loginId: loginId };
}

function isCouponActive_(status, expiryValue, now) {
  if (status !== '未使用') return false;
  const expiryTime = couponExpiryTime_(expiryValue);
  return expiryTime !== null && expiryTime >= now;
}

function couponExpiryTime_(value) {
  // Coupon issuance writes a real Date. Text cells are not trusted as expiry dates.
  if (!(value instanceof Date)) return null;
  return isNaN(value.getTime()) ? null : value.getTime();
}

function couponSnapshotPart_(row, rowNumber) {
  return JSON.stringify([
    rowNumber,
    String(row[0] || ''),
    String(row[1] || ''),
    String(row[2] === null || row[2] === undefined ? '' : row[2]),
    String(row[3] || ''),
    snapshotField_(row[4]),
    snapshotField_(row[5])
  ]);
}

function snapshotField_(value) {
  return value instanceof Date ? 'date:' + value.getTime() : 'value:' + String(value === null || value === undefined ? '' : value);
}

function formatManagementDate_(value) {
  if (value === '' || value === null || value === undefined) return '';
  const date = value instanceof Date ? value : new Date(value);
  return isNaN(date.getTime()) ? String(value) : Utilities.formatDate(date, 'Asia/Tokyo', 'yyyy/MM/dd HH:mm:ss');
}

function safeStoreText_(value, maxLength, label, required) {
  const text = clean_(value, maxLength);
  if (required && !text) throw new Error(label + 'を入力してください。');
  if (/^[=+\-@]/.test(text)) throw new Error(label + 'の先頭に使用できない記号があります。');
  return text;
}

function merchantLoginId_(value, required) {
  const loginId = String(value === null || value === undefined ? '' : value).trim().toLowerCase();
  if (!loginId && !required) return '';
  if (!/^[a-z0-9][a-z0-9._-]{3,39}$/.test(loginId)) {
    throw new Error('ログインIDは英数字で始まる4～40文字にしてください。使える記号は . _ - です。');
  }
  if (loginId === ADMIN_ID || loginId === MANAGER_ID) {
    throw new Error('そのログインIDは利用できません。');
  }
  return loginId;
}

function validateMerchantPassword_(password) {
  if (password.length < 12 || password.length > 128 || /[\u0000-\u001F\u007F]/.test(password)) {
    throw new Error('パスワードは制御文字を含まない12～128文字にしてください。');
  }
}

function ensureMerchantLoginAvailable_(rows, loginId, excludingStoreId) {
  if (rows.some((row) => String(row[0] || '') !== excludingStoreId && String(row[9] || '').trim().toLowerCase() === loginId)) {
    throw new Error('そのログインIDは別の店舗で使用されています。');
  }
}

function merchantCredentialVersion_(row) {
  const version = Number(row[12]);
  return Number.isSafeInteger(version) && version >= 0 ? version : 0;
}

function merchantSalt_() {
  return Utilities.getUuid().replace(/-/g, '').toLowerCase();
}

function merchantPasswordHash_(password, salt, allowPepperCreation) {
  const properties = PropertiesService.getScriptProperties();
  let pepper = properties.getProperty('MERCHANT_PASSWORD_PEPPER') || '';
  if (!pepper && allowPepperCreation) {
    pepper = (Utilities.getUuid() + Utilities.getUuid()).replace(/-/g, '').toLowerCase();
    properties.setProperty('MERCHANT_PASSWORD_PEPPER', pepper);
  }
  if (!pepper) throw new Error('加盟店の認証設定が見つかりません。管理者に確認してください。');
  const key = pepper + ':' + password;
  let digest = 'chanko-merchant-v1:' + salt;
  for (let index = 0; index < MERCHANT_PASSWORD_ROUNDS; index += 1) {
    digest = Utilities.computeHmacSha256Signature(digest, key)
      .map((byte) => ('0' + ((byte + 256) % 256).toString(16)).slice(-2))
      .join('');
  }
  return 'hmac-sha256-v1$' + MERCHANT_PASSWORD_ROUNDS + '$' + digest;
}

function isValidStoreCoordinate_(value, min, max) {
  if (value === '' || value === null || value === undefined) return false;
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric >= min && numeric <= max;
}

function storeCoordinate_(value, min, max, label) {
  if (value === '' || value === null || value === undefined) return null;
  if (!isValidStoreCoordinate_(value, min, max)) throw new Error(label + 'の値が正しくありません。');
  return Number(value);
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

function lookupCouponForMerchant(sessionToken, input) {
  requireMerchant_(sessionToken);
  if (!normalizeCouponToken_(input) && !normalizeCouponId_(input)) {
    return { ok: false, status: 'INVALID', message: 'QRコードまたはクーポンIDを確認してください。' };
  }
  const record = findCouponForMerchant_(input);
  if (record && record.duplicate) {
    return { ok: false, status: 'INVALID', message: '同じIDのクーポンが複数あります。管理者に確認してください。' };
  }
  if (!record) return { ok: false, status: 'NOT_FOUND', message: '登録されていないクーポンです。' };
  return couponPublicResult_(record);
}

function redeemCouponByMerchant(sessionToken, input) {
  requireMerchant_(sessionToken);
  if (!normalizeCouponToken_(input) && !normalizeCouponId_(input)) {
    return { ok: false, status: 'INVALID', message: 'QRコードまたはクーポンIDを確認してください。' };
  }

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const merchant = requireMerchant_(sessionToken);
    const record = findCouponForMerchant_(input);
    if (record && record.duplicate) {
      return { ok: false, status: 'INVALID', message: '同じIDのクーポンが複数あります。管理者に確認してください。' };
    }
    if (!record) return { ok: false, status: 'NOT_FOUND', message: '登録されていないクーポンです。' };
    const current = couponPublicResult_(record);
    if (!current.ok) return current;

    const redeemedAt = new Date();
    record.sheet.getRange(record.row, 4, 1, 5).setValues([[
      '使用済み',
      record.values[4],
      record.values[5],
      redeemedAt,
      merchant.storeName
    ]]);
    SpreadsheetApp.flush();
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

function normalizeCouponId_(value) {
  const text = clean_(value, 80).toUpperCase();
  return /^SNDG-\d{8}-[A-F0-9]{8}$/.test(text) ? text : '';
}

function findCouponForMerchant_(input) {
  const token = normalizeCouponToken_(input);
  if (token) return findCouponByHash_(sha256_(token));
  const couponId = normalizeCouponId_(input);
  if (!couponId) return null;
  const sheet = getCouponSheet_();
  ensureCouponHeaders_(sheet);
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return null;
  const matches = sheet.getRange(2, 1, lastRow - 1, 1)
    .createTextFinder(couponId)
    .matchEntireCell(true)
    .findAll();
  if (matches.length > 1) return { duplicate: true };
  if (!matches.length) return null;
  const row = matches[0].getRow();
  return { sheet: sheet, row: row, values: sheet.getRange(row, 1, 1, COUPON_HEADERS.length).getValues()[0] };
}
