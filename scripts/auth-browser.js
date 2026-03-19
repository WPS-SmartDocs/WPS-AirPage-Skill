#!/usr/bin/env node
/**
 * WPS AirPage 浏览器鉴权助手（静默优先版）
 *
 * 用法: node scripts/auth-browser.js
 *       wps-airpage auth --browser
 *
 * 流程：
 *   1. 用持久化 Playwright profile（~/.claude/secrets/wps-airpage-profile/）无头启动
 *   2. 检查是否已登录：
 *      - 是 → 静默提取 cookie + CSRF，保存，退出（用户无感知）
 *      - 否 → 关闭无头，改用有头浏览器弹出给用户登录
 *   3. 有头登录后，将 session 保存到 profile，下次自动静默
 */

'use strict';

const { execSync } = require('child_process');
const path = require('path');
const os = require('os');
const fs = require('fs');
const skillDir = path.resolve(__dirname, '..');

// 持久化 profile 路径（存储 session，避免重复登录）
const PROFILE_DIR = path.join(os.homedir(), '.claude', 'secrets', 'wps-airpage-profile');

function ensurePlaywright() {
  let chromiumReady = false;
  try {
    require.resolve('playwright');
    const { chromium } = require('playwright');
    const exePath = chromium.executablePath();
    chromiumReady = exePath && fs.existsSync(exePath);
  } catch { /* 未安装 */ }

  if (!chromiumReady) {
    try { require.resolve('playwright'); } catch {
      console.log('未检测到 playwright，正在安装...');
      execSync('npm install playwright --no-save', { cwd: skillDir, stdio: 'inherit' });
    }
    console.log('正在下载 Chromium（约 150MB，仅首次需要）...');
    execSync('npx playwright install chromium', { cwd: skillDir, stdio: 'inherit' });
    console.log('Chromium 下载完成。\n');
  }
}

function buildCookieStr(cookies) {
  return cookies
    .filter(c => c.domain.includes('kdocs.cn') || c.domain.includes('wps.cn'))
    .map(c => `${c.name}=${c.value}`)
    .join('; ');
}

async function findFirstDocId(cookieStr) {
  const url = 'https://365.kdocs.cn/3rd/drive/api/v6/search/files?offset=0&count=5&sort_by=modify_time&order=desc&searchname=';
  const res = await fetch(url, { headers: { Cookie: cookieStr } });
  const data = await res.json();
  const files = data.files || [];
  const airpage = files.find(f => f.ext === 'otl' || f.type === 23);
  return (airpage || files[0])?.id ?? null;
}

const LOGIN_CHECK = () => !!(
  window.__userId ||
  window.__WPSENV__?.uid ||
  /(?:^|;\s*)uid=\d+/.test(document.cookie)
);

const CSRF_CHECK = () =>
  (typeof window.__WPSENV__?.csrf_token === 'string' && window.__WPSENV__.csrf_token.length > 10)
    ? window.__WPSENV__.csrf_token
    : null;

/**
 * 尝试用已有 profile 静默提取凭据
 * @returns {{ cookie, csrf } | null} null 表示未登录
 */
async function trySilent(chromium) {
  const context = await chromium.launchPersistentContext(PROFILE_DIR, {
    headless: true,
    args: ['--no-sandbox'],
  });
  const page = await context.newPage();

  try {
    await page.goto('https://365.kdocs.cn/latest', { timeout: 20000, waitUntil: 'domcontentloaded' });

    const loggedIn = await page.evaluate(LOGIN_CHECK).catch(() => false);
    if (!loggedIn) {
      await context.close();
      return null;
    }

    // 已登录 → 静默找文档并拿 CSRF
    const cookies0 = await context.cookies();
    const partialCookie = buildCookieStr(cookies0);
    const fileId = await findFirstDocId(partialCookie).catch(() => null);

    if (fileId) {
      await page.goto(`https://365.kdocs.cn/office/o/${fileId}`, { timeout: 30000, waitUntil: 'domcontentloaded' });
      // 等 CSRF（最多 30s）
      const csrf = await page.waitForFunction(CSRF_CHECK, { timeout: 30000, polling: 1000 })
        .then(h => h.jsonValue())
        .catch(() => null);
      const allCookies = await context.cookies();
      await context.close();
      return { cookie: buildCookieStr(allCookies), csrf: csrf || '' };
    }

    const allCookies = await context.cookies();
    await context.close();
    return { cookie: buildCookieStr(allCookies), csrf: '' };

  } catch {
    await context.close().catch(() => {});
    return null;
  }
}

/**
 * 有头浏览器登录流程（用户需要扫码/输入密码）
 */
async function loginHeaded(chromium) {
  console.log('\n请在弹出的浏览器窗口中完成 WPS 账号登录（扫码或密码均可）。');
  console.log('登录完成后无需任何操作，程序将自动提取凭据。\n');

  const context = await chromium.launchPersistentContext(PROFILE_DIR, {
    headless: false,
    args: ['--no-sandbox'],
  });
  const page = await context.newPage();

  await page.goto('https://365.kdocs.cn');

  // 等待登录完成（最多 5 分钟）
  try {
    await page.waitForFunction(LOGIN_CHECK, { timeout: 5 * 60 * 1000, polling: 1500 });
  } catch {
    console.error('\n等待登录超时（5 分钟）。');
    await context.close();
    process.exit(1);
  }
  console.log('✓ 检测到登录完成，正在提取凭据...\n');

  const cookies0 = await context.cookies();
  const partialCookie = buildCookieStr(cookies0);
  const fileId = await findFirstDocId(partialCookie).catch(() => null);

  if (fileId) {
    await page.goto(`https://365.kdocs.cn/office/o/${fileId}`, { timeout: 30000, waitUntil: 'domcontentloaded' }).catch(() => {});
    await page.waitForFunction(CSRF_CHECK, { timeout: 60000, polling: 1000 }).catch(() => {});
  }

  const csrf = await page.evaluate(() => window.__WPSENV__?.csrf_token ?? '').catch(() => '');
  const allCookies = await context.cookies();
  await context.close();

  return { cookie: buildCookieStr(allCookies), csrf };
}

async function main() {
  ensurePlaywright();
  const { chromium } = require('playwright');
  const { saveCredentials, CRED_FILE } = require('./credentials');

  fs.mkdirSync(PROFILE_DIR, { recursive: true, mode: 0o700 });

  // ── 先尝试静默模式 ────────────────────────────────────
  process.stdout.write('正在检查登录状态...');
  const silent = await trySilent(chromium);

  let result;
  if (silent) {
    process.stdout.write(' 已登录，静默提取凭据。\n');
    result = silent;
  } else {
    process.stdout.write(' 未登录，弹出浏览器。\n');
    result = await loginHeaded(chromium);
  }

  const { cookie, csrf } = result;

  if (!cookie) {
    console.error('提取失败：cookie 为空');
    process.exit(1);
  }
  if (!csrf) {
    console.warn('⚠️  未获取到 CSRF token，块写操作将不可用');
    console.warn('   可在浏览器打开任意 AirPage 编辑页后重新运行 auth --browser');
  }

  saveCredentials(cookie, csrf);
  console.log(`\n✓ 凭据已保存: ${CRED_FILE}`);
  console.log(`  cookie 长度: ${cookie.length} 字符`);
  if (csrf) console.log(`  csrf 前缀:   ${csrf.substring(0, 20)}...`);
  console.log('\n现在可以运行 wps-airpage 命令了。');
}

main().catch(err => {
  console.error('错误:', err.message);
  process.exit(1);
});
