/**
 * 凭据管理：读写 ~/.claude/secrets/wps365.json
 * 包含 cookie（用于所有请求）和 csrf（用于块操作）
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

const CRED_FILE = path.join(os.homedir(), '.claude', 'secrets', 'wps365.json');
const STALE_HOURS = 8;

function loadCredentials() {
  try {
    if (fs.existsSync(CRED_FILE)) {
      return JSON.parse(fs.readFileSync(CRED_FILE, 'utf-8'));
    }
  } catch {
    // ignore parse errors
  }
  return null;
}

function saveCredentials(cookie, csrf) {
  const dir = path.dirname(CRED_FILE);
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  const data = { cookie, csrf, updated_at: new Date().toISOString() };
  fs.writeFileSync(CRED_FILE, JSON.stringify(data, null, 2), { encoding: 'utf-8', mode: 0o600 });
  return data;
}

function isStale(creds) {
  if (!creds || !creds.updated_at) return true;
  const age = (Date.now() - new Date(creds.updated_at).getTime()) / (1000 * 60 * 60);
  return age > STALE_HOURS;
}

function getStatus() {
  const creds = loadCredentials();
  if (!creds) return { ok: false, message: '未找到凭据文件，请运行 wps-airpage auth' };
  if (!creds.cookie) return { ok: false, message: '缺少 cookie，请运行 wps-airpage auth' };
  if (!creds.csrf) return { ok: false, message: '缺少 CSRF token，请运行 wps-airpage auth' };
  if (isStale(creds)) {
    return { ok: true, stale: true, message: `凭据已超过 ${STALE_HOURS} 小时，建议刷新（wps-airpage auth --refresh）`, creds };
  }
  return { ok: true, stale: false, message: `凭据有效（更新于 ${creds.updated_at}）`, creds };
}

module.exports = { loadCredentials, saveCredentials, isStale, getStatus, CRED_FILE };
