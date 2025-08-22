const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
function getenv(name, fallback) {
  const v = typeof process !== 'undefined' && process.env ? process.env[name] : undefined;
  return typeof v === 'string' && v.length > 0 ? v : fallback;
}
function isServer() {
  return typeof window === 'undefined';
}
export function getMailerSendConfig() {
  const token = isServer() ? getenv('MAILERSEND_API_TOKEN') : undefined;
  return {
    token,
    fromEmail: getenv('MAILERSEND_FROM_EMAIL'),
    fromName: getenv('MAILERSEND_FROM_NAME'),
    host: getenv('MAILERSEND_API_HOST', 'https://api.mailersend.com'),
    path: getenv('MAILERSEND_API_PATH', '/v1/email')
  };
}
export function validateMailerSendConfig() {
  const c = getMailerSendConfig();
  const missing = [];
  if (!c.token) missing.push('MAILERSEND_API_TOKEN');
  if (!c.fromEmail) missing.push('MAILERSEND_FROM_EMAIL');
  if (!c.fromName) missing.push('MAILERSEND_FROM_NAME');
  const invalid = [];
  if (c.fromEmail && !EMAIL_RE.test(c.fromEmail)) invalid.push('MAILERSEND_FROM_EMAIL');
  return { ok: missing.length === 0 && invalid.length === 0, missing, invalid, config: c };
}
export function normalizeRecipient(r) {
  if (!r) return null;
  if (typeof r === 'string') return EMAIL_RE.test(r) ? { email: r } : null;
  const email = r.email;
  const name = r.name;
  if (!email || !EMAIL_RE.test(email)) return null;
  return name ? { email, name } : { email };
}
export function normalizeRecipientList(list) {
  if (!list) return [];
  const arr = Array.isArray(list) ? list : [list];
  return arr.map(normalizeRecipient).filter(Boolean);
}
export function buildMailerSendMessage({ to, subject, html, text, replyTo, cc, bcc, variables, tags }) {
  const cfg = getMailerSendConfig();
  const from = { email: cfg.fromEmail, name: cfg.fromName };
  const tos = normalizeRecipientList(to);
  const ccs = normalizeRecipientList(cc);
  const bccs = normalizeRecipientList(bcc);
  const payload = { from, to: tos, subject };
  if (ccs.length) payload.cc = ccs;
  if (bccs.length) payload.bcc = bccs;
  if (text) payload.text = text;
  if (html) payload.html = html;
  if (replyTo) {
    const rt = normalizeRecipient(replyTo);
    if (rt) payload.reply_to = rt;
  }
  if (variables && typeof variables === 'object') payload.variables = variables;
  if (Array.isArray(tags) && tags.length) payload.tags = tags;
  return payload;
}
export function buildMailerSendRequest(message, overrides) {
  const v = validateMailerSendConfig();
  const cfg = v.config;
  const token = overrides && overrides.token ? overrides.token : cfg.token;
  const host = overrides && overrides.host ? overrides.host : cfg.host;
  const path = overrides && overrides.path ? overrides.path : cfg.path;
  return {
    url: `${host}${path}`,
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(message)
  };
}
export function isValidEmail(value) {
  return EMAIL_RE.test(String(value || ''));
}
export function canSendHere() {
  const v = validateMailerSendConfig();
  return isServer() && v.ok;
}
export function prepareMailerSend(input, overrides) {
  if (!canSendHere()) return { ok: false };
  const msg = buildMailerSendMessage(input);
  const req = buildMailerSendRequest(msg, overrides);
  return { ok: true, request: req, message: msg };
}
const EmailUtility = {
  getMailerSendConfig,
  validateMailerSendConfig,
  normalizeRecipient,
  normalizeRecipientList,
  buildMailerSendMessage,
  buildMailerSendRequest,
  isValidEmail,
  isServer,
  canSendHere,
  prepareMailerSend
};
export default EmailUtility;
