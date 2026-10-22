const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const pages = [
  'management.html', 'ManagementApp.html',
  'coupon-issue.html', 'coupon-issue-app.html',
  'coupon-redeem.html', 'coupon-redeem-app.html'
];

test('all staff pages contain syntactically valid inline JavaScript', () => {
  for (const name of pages) {
    const html = fs.readFileSync(path.join(__dirname, name), 'utf8');
    const scripts = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)];
    assert.ok(scripts.length > 0, name);
    for (const [, source] of scripts) {
      assert.doesNotThrow(() => new vm.Script(source, { filename: name }), name);
    }
  }
});

test('staff pages restore tokens from tab storage and keep role-specific endpoints', () => {
  for (const name of ['management.html', 'coupon-issue.html', 'coupon-redeem.html']) {
    const html = fs.readFileSync(path.join(__dirname, name), 'utf8');
    assert.match(html, /sessionStorage/, name);
    assert.doesNotMatch(html, /localStorage/, name);
  }
  const management = fs.readFileSync(path.join(__dirname, 'ManagementApp.html'), 'utf8');
  const issue = fs.readFileSync(path.join(__dirname, 'coupon-issue-app.html'), 'utf8');
  const redeem = fs.readFileSync(path.join(__dirname, 'coupon-redeem-app.html'), 'utf8');
  assert.match(management, /managementLogin/);
  assert.match(management, /getManagementData/);
  assert.match(management, /閲覧専用デモ/);
  assert.match(issue, /issueLogin/);
  assert.match(issue, /restoreIssueSession/);
  assert.match(redeem, /redeemLogin/);
  assert.match(redeem, /restoreRedeemSession/);
  assert.match(redeem, /lookupCouponForStaff/);
  assert.match(redeem, /redeemCouponByStaff/);
});
