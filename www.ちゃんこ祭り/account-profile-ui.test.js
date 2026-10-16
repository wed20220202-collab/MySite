const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

for (const name of ['ManagementApp.html', 'coupon-issue-app.html', 'coupon-redeem-app.html']) {
  test(`${name} has a secure, usable profile editor and visible logout`, () => {
    const html = fs.readFileSync(path.join(__dirname, name), 'utf8');
    const scripts = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)];
    for (const [, source] of scripts) assert.doesNotThrow(() => new vm.Script(source, { filename: name }));

    for (const id of ['profileAvatar', 'profileName', 'profileEditButton', 'logoutButton',
      'profileDialog', 'profileFile', 'profileCanvas', 'profileZoom', 'profileSave',
      'profileRemove', 'profileError']) {
      assert.match(html, new RegExp(`id="${id}"`), `${name}: ${id}`);
    }
    for (const method of ['getAccountProfile', 'saveAccountProfileImage', 'removeAccountProfileImage']) {
      assert.match(html, new RegExp(method), `${name}: ${method}`);
    }
    assert.match(html, /data\.length<43000/, `${name}: compressed image must fit spreadsheet storage`);
    assert.match(html, /image\/webp/, `${name}: use modern image compression`);
    assert.match(html, /image\/jpeg/, `${name}: provide JPEG fallback`);
    assert.doesNotMatch(html, /localStorage/, `${name}: profile images are not stored in browser storage`);
  });
}
