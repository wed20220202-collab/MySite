// Run with: node --test manager-webauthn.test.js
// Local WebAuthn vectors signed with Node's P-256 implementation; no live GAS/Sheet access.
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const RP_ID = 'wed20220202-collab.github.io';
const ORIGIN = 'https://' + RP_ID;
const PASSWORD = 'ManagerStrong#2026';
const b64 = (value) => Buffer.from(value).toString('base64url');
const sha = (value) => crypto.createHash('sha256').update(value).digest();
const signed = (value) => Array.from(value, (byte) => byte > 127 ? byte - 256 : byte);

function cborHead(major, length) {
  if (length < 24) return Buffer.from([(major << 5) | length]);
  if (length < 256) return Buffer.from([(major << 5) | 24, length]);
  if (length < 65536) return Buffer.from([(major << 5) | 25, length >> 8, length & 255]);
  throw new Error('test CBOR value too long');
}
function cbor(value) {
  if (Buffer.isBuffer(value)) return Buffer.concat([cborHead(2, value.length), value]);
  if (typeof value === 'string') {
    const bytes = Buffer.from(value);
    return Buffer.concat([cborHead(3, bytes.length), bytes]);
  }
  if (typeof value === 'number') return value >= 0 ? cborHead(0, value) : cborHead(1, -1 - value);
  if (value instanceof Map) {
    const parts = [cborHead(5, value.size)];
    for (const [key, item] of value) parts.push(cbor(key), cbor(item));
    return Buffer.concat(parts);
  }
  throw new Error('unexpected test CBOR value');
}

function makeKey() {
  const { privateKey, publicKey } = crypto.generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
  const jwk = publicKey.export({ format: 'jwk' });
  return { privateKey, x: Buffer.from(jwk.x, 'base64url'), y: Buffer.from(jwk.y, 'base64url'), id: crypto.randomBytes(32) };
}
function clientData(type, challenge, origin = ORIGIN) {
  return Buffer.from(JSON.stringify({ type, challenge, origin, crossOrigin: false }));
}
function registration(key, challenge, origin = ORIGIN) {
  const count = Buffer.alloc(4);
  const idLength = Buffer.alloc(2);
  idLength.writeUInt16BE(key.id.length);
  const cose = cbor(new Map([[1, 2], [3, -7], [-1, 1], [-2, key.x], [-3, key.y]]));
  const auth = Buffer.concat([sha(RP_ID), Buffer.from([0x41]), count, Buffer.alloc(16), idLength, key.id, cose]);
  const attestation = cbor(new Map([['fmt', 'none'], ['attStmt', new Map()], ['authData', auth]]));
  return {
    id: b64(key.id), rawId: b64(key.id), type: 'public-key',
    response: { clientDataJSON: b64(clientData('webauthn.create', challenge, origin)), attestationObject: b64(attestation) }
  };
}
function assertion(key, challenge, counter, origin = ORIGIN, signedBy = key) {
  const counterBytes = Buffer.alloc(4);
  counterBytes.writeUInt32BE(counter);
  const auth = Buffer.concat([sha(RP_ID), Buffer.from([0x01]), counterBytes]);
  const client = clientData('webauthn.get', challenge, origin);
  const signature = crypto.sign('sha256', Buffer.concat([auth, sha(client)]), signedBy.privateKey);
  return {
    id: b64(key.id), rawId: b64(key.id), type: 'public-key',
    response: { authenticatorData: b64(auth), clientDataJSON: b64(client), signature: b64(signature) }
  };
}

function fixture() {
  const cache = new Map();
  const properties = new Map([['MANAGER_PASSWORD_SHA256', sha(PASSWORD).toString('hex')]]);
  const app = {
    console,
    PropertiesService: { getScriptProperties: () => ({
      getProperty: (key) => properties.get(key) ?? null,
      setProperty: (key, value) => properties.set(key, value),
      deleteProperty: (key) => properties.delete(key)
    }) },
    CacheService: { getScriptCache: () => ({
      get: (key) => cache.get(key) ?? null,
      put: (key, value) => cache.set(key, value),
      remove: (key) => cache.delete(key)
    }) },
    LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
    Utilities: {
      getUuid: () => crypto.randomUUID(),
      base64EncodeWebSafe: (value) => Buffer.from(value.map ? value.map((byte) => (byte + 256) % 256) : value).toString('base64url'),
      base64DecodeWebSafe: (value) => signed(Buffer.from(value, 'base64url')),
      computeDigest: (_algorithm, value) => signed(sha(typeof value === 'string' ? value : Buffer.from(value.map((byte) => (byte + 256) % 256)))),
      newBlob: (value) => {
        const bytes = typeof value === 'string' ? Buffer.from(value) : Buffer.from(value.map((byte) => (byte + 256) % 256));
        return { getBytes: () => signed(bytes), getDataAsString: () => bytes.toString('utf8') };
      },
      DigestAlgorithm: { SHA_256: 'SHA_256' },
      Charset: { UTF_8: 'UTF_8' }
    }
  };
  vm.createContext(app);
  vm.runInContext(fs.readFileSync(path.join(__dirname, 'WebAuthnCrypto.gs'), 'utf8'), app, { filename: 'WebAuthnCrypto.gs' });
  vm.runInContext(fs.readFileSync(path.join(__dirname, 'Code.gs'), 'utf8'), app, { filename: 'Code.gs' });
  return { app, cache, properties };
}

function enrollFirst(context) {
  const { app } = context;
  const key = makeKey();
  const passwordSession = app.managerLogin('manager', PASSWORD);
  const begin = app.beginManagerSecurityKeyEnrollment(passwordSession.token);
  const completed = app.finishManagerSecurityKeyEnrollment(passwordSession.token, begin.flowId,
    registration(key, begin.publicKey.challenge), 'メイン YubiKey');
  return { key, passwordSession, begin, completed };
}

test('first enrollment revokes password-only manager sessions and all login routes require a signed assertion', () => {
  const context = fixture();
  const { app } = context;
  const { key, passwordSession, completed } = enrollFirst(context);
  assert.equal(completed.reauthenticationRequired, true);
  assert.throws(() => app.getManagerSecurityKeyStatus(passwordSession.token), /SESSION_EXPIRED/);
  assert.throws(() => app.beginManagerSecurityKeyEnrollment(passwordSession.token), /SESSION_EXPIRED/);
  assert.throws(() => app.requireStaffSession_(passwordSession.token, false), /SESSION_EXPIRED/);
  for (const start of [
    () => app.managerLogin('manager', PASSWORD),
    () => app.issueLogin('manager', PASSWORD),
    () => app.redeemLogin('manager', PASSWORD)
  ]) {
    const pending = start();
    assert.equal(pending.ok, true);
    assert.equal(pending.mfaRequired, true);
    assert.equal(pending.token, undefined);
    assert.equal(pending.publicKey.rpId, RP_ID);
    assert.equal(pending.publicKey.allowCredentials.length, 1);
  }
  const pending = app.managerLogin('manager', PASSWORD);
  const accepted = app.finishManagerSecurityKeyLogin(pending.flowId, assertion(key, pending.publicKey.challenge, 1));
  assert.equal(accepted.ok, true);
  assert.equal(accepted.role, 'manager');
  assert.equal(app.restoreIssueSession(accepted.token).role, 'manager');
  assert.equal(app.restoreRedeemSession(accepted.token).role, 'manager');
  assert.equal(app.getManagerSecurityKeyStatus(accepted.token).keyCount, 1);
  assert.throws(() => app.finishManagerSecurityKeyLogin(pending.flowId, assertion(key, pending.publicKey.challenge, 2)), /有効期限/);
});

test('wrong origin, wrong signature, replay, and nonincreasing counters fail closed', () => {
  const context = fixture();
  const { app } = context;
  const { key } = enrollFirst(context);
  let pending = app.managerLogin('manager', PASSWORD);
  assert.throws(() => app.finishManagerSecurityKeyLogin(pending.flowId,
    assertion(key, pending.publicKey.challenge, 1, 'https://evil.example')), /認証元/);
  assert.throws(() => app.finishManagerSecurityKeyLogin(pending.flowId,
    assertion(key, pending.publicKey.challenge, 1)), /有効期限/);

  pending = app.managerLogin('manager', PASSWORD);
  assert.throws(() => app.finishManagerSecurityKeyLogin(pending.flowId,
    assertion(key, pending.publicKey.challenge, 1, ORIGIN, makeKey())), /署名/);
  pending = app.managerLogin('manager', PASSWORD);
  const login = app.finishManagerSecurityKeyLogin(pending.flowId, assertion(key, pending.publicKey.challenge, 1));
  assert.equal(login.ok, true);
  pending = app.managerLogin('manager', PASSWORD);
  assert.throws(() => app.finishManagerSecurityKeyLogin(pending.flowId,
    assertion(key, pending.publicKey.challenge, 1)), /カウンター/);
  assert.equal(app.getManagerSecurityKeyStatus(login.token).keyCount, 1);
});

test('backup key registration requires fresh existing-key assertion and both keys can authenticate', () => {
  const context = fixture();
  const { app, cache } = context;
  const { key } = enrollFirst(context);
  const firstFlow = app.managerLogin('manager', PASSWORD);
  const firstLogin = app.finishManagerSecurityKeyLogin(firstFlow.flowId,
    assertion(key, firstFlow.publicKey.challenge, 1));
  const stale = JSON.parse(cache.get('manager:' + firstLogin.token));
  stale.authAt = Date.now() - 360000;
  cache.set('manager:' + firstLogin.token, JSON.stringify(stale));
  const secondKey = makeKey();
  let begin = app.beginManagerSecurityKeyEnrollment(firstLogin.token);
  assert.equal(begin.stepUpRequired, true);
  assert.equal(begin.publicKey.allowCredentials.length, 1);
  assert.equal(begin.publicKey.excludeCredentials, undefined);
  assert.throws(() => app.completeManagerSecurityKeyEnrollmentStepUp(firstLogin.token, begin.flowId,
    assertion(key, begin.publicKey.challenge, 2, ORIGIN, makeKey())), /署名/);
  assert.throws(() => app.completeManagerSecurityKeyEnrollmentStepUp(firstLogin.token, begin.flowId,
    assertion(key, begin.publicKey.challenge, 2)), /有効期限/);

  const forgedEnrollment = app.createManagerWebAuthnFlow_(app.CacheService.getScriptCache(), 'enroll',
    sha(firstLogin.token).toString('hex'));
  assert.throws(() => app.finishManagerSecurityKeyEnrollment(firstLogin.token, forgedEnrollment.flowId,
    registration(secondKey, forgedEnrollment.challenge), '予備キー'), /再確認/);

  begin = app.beginManagerSecurityKeyEnrollment(firstLogin.token);
  const approved = app.completeManagerSecurityKeyEnrollmentStepUp(firstLogin.token, begin.flowId,
    assertion(key, begin.publicKey.challenge, 2));
  assert.equal(approved.publicKey.excludeCredentials.length, 1);
  assert.throws(() => app.completeManagerSecurityKeyEnrollmentStepUp(firstLogin.token, begin.flowId,
    assertion(key, begin.publicKey.challenge, 3)), /有効期限/);
  const completed = app.finishManagerSecurityKeyEnrollment(firstLogin.token, approved.flowId,
    registration(secondKey, approved.publicKey.challenge), '予備キー');
  assert.equal(completed.keyCount, 2);
  assert.equal(completed.reauthenticationRequired, false);
  const status = app.getManagerSecurityKeyStatus(firstLogin.token);
  assert.deepEqual(Array.from(status.keys, (item) => item.label), ['メイン YubiKey', '予備キー']);
  assert.equal(status.keys[0].publicKey, undefined);
  const secondFlow = app.managerLogin('manager', PASSWORD);
  assert.equal(secondFlow.publicKey.allowCredentials.length, 2);
  assert.equal(app.finishManagerSecurityKeyLogin(secondFlow.flowId,
    assertion(secondKey, secondFlow.publicKey.challenge, 1)).ok, true);
});

test('damaged credential storage does not fall back to password-only login', () => {
  const context = fixture();
  const { app, properties } = context;
  enrollFirst(context);
  properties.delete('MANAGER_WEBAUTHN_CREDENTIALS_V1');
  assert.throws(() => app.managerLogin('manager', PASSWORD), /設定が見つかりません/);
});

test('registration and assertion enforce challenge, RP hash, user presence, and expiry', () => {
  const context = fixture();
  const { app, cache } = context;
  const key = makeKey();
  const bootstrap = app.managerLogin('manager', PASSWORD);
  let begin = app.beginManagerSecurityKeyEnrollment(bootstrap.token);
  assert.throws(() => app.finishManagerSecurityKeyEnrollment(bootstrap.token, begin.flowId,
    registration(key, begin.publicKey.challenge, 'https://evil.example'), 'bad'), /認証元/);
  begin = app.beginManagerSecurityKeyEnrollment(bootstrap.token);
  app.finishManagerSecurityKeyEnrollment(bootstrap.token, begin.flowId,
    registration(key, begin.publicKey.challenge), 'main');

  let pending = app.managerLogin('manager', PASSWORD);
  assert.throws(() => app.finishManagerSecurityKeyLogin(pending.flowId,
    assertion(key, 'wrong-challenge', 1)), /チャレンジ/);
  pending = app.managerLogin('manager', PASSWORD);
  const badRp = assertion(key, pending.publicKey.challenge, 1);
  const badRpData = Buffer.from(badRp.response.authenticatorData, 'base64url');
  badRpData[0] ^= 1;
  badRp.response.authenticatorData = b64(badRpData);
  assert.throws(() => app.finishManagerSecurityKeyLogin(pending.flowId, badRp), /ドメイン/);
  pending = app.managerLogin('manager', PASSWORD);
  const noTouch = assertion(key, pending.publicKey.challenge, 1);
  const noTouchData = Buffer.from(noTouch.response.authenticatorData, 'base64url');
  noTouchData[32] = 0;
  noTouch.response.authenticatorData = b64(noTouchData);
  assert.throws(() => app.finishManagerSecurityKeyLogin(pending.flowId, noTouch), /操作/);
  pending = app.managerLogin('manager', PASSWORD);
  const keyName = 'manager-webauthn-login:' + pending.flowId;
  const flow = JSON.parse(cache.get(keyName));
  flow.expiresAt = Date.now() - 1;
  cache.set(keyName, JSON.stringify(flow));
  assert.throws(() => app.finishManagerSecurityKeyLogin(pending.flowId,
    assertion(key, pending.publicKey.challenge, 1)), /有効期限/);
});
