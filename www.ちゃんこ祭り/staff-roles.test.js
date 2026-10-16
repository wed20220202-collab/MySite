// Run with: node --test staff-roles.test.js
// All services are in-memory; this does not touch the live spreadsheet.
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

class Range {
  constructor(sheet, row, column, height, width) {
    Object.assign(this, { sheet, row, column, height, width });
  }
  getValues() {
    return Array.from({ length: this.height }, (_, r) =>
      Array.from({ length: this.width }, (_, c) => this.sheet.rows[this.row + r - 1]?.[this.column + c - 1] ?? '')
    );
  }
  getDisplayValues() { return this.getValues().map((row) => row.map(String)); }
  setValues(values) {
    values.forEach((row, r) => row.forEach((value, c) => {
      const index = this.row + r - 1;
      this.sheet.rows[index] ||= [];
      this.sheet.rows[index][this.column + c - 1] = value;
    }));
    return this;
  }
  createTextFinder(term) {
    const range = this;
    const finder = {
      matchEntireCell() { return finder; },
      findAll() {
        const rows = [];
        range.getDisplayValues().forEach((row, index) => {
          if (row.includes(term)) rows.push({ getRow: () => range.row + index });
        });
        return rows;
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

class Sheet {
  constructor(name, rows = []) { this.name = name; this.rows = rows; }
  getLastRow() { return this.rows.length; }
  getMaxColumns() { return 14; }
  getRange(row, column, height = 1, width = 1) {
    return typeof row === 'string' ? new Range(this, 1, 1, 1, 1) : new Range(this, row, column, height, width);
  }
  appendRow(row) { this.rows.push(row.slice()); }
  setFrozenRows() {}
  setColumnWidth() {}
  setColumnWidths() {}
}

function formatDate(date, _zone, pattern) {
  const iso = new Date(date).toISOString();
  if (pattern === 'yyyyMMdd') return iso.slice(0, 10).replace(/-/g, '');
  if (pattern === 'yyyy-MM-dd') return iso.slice(0, 10);
  return iso.slice(0, 19).replace('T', ' ');
}

function fixture() {
  const cache = new Map();
  const properties = new Map([
    ['ADMIN_PASSWORD_SHA256', crypto.createHash('sha256').update('AdminStrong#2026').digest('hex')],
    ['MANAGER_PASSWORD_SHA256', crypto.createHash('sha256').update('ManagerStrong#2026').digest('hex')],
    ['MERCHANT_PASSWORD_PEPPER', 'test-pepper-secret']
  ]);
  const coupons = new Sheet('クーポンDB');
  const stores = new Sheet('加盟店');
  const sheets = new Map([['クーポンDB', coupons], ['加盟店', stores]]);
  const app = {
    console,
    CacheService: { getScriptCache: () => ({
      get: (key) => cache.get(key) ?? null,
      put: (key, value) => cache.set(key, value),
      remove: (key) => cache.delete(key)
    }) },
    PropertiesService: { getScriptProperties: () => ({
      getProperty: (key) => properties.get(key) ?? null,
      setProperty: (key, value) => properties.set(key, value),
      deleteProperty: (key) => properties.delete(key)
    }) },
    LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
    SpreadsheetApp: {
      openById: () => ({
        getSheetByName: (name) => sheets.get(name) || null,
        insertSheet: (name) => {
          const sheet = new Sheet(name);
          sheets.set(name, sheet);
          return sheet;
        }
      }),
      flush() {}
    },
    Utilities: {
      getUuid: () => crypto.randomUUID(),
      computeDigest: (_algorithm, value) => Array.from(crypto.createHash('sha256').update(value).digest()),
      computeHmacSha256Signature: (value, key) => Array.from(crypto.createHmac('sha256', key).update(value).digest()),
      DigestAlgorithm: { SHA_256: 'SHA_256' },
      Charset: { UTF_8: 'UTF_8' },
      formatDate
    }
  };
  vm.createContext(app);
  vm.runInContext(fs.readFileSync(path.join(__dirname, 'Code.gs'), 'utf8'), app, { filename: 'Code.gs' });
  stores.rows.push(vm.runInContext('STORE_HEADERS.slice()', app));
  stores.rows.push([
    'STORE-AAAAAAAAAAAA', 'テスト加盟店', '担当者', '', '', '', true, '', '',
    'test-shop', 'test-salt', app.merchantPasswordHash_('MerchantStrong#2026', 'test-salt', false), 1, ''
  ]);
  return { app, coupons, stores, cache };
}

test('management stays manager-only, issuing accepts admin and manager but not merchant', () => {
  const { app, coupons } = fixture();
  const admin = app.issueLogin('admin', 'AdminStrong#2026');
  const manager = app.issueLogin('manager', 'ManagerStrong#2026');
  const merchant = app.redeemLogin('test-shop', 'MerchantStrong#2026');
  assert.equal(admin.role, 'admin');
  assert.equal(manager.role, 'manager');
  assert.equal(merchant.role, 'merchant');
  assert.equal(app.issueLogin('test-shop', 'MerchantStrong#2026').ok, false);
  assert.equal(app.restoreIssueSession(manager.token).role, 'manager');
  assert.equal(app.restoreIssueSession(merchant.token).ok, false);
  assert.throws(() => app.getManagementData(admin.token, 1), /SESSION_EXPIRED/);
  assert.throws(() => app.getManagementData(merchant.token, 1), /SESSION_EXPIRED/);
  assert.throws(() => app.issueCoupon(merchant.token, { amount: 100, expiresOn: '2030-01-01' }), /SESSION_EXPIRED/);

  const request = { amount: 100, expiresOn: '2030-01-01' };
  assert.equal(app.issueCoupon(admin.token, request).ok, true);
  assert.equal(app.issueCoupon(manager.token, request).ok, true);
  assert.equal(coupons.rows[1][8], 'admin');
  assert.equal(coupons.rows[2][8], 'manager');
  app.issueLogout(manager.token);
  assert.equal(app.restoreIssueSession(manager.token).ok, false);
  assert.equal(app.restoreIssueSession(admin.token).role, 'admin');
});

test('scanner accepts all roles, enforces one use and preserves merchant-only old APIs', () => {
  const { app, coupons } = fixture();
  const admin = app.redeemLogin('admin', 'AdminStrong#2026');
  const manager = app.redeemLogin('manager', 'ManagerStrong#2026');
  const merchant = app.redeemLogin('test-shop', 'MerchantStrong#2026');
  assert.equal(app.restoreRedeemSession(admin.token).role, 'admin');
  assert.equal(app.restoreRedeemSession(manager.token).role, 'manager');
  assert.equal(app.restoreRedeemSession(merchant.token).storeName, 'テスト加盟店');
  assert.throws(() => app.lookupCouponForMerchant(admin.token, 'SNDG-20261016-AAAAAAAA'), /SESSION_EXPIRED/);
  assert.throws(() => app.redeemCouponByMerchant(manager.token, 'SNDG-20261016-AAAAAAAA'), /SESSION_EXPIRED/);

  const issuer = app.issueLogin('admin', 'AdminStrong#2026');
  const request = { amount: 100, expiresOn: '2030-01-01' };
  const first = app.issueCoupon(issuer.token, request);
  assert.equal(app.lookupCouponForStaff(admin.token, first.couponId).status, 'AVAILABLE');
  assert.equal(app.redeemCouponByStaff(manager.token, first.couponId).status, 'USED');
  assert.equal(coupons.rows[1][7], '総括管理者（manager）');
  assert.equal(app.redeemCouponByStaff(merchant.token, first.couponId).status, 'USED');
  assert.equal(coupons.rows[1][7], '総括管理者（manager）');

  const second = app.issueCoupon(issuer.token, request);
  assert.equal(app.redeemCouponByStaff(merchant.token, second.couponId).status, 'USED');
  assert.equal(coupons.rows[2][7], 'テスト加盟店');
  app.redeemLogout(merchant.token);
  assert.equal(app.restoreRedeemSession(merchant.token).ok, false);
  assert.throws(() => app.lookupCouponForStaff(merchant.token, second.couponId), /SESSION_EXPIRED/);
});
