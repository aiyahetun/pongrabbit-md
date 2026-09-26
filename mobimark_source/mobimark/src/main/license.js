'use strict'

const fs = require('fs')
const os = require('os')
const path = require('path')
const crypto = require('crypto')

/** 商品页地址在 src/shared/stores.json，不放在验签模块里。 */
const PRODUCT = 'pongrabbit-md'
const LICENSE_LINE = 1
const TRIAL_DAYS = 14
const TOKEN_PREFIX = 'PRMD1'

/** 下一版要作废的完整授权码。离线包只能在发新版本时生效。 */
const REVOKED = []

const PUBLIC_KEY_PEM = fs.readFileSync(path.join(__dirname, 'license-public.pem'), 'utf8')

let stateDirOverride = null
let publicKeyOverride = null

function stateDir () {
  return stateDirOverride || path.join(os.homedir(), '.pongrabbit-md')
}

function stateFile () {
  return path.join(stateDir(), 'license-state.json')
}

/** 自检用，正式启动不要调用。 */
function setStateDirForTests (dir) {
  stateDirOverride = dir || null
}

/** 自检用：临时公钥，正式启动不要调用。 */
function setPublicKeyPemForTests (pem) {
  publicKeyOverride = pem || null
}

function publicKeyPem () {
  return publicKeyOverride || PUBLIC_KEY_PEM
}

function localISODate (d = new Date()) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function parseISODate (s) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s || '')) return null
  const [y, m, d] = s.split('-').map(Number)
  if (m < 1 || m > 12 || d < 1 || d > 31) return null
  return Date.UTC(y, m - 1, d)
}

/** 含起始日在内可用 TRIAL_DAYS 天。第 15 天起 daysLeft <= 0。 */
function daysRemaining (start, today) {
  const a = parseISODate(start)
  const b = parseISODate(today)
  if (a == null || b == null) return TRIAL_DAYS
  const diff = Math.round((b - a) / 86400000)
  return TRIAL_DAYS - diff
}

function b64urlEncode (buf) {
  return Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

function b64urlDecode (s) {
  const pad = s.length % 4 === 0 ? '' : '='.repeat(4 - (s.length % 4))
  return Buffer.from(String(s).replace(/-/g, '+').replace(/_/g, '/') + pad, 'base64')
}

function canonicalPayload (email, iat) {
  return JSON.stringify({
    email: String(email).trim().toLowerCase(),
    iat,
    line: LICENSE_LINE,
    product: PRODUCT
  })
}

function normalizeToken (token) {
  return String(token || '').replace(/\s+/g, '')
}

function verifyToken (token) {
  const compact = normalizeToken(token)
  if (!compact) return { ok: false, error: 'empty' }
  if (REVOKED.includes(compact)) return { ok: false, error: 'revoked' }
  const parts = compact.split('.')
  if (parts.length !== 3 || parts[0] !== TOKEN_PREFIX) {
    return { ok: false, error: 'bad-format' }
  }
  let payload
  let sig
  try {
    payload = b64urlDecode(parts[1])
    sig = b64urlDecode(parts[2])
  } catch (_) {
    return { ok: false, error: 'bad-format' }
  }
  const valid = crypto.verify(null, payload, publicKeyPem(), sig)
  if (!valid) return { ok: false, error: 'bad-signature' }
  let data
  try {
    data = JSON.parse(payload.toString('utf8'))
  } catch (_) {
    return { ok: false, error: 'bad-signature' }
  }
  if (!data || data.product !== PRODUCT) return { ok: false, error: 'bad-product' }
  if (data.line !== LICENSE_LINE) return { ok: false, error: 'bad-line' }
  if (typeof data.email !== 'string' || !data.email.includes('@')) return { ok: false, error: 'bad-signature' }
  return { ok: true, email: data.email, token: compact }
}

function signLicense (email, privateKeyPem, iat = localISODate()) {
  const normalized = String(email || '').trim().toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
    throw new Error('bad-email')
  }
  const payload = Buffer.from(canonicalPayload(normalized, iat), 'utf8')
  const sig = crypto.sign(null, payload, privateKeyPem)
  return `${TOKEN_PREFIX}.${b64urlEncode(payload)}.${b64urlEncode(sig)}`
}

function emptyState () {
  return { trialStarted: '', license: '', exportReminded: false }
}

function readState () {
  try {
    const raw = JSON.parse(fs.readFileSync(stateFile(), 'utf8'))
    if (!raw || typeof raw !== 'object') return emptyState()
    return {
      trialStarted: typeof raw.trialStarted === 'string' ? raw.trialStarted : '',
      license: typeof raw.license === 'string' ? raw.license : '',
      exportReminded: !!raw.exportReminded
    }
  } catch (e) {
    if (e && e.code !== 'ENOENT') console.error('[license] state unreadable', e.message)
    return emptyState()
  }
}

function writeState (state) {
  fs.mkdirSync(stateDir(), { recursive: true })
  fs.writeFileSync(stateFile(), JSON.stringify(state, null, 2), 'utf8')
}

function ensureTrial (state, today) {
  if (parseISODate(state.trialStarted) == null) {
    state.trialStarted = today
    state.exportReminded = false
    writeState(state)
  }
  return state
}

function getStatus (options = {}) {
  const today = options.today || localISODate()
  const consumeReminder = options.consumeReminder !== false
  const state = ensureTrial(readState(), today)
  const verified = state.license ? verifyToken(state.license) : null
  const licensed = !!(verified && verified.ok)
  const daysLeft = daysRemaining(state.trialStarted, today)
  let shouldRemind = false
  if (consumeReminder && !licensed && daysLeft > 0 && daysLeft <= 3 && !state.exportReminded) {
    state.exportReminded = true
    writeState(state)
    shouldRemind = true
  }
  return {
    licensed,
    email: licensed ? verified.email : '',
    daysLeft: licensed ? null : daysLeft,
    unlocked: licensed || daysLeft > 0,
    trialStarted: state.trialStarted,
    shouldRemind,
    trialDays: TRIAL_DAYS
  }
}

function activate (token) {
  const verified = verifyToken(token)
  if (!verified.ok) return verified
  const state = ensureTrial(readState(), localISODate())
  state.license = verified.token
  writeState(state)
  return { ok: true, email: verified.email }
}

module.exports = {
  PRODUCT,
  LICENSE_LINE,
  TRIAL_DAYS,
  daysRemaining,
  verifyToken,
  signLicense,
  getStatus,
  activate,
  setStateDirForTests,
  setPublicKeyPemForTests,
  localISODate
}
