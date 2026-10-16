// Run with: node --test merchant-auth.test.js
// In-memory Apps Script services; this test never opens or changes the live Sheet.
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const LEGACY_HEADERS = [
  '店舗ID', '店舗名', '店舗責任者', '住所', '緯度', '経度', '公開', '登録日時', '更新日時'
];
const STORE_ID = 'STORE-AAAAAAAAAAAA';
const MANAGER_TOKEN = 'test-manager-session';

class MockRange {
  constructor(sheet, row, column, rowCount, columnCount) {
    this.sheet = sheet;
    this.row = row;
    this.column = column;
    this.rowCount = rowCount;
    this.columnCount = columnCount;
  }

  getValues() {
    return Array.from({ length: this.rowCount }, (_, rowOffset) =>
      Array.from({ length: this.columnCount }, (_, columnOffset) =>
        this.sheet.rows[this.row + rowOffset - 1]?.[this.column + columnOffset - 1] ?? ''
      )
    );
  }

  getDisplayValues() {
    return this.getValues().map((row) => row.map((value) => String(value ?? '')));
  }

  setValues(values) {
    assert.equal(values.length, this.rowCount);
    for (let rowOffset = 0; rowOffset < this.rowCount; rowOffset += 1) {
      assert.equal(values[rowOffset].length, this.columnCount);
      const rowIndex = this.row + rowOffset - 1;
      this.sheet.rows[rowIndex] ||= [];
      for (let columnOffset = 0; columnOffset < this.columnCount; columnOffset += 1) {
        this.sheet.rows[rowIndex][this.column + columnOffset - 1] = values[rowOffset][columnOffset];
      }
    }
    return this;
  }

  createTextFinder(term) {
    let entireCell = false;
    const range = this;
    const finder = {
      matchEntireCell(value) { entireCell = value; return finder; },
      findAll() {
        const matches = [];
        range.getDisplayValues().forEach((row, rowOffset) => {
          row.forEach((value) => {
            if (entireCell ? value === term : value.includes(term)) {
              matches.push({ getRow: () => range.row + rowOffset });
            }
          });
        });
        return matches;
      },
      findNext() { return finder.findAll()[0] || null; }
    };
    return finder;
  }

  setFontWeight() { return this; }
  setBackground() { return this; }
  setFontColor() { return this; }
  setHorizontalAlignment() { return this; }
  setWrap() { return this; }
  setNumberFormat() { return this; }
}

class MockSheet {
  constructor(name, rows = [], maxColumns = 26) {
    this.name = name;
    this.rows = rows.map((row) => row.slice());
    this.maxColumns = maxColumns;
  }

  getName() { return this.name; }
  getMaxColumns() { return this.maxColumns; }
  insertColumnsAfter(index, count) {
    assert.equal(index, this.maxColumns);
    this.maxColumns += count;
  }
  getLastRow() {
    for (let index = this.rows.length - 1; index >= 0; index -= 1) {
      if (this.rows[index].some((value) => value !== '' && value !== null && value !== undefined)) {
        return index + 1;
      }
    }
    return 0;
  }
  getRange(row, column, rowCount = 1, columnCount = 1) {
    // Whole-column ranges in Code.gs are only used to apply number formats.
    if (typeof row === 'string') return new MockRange(this, 1, 1, 1, 1);
    return new MockRange(this, row, column, rowCount, columnCount);
  }
  appendRow(row) { this.rows.push(row.slice()); }
  setFrozenRows() {}
  setColumnWidths() {}
  setColumnWidth() {}
}

function formatTokyo(date, pattern) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Tokyo', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23'
  }).formatToParts(date).map((part) => [part.type, part.value]));
  if (pattern === 'yyyyMMdd') return `${parts.year}${parts.month}${parts.day}`;
  if (pattern === 'yyyy-MM-dd') return `${parts.year}-${parts.month}-${parts.day}`;
  return `${parts.year}/${parts.month}/${parts.day} ${parts.hour}:${parts.minute}:${parts.second}`;
}

function createApp(options = {}) {
  const clock = options.clock;
  const AppDate = clock ? class extends Date {
    constructor(...args) { super(...(args.length ? args : [clock.now])); }
    static now() { return clock.now; }
  } : Date;
  let spreadsheetOpenCount = 0;
  const legacy = new MockSheet('加盟店', [
    LEGACY_HEADERS,
    [STORE_ID, '旧加盟店', '旧責任者', '東京都文京区', 35.72, 139.75, true,
      new Date('2026-10-01T00:00:00+09:00'), new Date('2026-10-01T00:00:00+09:00')]
  ], 9);
  const sheets = new Map([['加盟店', legacy]]);
  const spreadsheet = {
    getSheetByName(name) { return sheets.get(name) || null; },
    insertSheet(name) {
      const sheet = new MockSheet(name);
      sheets.set(name, sheet);
      return sheet;
    }
  };
  const cache = new Map([['manager:' + MANAGER_TOKEN, '1']]);
  const properties = new Map();
  const sandbox = {
    Date: AppDate,
    console,
    SpreadsheetApp: {
      openById(id) {
        assert.equal(id, '1AIHMmcZEfCh7QvNza8HlxHSjAjhj8sPPyQgUbTGvAGU');
        spreadsheetOpenCount += 1;
        return spreadsheet;
      },
      flush() {}
    },
    CacheService: {
      getScriptCache() {
        return {
          get(key) { return cache.get(key) ?? null; },
          put(key, value) { cache.set(key, value); },
          remove(key) { cache.delete(key); }
        };
      }
    },
    PropertiesService: {
      getScriptProperties() {
        return {
          getProperty(key) { return properties.get(key) ?? null; },
          setProperty(key, value) { properties.set(key, value); },
          deleteProperty(key) { properties.delete(key); }
        };
      }
    },
    LockService: {
      getScriptLock() { return { waitLock() {}, releaseLock() {} }; }
    },
    Utilities: {
      getUuid() { return crypto.randomUUID(); },
      computeDigest(_algorithm, value) {
        return Array.from(crypto.createHash('sha256').update(value).digest(), (byte) => byte > 127 ? byte - 256 : byte);
      },
      computeHmacSha256Signature(value, key) {
        return Array.from(crypto.createHmac('sha256', key).update(value).digest(), (byte) => byte > 127 ? byte - 256 : byte);
      },
      DigestAlgorithm: { SHA_256: 'SHA_256' },
      Charset: { UTF_8: 'UTF_8' },
      formatDate: formatTokyo
    }
  };
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(path.join(__dirname, 'Code.gs'), 'utf8'), sandbox, { filename: 'Code.gs' });
  return { app: sandbox, sheets, cache, properties, legacy,
    getSpreadsheetOpenCount: () => spreadsheetOpenCount };
}

function request(name, loginId, password, storeId = '') {
  return { storeId, name, manager: '店舗責任者', address: '', lat: '', lng: '',
    published: false, loginId, password };
}

test('legacy migration, merchant credentials, session invalidation, and one-time coupon use', () => {
  const { app, sheets, properties, legacy } = createApp();

  const migrated = app.getStoreRows_();
  assert.equal(legacy.getMaxColumns(), 14);
  assert.equal(legacy.rows[0].length, 14);
  assert.equal(migrated[0][0], STORE_ID);
  assert.equal(migrated[0][1], '旧加盟店');
  assert.equal(migrated[0][9], '');
  assert.equal(app.merchantLogin('old-store', 'SomethingStrong#2026').ok, false);

  const enrolled = app.saveStore(MANAGER_TOKEN,
    request('旧加盟店', 'legacy-shop', 'LegacyStrong#2026', STORE_ID));
  assert.equal(enrolled.store.storeId, STORE_ID);
  assert.equal(enrolled.store.loginId, 'legacy-shop');
  assert.equal(enrolled.store.hasLogin, true);
  assert.equal(legacy.rows[1][1], '旧加盟店');
  assert.equal(legacy.rows[1][9], 'legacy-shop');
  assert.notEqual(legacy.rows[1][11], 'LegacyStrong#2026');
  assert.ok(properties.get('MERCHANT_PASSWORD_PEPPER'));

  const created = app.saveStore(MANAGER_TOKEN,
    request('夕映え商店', 'Sunset.Shop', 'FirstStrong#2026'));
  assert.equal(created.store.loginId, 'sunset.shop');
  assert.equal(created.store.hasLogin, true);
  assert.match(created.store.storeId, /^STORE-[A-F0-9]{12}$/);
  assert.equal(legacy.rows[2][9], 'sunset.shop');
  assert.notEqual(legacy.rows[2][11], 'FirstStrong#2026');
  assert.equal('password' in created.store, false);
  assert.equal('passwordHash' in created.store, false);
  assert.throws(() => app.saveStore(MANAGER_TOKEN,
    request('重複商店', 'SUNSET.SHOP', 'OtherStrong#2026')), /ログインID/);
  assert.throws(() => app.saveStore(MANAGER_TOKEN,
    request('弱いパスワード商店', 'weak-shop', 'short')), /パスワード/);

  const firstLogin = app.merchantLogin('SUNSET.SHOP', 'FirstStrong#2026');
  assert.equal(firstLogin.ok, true);
  assert.equal(firstLogin.storeName, '夕映え商店');
  assert.equal(firstLogin.storeId, created.store.storeId);
  assert.equal(firstLogin.loginId, 'sunset.shop');
  assert.equal(app.merchantLogin('sunset.shop', 'WrongStrong#2026').ok, false);
  assert.throws(() => app.merchantUpdateCredentials(firstLogin.token,
    'WrongStrong#2026', 'new.shop', 'NextStrong#2026'), /現在のパスワード/);

  const changed = app.merchantUpdateCredentials(firstLogin.token,
    'FirstStrong#2026', 'new.shop', 'NextStrong#2026');
  assert.equal(changed.ok, true);
  assert.equal(changed.loginId, 'new.shop');
  assert.throws(() => app.lookupCouponForMerchant(firstLogin.token, 'SNDG-20261016-12345678'),
    /SESSION_EXPIRED/);
  assert.equal(app.merchantLogin('sunset.shop', 'FirstStrong#2026').ok, false);
  const secondLogin = app.merchantLogin('new.shop', 'NextStrong#2026');
  assert.equal(secondLogin.ok, true);

  const reset = app.saveStore(MANAGER_TOKEN,
    request('夕映え商店', 'new.shop', 'ResetStrong#2026', created.store.storeId));
  assert.equal(reset.store.hasLogin, true);
  assert.throws(() => app.lookupCouponForMerchant(secondLogin.token, 'SNDG-20261016-12345678'),
    /SESSION_EXPIRED/);
  assert.equal(app.merchantLogin('new.shop', 'NextStrong#2026').ok, false);
  const finalLogin = app.merchantLogin('new.shop', 'ResetStrong#2026');
  assert.equal(finalLogin.ok, true);
  assert.equal(typeof app.redeemCoupon, 'undefined');

  const couponSheet = sheets.get('クーポンDB') || new MockSheet('クーポンDB');
  sheets.set('クーポンDB', couponSheet);
  const rawToken = crypto.randomBytes(32).toString('hex');
  const couponId = 'SNDG-20261016-12345678';
  couponSheet.appendRow([
    'クーポンID', 'トークンハッシュ', '割引額（円）', '状態', '発行日時',
    '有効期限', '利用日時', '利用店舗', '発行者', '備考'
  ]);
  couponSheet.appendRow([
    couponId, app.sha256_(rawToken), 100, '未使用', new Date(),
    new Date(Date.now() + 86400000), '', '', 'admin', ''
  ]);
  const preview = app.lookupCouponForMerchant(finalLogin.token, couponId);
  assert.equal(preview.ok, true);
  assert.equal(preview.amount, 100);
  const redeemed = app.redeemCouponByMerchant(finalLogin.token, rawToken, '偽の店舗名');
  assert.equal(redeemed.ok, true);
  assert.equal(redeemed.status, 'USED');
  assert.equal(couponSheet.rows[1][3], '使用済み');
  assert.equal(couponSheet.rows[1][7], '夕映え商店');
  assert.equal(app.redeemCouponByMerchant(finalLogin.token, couponId).status, 'USED');

  app.merchantLogout(finalLogin.token);
  assert.throws(() => app.lookupCouponForMerchant(finalLogin.token, couponId), /SESSION_EXPIRED/);
});

test('ID-only and password-only edits preserve the other credential and reject another store ID', () => {
  const { app, legacy } = createApp();
  const one = app.saveStore(MANAGER_TOKEN, request('一号店', 'shop.one', 'PasswordForOne#2026'));
  app.saveStore(MANAGER_TOKEN, request('二号店', 'shop.two', 'PasswordForTwo#2026'));
  const first = app.merchantLogin('shop.one', 'PasswordForOne#2026');
  assert.equal(first.ok, true);
  assert.throws(() => app.merchantUpdateCredentials(first.token,
    'PasswordForOne#2026', 'SHOP.TWO', ''), /ログインID/);
  assert.throws(() => app.merchantUpdateCredentials(first.token,
    'PasswordForOne#2026', 'shop.one', ''), /変更するログインID/);
  assert.throws(() => app.lookupCouponForMerchant(MANAGER_TOKEN, 'SNDG-20261016-12345678'),
    /SESSION_EXPIRED/);

  const before = legacy.rows.find((row) => row[0] === one.store.storeId);
  const originalHash = before[11];
  const idChange = app.merchantUpdateCredentials(first.token,
    'PasswordForOne#2026', 'shop.renamed', '');
  assert.equal(idChange.loginId, 'shop.renamed');
  assert.equal(before[11], originalHash);
  assert.throws(() => app.lookupCouponForMerchant(first.token, 'SNDG-20261016-12345678'),
    /SESSION_EXPIRED/);
  const second = app.merchantLogin('shop.renamed', 'PasswordForOne#2026');
  assert.equal(second.ok, true);

  const passChange = app.merchantUpdateCredentials(second.token,
    'PasswordForOne#2026', 'shop.renamed', 'PasswordForOneNew#2026');
  assert.equal(passChange.loginId, 'shop.renamed');
  assert.notEqual(before[11], originalHash);
  assert.throws(() => app.lookupCouponForMerchant(second.token, 'SNDG-20261016-12345678'),
    /SESSION_EXPIRED/);
  assert.equal(app.merchantLogin('shop.renamed', 'PasswordForOne#2026').ok, false);
  assert.equal(app.merchantLogin('shop.renamed', 'PasswordForOneNew#2026').ok, true);
});

test('merchant ID fields use a valid browser pattern', () => {
  for (const filename of ['ManagementApp.html', 'coupon-redeem-app.html']) {
    const html = fs.readFileSync(path.join(__dirname, filename), 'utf8');
    const field = filename === 'ManagementApp.html' ? 'storeLoginId' : 'newLoginId';
    const match = html.match(new RegExp('<input id="' + field + '"[^>]*pattern="([^"]+)"'));
    assert.ok(match, `${filename}: merchant ID pattern missing`);
    const pattern = new RegExp('^(?:' + match[1] + ')$', 'v');
    assert.equal(pattern.test('shop.one'), true);
    assert.equal(pattern.test('-bad.id'), false);
    assert.equal(pattern.test('abc'), false);
  }
});

test('global 60-failure cooldown stops Sheet reads and expires after one minute', () => {
  const clock = { now: Date.now() };
  const { app, getSpreadsheetOpenCount } = createApp({ clock });
  app.saveStore(MANAGER_TOKEN, request('通常の加盟店', 'normal.shop', 'KnownStrong#2026'));
  const beforeFailures = getSpreadsheetOpenCount();
  for (let index = 0; index < 60; index += 1) {
    const response = app.merchantLogin(`invalid${String(index).padStart(2, '0')}`, 'WrongStrong#2026');
    assert.equal(response.ok, false);
  }
  const afterFailures = getSpreadsheetOpenCount();
  assert.equal(afterFailures - beforeFailures, 60);

  const blocked = app.merchantLogin('normal.shop', 'KnownStrong#2026');
  assert.equal(blocked.ok, false);
  assert.match(blocked.message, /1分ほど待って/);
  assert.equal(getSpreadsheetOpenCount(), afterFailures,
    'globally blocked requests must not query the Sheet');

  clock.now += 60001;
  const resumed = app.merchantLogin('normal.shop', 'KnownStrong#2026');
  assert.equal(resumed.ok, true);
  assert.ok(getSpreadsheetOpenCount() > afterFailures);
});
