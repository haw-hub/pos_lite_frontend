/**
 * Client-side input helpers improve usability. Server-side validation remains
 * the security boundary, because a client can always be bypassed.
 */
export const sanitizePlainText = (value: string, maxLength = 255) => value
  .replace(/[<>]/g, '')
  .replace(/[\u0000-\u001F\u007F]/g, '')
  .replace(/\b(?:javascript|vbscript)\s*:/gi, '')
  .slice(0, maxLength);

export const sanitizeUsername = (value: string) => value
  .replace(/[^a-zA-Z0-9._-]/g, '')
  .slice(0, 50);

export const sanitizeDigits = (value: string, maxLength = 15) => value
  .replace(/\D/g, '')
  .slice(0, maxLength);
