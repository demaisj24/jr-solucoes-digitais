const PWNED_RANGE_URL = '/api/pwned-password-range?prefix=';

function bytesToHex(bytes) {
  return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('').toUpperCase();
}

async function sha1Hex(value) {
  const data = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-1', data);
  return bytesToHex(new Uint8Array(digest));
}

/**
 * Checks a password against Have I Been Pwned Pwned Passwords using
 * k-anonymity. The password and full SHA-1 hash never leave the browser.
 * Only the first five hash characters are sent to the VENCIVO proxy.
 *
 * Returns { compromised: boolean, count: number } or throws when the
 * privacy-preserving check is unavailable. Callers fail closed.
 */
export async function checkPwnedPassword(password) {
  if (typeof password !== 'string' || password.length === 0) {
    return { compromised: false, count: 0 };
  }

  const hash = await sha1Hex(password);
  const prefix = hash.slice(0, 5);
  const suffix = hash.slice(5);
  const response = await fetch(`${PWNED_RANGE_URL}${encodeURIComponent(prefix)}`, {
    method: 'GET',
    headers: { 'Accept': 'text/plain' },
    cache: 'no-store',
    credentials: 'same-origin'
  });

  if (!response.ok) {
    throw new Error('Pwned password service unavailable');
  }

  const text = await response.text();
  const line = text.split('\n').find(row => row.trim().toUpperCase().startsWith(`${suffix}:`));
  if (!line) return { compromised: false, count: 0 };

  const [, rawCount] = line.trim().split(':', 2);
  const count = Number.parseInt(rawCount, 10);
  return { compromised: true, count: Number.isFinite(count) ? count : 0 };
}

export function validatePasswordPolicy(password) {
  if (typeof password !== 'string' || password.length < 12) {
    return 'Use pelo menos 12 caracteres.';
  }
  if (!/[a-z]/.test(password)) return 'Inclua pelo menos uma letra minúscula.';
  if (!/[A-Z]/.test(password)) return 'Inclua pelo menos uma letra maiúscula.';
  if (!/[0-9]/.test(password)) return 'Inclua pelo menos um número.';
  if (!/[^A-Za-z0-9]/.test(password)) return 'Inclua pelo menos um símbolo.';
  return '';
}
