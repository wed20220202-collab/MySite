const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = __dirname;
const script = fs.readFileSync(path.join(root, 'staff-webauthn.js'), 'utf8');
const b64url = bytes => Buffer.from(bytes).toString('base64url');

function harness() {
  const calls = [];
  const credential = {
    id: 'credential-id',
    type: 'public-key',
    rawId: Uint8Array.from([1, 2, 3]).buffer,
    response: {
      clientDataJSON: Uint8Array.from([4, 5]).buffer,
      authenticatorData: Uint8Array.from([6, 7]).buffer,
      signature: Uint8Array.from([8, 9]).buffer,
      userHandle: null,
      attestationObject: Uint8Array.from([10, 11]).buffer,
      getTransports: () => ['usb']
    }
  };
  const top = {};
  const window = { top, isSecureContext: true, PublicKeyCredential: function () {} };
  window.self = top;
  const context = {
    window,
    location: { hostname: 'wed20220202-collab.github.io' },
    navigator: { credentials: {
      create: async options => { calls.push(['create', options]); return credential; },
      get: async options => { calls.push(['get', options]); return credential; }
    } },
    Uint8Array,
    atob: value => Buffer.from(value, 'base64').toString('binary'),
    btoa: value => Buffer.from(value, 'binary').toString('base64')
  };
  vm.createContext(context);
  vm.runInContext(script, context, { filename: 'staff-webauthn.js' });
  return { context, calls };
}

test('WebAuthn bridge decodes server challenges and serializes signed response', async () => {
  const { context, calls } = harness();
  const results = [];
  await context.window.ChankoSecurityKey.handle({
    requestId: 'a'.repeat(32), action: 'get',
    publicKey: {
      challenge: b64url([12, 13]), rpId: 'wed20220202-collab.github.io',
      allowCredentials: [{ type: 'public-key', id: b64url([1, 2, 3]) }]
    }
  }, result => results.push(result));
  assert.equal(calls.length, 1);
  assert.deepEqual(Array.from(calls[0][1].publicKey.challenge), [12, 13]);
  assert.deepEqual(Array.from(calls[0][1].publicKey.allowCredentials[0].id), [1, 2, 3]);
  assert.equal(results[0].ok, true);
  assert.equal(results[0].credential.response.signature, b64url([8, 9]));
  assert.equal(results[0].credential.rawId, b64url([1, 2, 3]));
});

test('WebAuthn bridge rejects wrong relying party and iframe context', async () => {
  const { context, calls } = harness();
  const request = {
    requestId: 'b'.repeat(32), action: 'create',
    publicKey: {
      challenge: b64url([1]), rp: { id: 'example.com', name: 'Wrong' },
      user: { id: b64url([2]), name: 'manager', displayName: 'Manager' },
      pubKeyCredParams: [{ type: 'public-key', alg: -7 }]
    }
  };
  const first = [];
  await context.window.ChankoSecurityKey.handle(request, value => first.push(value));
  assert.equal(first[0].ok, false);
  assert.equal(calls.length, 0);
  request.publicKey.rp.id = 'wed20220202-collab.github.io';
  context.window.self = {};
  const second = [];
  await context.window.ChankoSecurityKey.handle(request, value => second.push(value));
  assert.equal(second[0].ok, false);
  assert.equal(calls.length, 0);
});

test('all staff wrappers load first-party WebAuthn bridge', () => {
  for (const name of ['management.html', 'coupon-issue.html', 'coupon-redeem.html']) {
    const html = fs.readFileSync(path.join(root, name), 'utf8');
    assert.match(html, /<script src="staff-webauthn\.js"><\/script>/);
    assert.match(html, /staff-webauthn-request/);
    assert.match(html, /staff-webauthn-response/);
  }
});

test('manager can add a backup key only after existing-key step-up', () => {
  const html = fs.readFileSync(path.join(root, 'ManagementApp.html'), 'utf8');
  assert.match(html, /started\.stepUpRequired/);
  assert.match(html, /requestSecurityKey\('get',started\.publicKey\)/);
  assert.match(html, /completeManagerSecurityKeyEnrollmentStepUp/);
});

test('external QR libraries are version-pinned and integrity protected', () => {
  const expected = new Map([
    ['coupon-redeem.html', {
      url: 'https://unpkg.com/html5-qrcode@2.3.8/html5-qrcode.min.js',
      integrity: 'sha384-c9d8RFSL+u3exBOJ4Yp3HUJXS4znl9f+z66d1y54ig+ea249SpqR+w1wyvXz/lk+'
    }],
    ['coupon-issue-app.html', {
      url: 'https://cdnjs.cloudflare.com/ajax/libs/qrcode/1.4.4/qrcode.min.js',
      integrity: 'sha384-0RsG1yo/crf/1Qc14sho26SXXOTngNCjgJw7fuvXBt9W/OChF/Ijx+aUuBDqQwEk'
    }]
  ]);
  for (const [name, dependency] of expected) {
    const html = fs.readFileSync(path.join(root, name), 'utf8');
    assert.ok(html.includes(`<script src="${dependency.url}" integrity="${dependency.integrity}" crossorigin="anonymous"></script>`));
  }
});
