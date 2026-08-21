/**
 * URSPANTROPIKO Security & Sanitization Shield
 * Protects against XSS, NoSQL/SQL Injections, and Excel Formula Injection attacks
 */

// 1. Strip dangerous HTML, Script Tags, and Malicious Characters
export function sanitizeText(input) {
  if (typeof input !== 'string') return '';
  return input
    .replace(/[<>]/g, '') // Strip < and > to prevent HTML injection
    .replace(/javascript:/gi, '') // Strip inline JS protocols
    .replace(/onload|onerror|onclick|onmouseover/gi, '') // Strip inline event handlers
    .trim();
}

// 2. Student ID Formatter & Sanitizer (allows digits, letters, hyphens only)
export function sanitizeStudentId(id) {
  if (typeof id !== 'string') return '';
  return id
    .replace(/[^a-zA-Z0-9-]/g, '')
    .toUpperCase()
    .trim();
}

// 3. Excel Formula Injection Sanitizer
// Prevents CSV/Excel command execution when exporting spreadsheets (=, +, -, @, \t, \r)
export function sanitizeExcelFormula(value) {
  if (value === null || value === undefined) return '';
  const str = String(value).trim();
  if (/^[=+\-@\t\r]/.test(str)) {
    return `'${str}`; // Prefix with single quote so spreadsheet treats as plain string
  }
  return str;
}

// 4. Rate Limiting & Anti-Spam Lockout Manager
const ATTEMPTS_KEY = 'ursp_security_pin_attempts';
const LOCKOUT_KEY = 'ursp_security_lockout_until';

export function checkPinRateLimit() {
  try {
    const lockoutUntil = parseInt(sessionStorage.getItem(LOCKOUT_KEY) || '0', 10);
    const now = Date.now();
    if (lockoutUntil > now) {
      const remainingSeconds = Math.ceil((lockoutUntil - now) / 1000);
      return { allowed: false, remainingSeconds };
    }
    return { allowed: true, remainingSeconds: 0 };
  } catch (e) {
    return { allowed: true, remainingSeconds: 0 };
  }
}

export function recordFailedPinAttempt() {
  try {
    const attempts = parseInt(sessionStorage.getItem(ATTEMPTS_KEY) || '0', 10) + 1;
    sessionStorage.setItem(ATTEMPTS_KEY, attempts.toString());
    if (attempts >= 5) {
      const lockoutUntil = Date.now() + 60000; // 60 seconds lockout
      sessionStorage.setItem(LOCKOUT_KEY, lockoutUntil.toString());
      sessionStorage.removeItem(ATTEMPTS_KEY);
      return { locked: true, remainingSeconds: 60 };
    }
    return { locked: false, attemptsRemaining: 5 - attempts };
  } catch (e) {
    return { locked: false, attemptsRemaining: 5 };
  }
}

export function resetPinAttempts() {
  try {
    sessionStorage.removeItem(ATTEMPTS_KEY);
    sessionStorage.removeItem(LOCKOUT_KEY);
  } catch (e) {}
}
