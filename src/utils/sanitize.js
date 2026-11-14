/**
 * Input sanitization utility to protect against Cross-Site Scripting (XSS),
 * HTML injection, and malicious input vectors in client forms.
 */

/**
 * Strips HTML tags, script elements, javascript: protocols, and dangerous characters.
 * @param {string} input - Raw user input
 * @returns {string} Sanitized string
 */
export function sanitizeText(input) {
  if (typeof input !== 'string') return input;
  
  return input
    // Remove control characters (except newline, tab, carriage return)
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    // Remove script tags and contents
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    // Strip HTML tags
    .replace(/<[^>]*>/g, '')
    // Neutralize javascript: pseudo-protocol
    .replace(/javascript:/gi, '')
    // Trim leading and trailing whitespace
    .trim();
}

/**
 * Sanitizes all string values within an object recursively.
 * @param {Object} obj - Form or payload object
 * @returns {Object} Sanitized object copy
 */
export function sanitizeObject(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(sanitizeObject);

  const sanitized = {};
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string') {
      sanitized[key] = sanitizeText(value);
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeObject(value);
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
}

/**
 * Validates register number format to prevent injection in path parameters.
 * @param {string} regNo
 * @returns {boolean}
 */
export function isValidRegNo(regNo) {
  if (!regNo || typeof regNo !== 'string') return false;
  // Alphanumeric with optional dashes/dots, 3-20 characters
  return /^[A-Za-z0-9_.-]{3,25}$/.test(regNo.trim());
}

