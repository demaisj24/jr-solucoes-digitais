const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const source = fs.readFileSync(path.join(__dirname, '..', 'password-security.js'), 'utf8');
const proxy = fs.readFileSync(path.join(__dirname, '..', 'api', 'pwned-password-range.js'), 'utf8');

function policy(password) {
  return typeof password === 'string' && password.length >= 8;
}

test('SEC-16: password policy requires 8+ characters without composition rules', () => {
  assert.equal(policy('12345678'), true);
  assert.equal(policy('abcdefgh'), true);
  assert.equal(policy('Abc123!x'), true);
  assert.equal(policy('abcdefg'), false);
  assert.equal(policy('1234567'), false);
});

test('SEC-16: shared policy implementation is 8+ only', () => {
  assert.match(source, /password\.length < 8/);
  assert.doesNotMatch(source, /password\.length < 12/);
  assert.doesNotMatch(source, /\[a-z\]/);
  assert.doesNotMatch(source, /\[A-Z\]/);
  assert.doesNotMatch(source, /\[0-9\]/);
});

test('SEC-16: browser sends only a 5-character hash prefix to the VENCIVO proxy', () => {
  assert.match(source, /PWNED_RANGE_URL/);
  assert.match(source, /hash\.slice\(0, 5\)/);
  assert.match(source, /hash\.slice\(5\)/);
  assert.match(source, /encodeURIComponent\(prefix\)/);
  assert.doesNotMatch(source, /api\.pwnedpasswords\.com/i);
});

test('SEC-16: password is hashed locally before the proxy request', () => {
  const hashIndex = source.indexOf('sha1Hex(password)');
  const requestIndex = source.indexOf('fetch(`${PWNED_RANGE_URL}${encodeURIComponent(prefix)}`');
  assert.ok(hashIndex >= 0);
  assert.ok(requestIndex > hashIndex);
  assert.match(source, /crypto\.subtle\.digest\('SHA-1'/);
});

test('SEC-16: proxy calls HIBP with padding and an identifying User-Agent', () => {
  assert.match(proxy, /https:\/\/api\.pwnedpasswords\.com\/range/);
  assert.match(proxy, /'User-Agent':'VENCIVO Password Security'/);
  assert.match(proxy, /'Add-Padding':'true'/);
  assert.match(proxy, /rate_limit_hit/);
  assert.match(proxy, /p_limit:LIMIT/);
});

test('SEC-16: no password logging or full-hash transmission is present', () => {
  assert.doesNotMatch(source, /console\.(log|info|warn|error)\([^\n]*password/i);
  assert.doesNotMatch(source, /password[^\n]*fetch\(/i);
});

test('SEC-16: signup and password reset import the shared password security module', () => {
  const conta = fs.readFileSync(path.join(__dirname, '..', 'conta.html'), 'utf8');
  const reset = fs.readFileSync(path.join(__dirname, '..', 'redefinir-senha.html'), 'utf8');
  assert.match(conta, /\.\/password-security\.js/);
  assert.match(reset, /\.\/password-security\.js/);
  assert.match(conta, /checkPwnedPassword\(password\)/);
  assert.match(reset, /checkPwnedPassword\(p\)/);
});

test('SEC-16: UI policy text does not require 12 characters or character classes', () => {
  const conta = fs.readFileSync(path.join(__dirname, '..', 'conta.html'), 'utf8');
  const reset = fs.readFileSync(path.join(__dirname, '..', 'redefinir-senha.html'), 'utf8');
  assert.match(conta, /minlength="8"/);
  assert.match(conta, /Mínimo: 8 caracteres/);
  assert.doesNotMatch(conta, /Mínimo: 12 caracteres/);
  assert.match(reset, /minlength="8"/);
  assert.match(reset, /pelo menos 8 caracteres/i);
  assert.doesNotMatch(reset, /pelo menos 12 caracteres/i);
  assert.doesNotMatch(reset, /letras maiúsculas e minúsculas, número e símbolo/i);
});

test('SEC-16: subscription cancel route remains unchanged', () => {
  const conta = fs.readFileSync(path.join(__dirname, '..', 'conta.html'), 'utf8');
  assert.match(conta, /fetch\('\/api\/subscription-cancel'/);
  assert.doesNotMatch(conta, /subscription-cancel\.js/);
});
