// Run with: node --test profile-backend.test.js
// In-memory Apps Script services; the live spreadsheet is never accessed.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const PNG_1PX = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/eXcAAAAASUVORK5CYII=';
const ADMIN_TOKEN = 'a'.repeat(64);
const MANAGER_TOKEN = 'b'.repeat(64);
const MERCHANT_TOKEN = 'c'.repeat(64);

class Range {
  constructor(sheet, row, column, height, width) { Object.assign(this, { sheet, row, column, height, width }); }
  getValues() {
    return Array.from({ length: this.height }, (_, r) =>
      Array.from({ length: this.width }, (_, c) => this.sheet.rows[this.row + r - 1]?.[this.column + c - 1] ?? '')
    );
  }
  getDisplayValues() { return this.getValues().map((row) => row.map(String)); }
  setValues(rows) {
    rows.forEach((values, r) => values.forEach((value, c) => {
      this.sheet.rows[this.row + r - 1] ||= [];
      this.sheet.rows[this.row + r - 1][this.column + c - 1] = value;
    }));
    return this;
  }
}

class Sheet {
  constructor(name) { this.name = name; this.rows = []; }
  getLastRow() { return this.rows.length; }
  getMaxColumns() { return 26; }
  getRange(row, column, height = 1, width = 1) { return new Range(this, row, column, height, width); }
  appendRow(row) { this.rows.push(row.slice()); }
  setFrozenRows() {}
}

function fixture() {
  const sheets = new Map();
  const properties = new Map();
  const cache = new Map([
    ['admin:' + ADMIN_TOKEN, '1'],
    ['manager:' + MANAGER_TOKEN, '1'],
    ['merchant:' + MERCHANT_TOKEN, JSON.stringify({ storeId: 'STORE-AAAAAAAAAAAA', version: 1 })]
  ]);
  const context = {
    console,
    PropertiesService: { getScriptProperties: () => ({ getProperty: (key) => properties.get(key) ?? null }) },
    CacheService: { getScriptCache: () => ({
      get: (key) => cache.get(key) ?? null,
      put: (key, value) => cache.set(key, value),
      remove: (key) => cache.delete(key)
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
      base64Decode: (value) => Array.from(Buffer.from(value, 'base64')),
      base64Encode: (bytes) => Buffer.from(bytes.map((byte) => (byte + 256) % 256)).toString('base64'),
      formatDate: (date) => new Date(date).toISOString().slice(0, 19).replace('T', ' ')
    }
  };
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(path.join(__dirname, 'Code.gs'), 'utf8'), context, { filename: 'Code.gs' });
  const stores = new Sheet('加盟店');
  stores.rows.push(Array.from(vm.runInContext('STORE_HEADERS.slice()', context)));
  stores.rows.push([
    'STORE-AAAAAAAAAAAA', '千駄木テスト店', '担当者', '', '', '', true, '', '',
    'test-shop', 'salt', 'hash', 1, ''
  ]);
  sheets.set('加盟店', stores);
  return { context, sheets, cache };
}

test('images are private to the authenticated account and persist in a dedicated sheet', () => {
  const { context, sheets } = fixture();
  assert.equal(context.getAccountProfile(ADMIN_TOKEN).imageDataUrl, '');
  const admin = context.saveAccountProfileImage(ADMIN_TOKEN, PNG_1PX);
  assert.equal(admin.role, 'admin');
  assert.equal(admin.loginId, 'admin');
  assert.equal(admin.imageDataUrl, PNG_1PX);
  assert.equal(context.getAccountProfile(ADMIN_TOKEN).imageDataUrl, PNG_1PX);
  assert.equal(context.getAccountProfile(MANAGER_TOKEN).imageDataUrl, '');
  assert.equal(context.getAccountProfile(MERCHANT_TOKEN).imageDataUrl, '');

  const merchant = context.saveAccountProfileImage(MERCHANT_TOKEN, PNG_1PX);
  assert.equal(merchant.role, 'merchant');
  assert.equal(merchant.loginId, 'test-shop');
  assert.equal(merchant.displayName, '千駄木テスト店');
  const rows = sheets.get('アカウント画像').rows;
  assert.equal(rows.length, 3);
  assert.deepEqual(rows.slice(1).map((row) => [row[0], row[1]]), [
    ['admin', 'admin'], ['merchant', 'STORE-AAAAAAAAAAAA']
  ]);
  assert.equal(context.removeAccountProfileImage(ADMIN_TOKEN).imageDataUrl, '');
  assert.equal(context.getAccountProfile(MERCHANT_TOKEN).imageDataUrl, PNG_1PX);
});

test('expired sessions cannot read, write, or delete profile images', () => {
  const { context, sheets, cache } = fixture();
  assert.throws(() => context.getAccountProfile('d'.repeat(64)), /SESSION_EXPIRED/);
  assert.throws(() => context.saveAccountProfileImage('d'.repeat(64), PNG_1PX), /SESSION_EXPIRED/);
  assert.equal(sheets.has('アカウント画像'), false);
  context.saveAccountProfileImage(MERCHANT_TOKEN, PNG_1PX);
  cache.delete('merchant:' + MERCHANT_TOKEN);
  assert.throws(() => context.removeAccountProfileImage(MERCHANT_TOKEN), /SESSION_EXPIRED/);
  assert.throws(() => context.getAccountProfile(MERCHANT_TOKEN), /SESSION_EXPIRED/);
});

test('server rejects unsafe MIME, malformed encoding, oversized or oversized-dimension images', () => {
  const { context, sheets } = fixture();
  const encode = (bytes, mime = 'image/png') => `data:${mime};base64,${Buffer.from(bytes).toString('base64')}`;
  assert.throws(() => context.saveAccountProfileImage(ADMIN_TOKEN, encode(Buffer.from('<svg/>'), 'image/svg+xml')), /JPEG・PNG・WebP/);
  assert.throws(() => context.saveAccountProfileImage(ADMIN_TOKEN, 'data:image/png;base64,###'), /JPEG・PNG・WebP/);
  assert.throws(() => context.saveAccountProfileImage(ADMIN_TOKEN, 'data:image/png;base64,' + 'A'.repeat(44004)), /大きすぎ/);
  const wide = Buffer.from(PNG_1PX.split(',')[1], 'base64');
  wide[16] = 0; wide[17] = 0; wide[18] = 2; wide[19] = 1; // 513 px
  assert.throws(() => context.saveAccountProfileImage(ADMIN_TOKEN, encode(wide)), /512px以下/);
  assert.equal(sheets.has('アカウント画像'), false);
});

test('invalid spreadsheet data is not returned as a browser image source', () => {
  const { context, sheets } = fixture();
  context.saveAccountProfileImage(MANAGER_TOKEN, PNG_1PX);
  sheets.get('アカウント画像').rows[1][3] = 'data:image/svg+xml;base64,' + Buffer.from('<svg/>').toString('base64');
  assert.equal(context.getAccountProfile(MANAGER_TOKEN).imageDataUrl, '');
});
