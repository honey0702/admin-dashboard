/**
 * Form validators shared by the order dialog (and reusable elsewhere).
 * Rules mirror the backend (poster-backend/delivery/serializers.py):
 *  - name:    letters (any script) + spaces only, at least 2 chars — no digits/symbols
 *  - phone:   10-digit Indian mobile, optional +91/91 country code, starts 6–9;
 *             normalized to +91XXXXXXXXXX before saving
 *  - PIN:     optional, but if given must be a 6-digit Indian PIN (starts 1–8)
 *  - address: required (delivery/pickup needs it)
 */

export function validateName(raw) {
  const v = String(raw || '').trim();
  if (!v) return 'Customer name is required.';
  if (v.length < 2) return 'Name is too short.';
  if (!/^[\p{L} ]+$/u.test(v)) return 'Name can contain letters and spaces only — no numbers or symbols.';
  return '';
}

export function normalizePhone(raw) {
  const cleaned = String(raw || '').replace(/[\s-]/g, '');
  const m = cleaned.match(/^(?:\+?91)?([6-9]\d{9})$/);
  if (!m) {
    return { ok: false, value: cleaned, error: 'Enter a valid 10-digit mobile number (with +91 country code), starting with 6–9.' };
  }
  return { ok: true, value: `+91${m[1]}`, error: '' };
}

export function validatePhone(raw) {
  const r = normalizePhone(raw);
  return r.ok ? '' : (r.error || 'Enter a valid mobile number.');
}

/** Keep only what a phone field may contain: digits and a single leading +. */
export function sanitizePhoneInput(raw) {
  let v = String(raw || '').replace(/[^\d+]/g, '');
  if (v.indexOf('+') > 0) v = v.replace(/\+/g, '');
  if (!v.startsWith('+')) v = v.replace(/\+/g, '');
  return v.slice(0, 13); // +91 + 10 digits
}

export function validatePin(raw) {
  const v = String(raw || '').trim();
  if (!v) return ''; // optional
  if (!/^[1-8]\d{5}$/.test(v)) return 'PIN code must be 6 digits and start with 1–8.';
  return '';
}

export function validateAddress(raw) {
  const v = String(raw || '').trim();
  if (!v) return 'Address is required — building, society or landmark.';
  if (v.length < 3) return 'Address is too short.';
  return '';
}
