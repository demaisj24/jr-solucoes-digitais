const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const source = fs.readFileSync(path.join(__dirname, '..', 'password-security.js'), 'utf8');

function policy(password) {
  if (password.length < 12) return false;
  if (!/[a-z]/.test(password)) return false;
  if (!/[A-Z]/.test(password)) return false;
  if (!/[0-9]/.test(password)) return false;
  if (!/[^A-Za-z0-9]/.test(password)) return false;
  return true;
}

test('SEC-16: password policy requires 12+ chars and mixed character classes', () => {
  assert.equal(policy('Abc123!xyz45'), true);
  assert.equal(policy('Abc123!xyz4'), false);
  assert.equal(policy('abcdefghijkL1!'), true);
  assert.equal(policy('abcdefghijk123!'), false);
  assert.equal(policy('ABCDEFGHIJK1!'), false);
  assert.equal(policy('Abcdefghijk!!'), false);
});

test('SEC-16: leaked-password module uses HIBP k-anonymity', () => {
  assert.match(source, /api\.pwnedpasswords\.com\/range\//);
  assert.match(source, /hash\.slice\(0, 5\)/);
  assert.match(source, /hash\.slice\(5\)/);
  assert.doesNotMatch(source, /X-Api-Key|hibp-api-key/i);
});

test('SEC-16: password is hashed locally before the HIBP request', () => {
  const hashIndex = source.indexOf('sha1Hex(password)');
  const requestIndex = source.indexOf('fetch(`${HIBP_RANGE_URL}${prefix}');
  assert.ok(hashIndex >= 0);
  assert.ok(requestIndex > hashIndex);
  assert.match(source, /crypto\.subtle\.digest\('SHA-1'/);
});

test('SEC-16: no password logging or full-hash transmission is present', () => {
  assert.doesNotMatch(source, /console\.(log|info|warn|error)\([^\n]*password/i);
  assert.doesNotMatch(source, /fetch\([^\n]*password[^\n]*HIBP_RANGE_URL/i);
});

test('SEC-16: signup and password reset import the shared password security module', () => {
  const conta = fs.readFileSync(path.join(__dirname, '..', 'conta.html'), 'utf8');
  const reset = fs.readFileSync(path.join(__dirname, '..', 'redefinir-senha.html'), 'utf8');
  assert.match(conta, /\.\/password-security\.js/);
  assert.match(reset, /\.\/password-security\.js/);
  assert.match(conta, /checkPwnedPassword\(password\)/);
  assert.match(reset, /checkPwnedPassword\(p\)/);
});
