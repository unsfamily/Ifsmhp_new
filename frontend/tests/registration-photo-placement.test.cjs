const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const source = fs.readFileSync(path.join(__dirname, '../src/pages/auth/RegisterPage.tsx'), 'utf8');
const personal = source.slice(0, source.indexOf('Document Upload'));
const documents = source.slice(source.indexOf('Document Upload'));

test('registration photograph sits beside the organization field', () => {
  const organization = personal.indexOf('Type of Professional Organization / Independent Professionals');
  const photo = personal.indexOf('id="registration-photo"');
  assert.ok(organization > 0, 'organization field is in the personal section');
  assert.ok(photo > organization, 'photograph input follows the organization field');
  assert.equal(source.split('id="registration-photo"').length - 1, 1);
  assert.match(personal, /documentSlots\.filter\(\(slot\) => slot\.kind === 'PHOTO'\)/);
  assert.match(personal, /htmlFor="registration-photo"/);
});

test('document row keeps CV and credentials and leaves the photograph out', () => {
  assert.match(documents, /documentSlots\.filter\(\(slot\) => slot\.kind !== 'PHOTO'\)/);
  assert.doesNotMatch(documents, /id="registration-photo"/);
  assert.match(source, /kind: 'CV'/);
  assert.match(source, /kind: 'CREDENTIAL'/);
  assert.match(source, /kind: 'PHOTO'/);
});
