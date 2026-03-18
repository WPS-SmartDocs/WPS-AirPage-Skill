#!/usr/bin/env node
/**
 * WPS AirPage 浏览器鉴权助手（全自动版）
 *
 * 用法: node scripts/auth-browser.js
 *       wps-airpage auth --browser
 *
 * 流程（无需用户手动导航）：
 *   1. 打开浏览器，跳转到 365.kdocs.cn 登录页
 *   2. 用户完成账号登录（扫码或输入密码）
 *   3. 自动检测登录完成
 *   4. 自动调用文件列表 API，取第一个 AirPage 文档并导航到编辑页
 *   5. 自动提取 CSRF token 和完整 Cookie
 *   6. 写入 ~/.claude/secrets/wps365.json
 */

'use strict';

const { execSync } = require('child_process');
const path = require('path');
const skillDir = path.resolve(__dirname, '..');

function ensurePlaywright() {
  let chromiumReady = false;
  try {
    require.resolve('playwright');
    const { chromium } = require('playwright');
    const exePath = chromium.executablePath();
    chromiumReady = exePath && require('fs').existsSync(exePath);
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

/**
 * 从 context cookies 拼接请求 Header 格式的 cookie 字符串
 */
function buildCookieStr(cookies) {
  return cookies
    .filter(c => c.domain.includes('kdocs.cn') || c.domain.includes('wps.cn'))
    .map(c => `${c.name}=${c.value}`)
    .join('; ');
}

/**
 * 用已有 cookie 调用文件搜索 API，返回第一个 AirPage 文档的 file_id
 * 搜索 API 只需 cookie，不需要 CSRF
 */
async function findFirstDocId(cookieStr) {
  const url = 'https://365.kdocs.cn/3rd/drive/api/v6/search/files?offset=0&count=5&sort_by=modify_time&order=desc&searchname=';
  const res = await fetch(url, { headers: { Cookie: cookieStr } });
  const data = await res.json();
  const files = data.files || [];
  // 优先取 AirPage 类型（type=23 或 ext=otl），否则取第一个
  const airpage = files.find(f => f.ext === 'otl' || f.type === 23);
  return (airpage || files[0])?.id ?? null;
}

async function main() {
  ensurePlaywright();

  const { chromium } = require('playwright');
  const { saveCredentials, CRED_FILE } = require('./credentials');

  console.log('\n=== WPS AirPage 自动鉴权 ===\n');
  console.log('正在打开浏览器，请完成 WPS 账号登录...\n');

  let browser;
  try {
    browser = await chromium.launch({ headless: false, args: ['--no-sandbox'] });
  } catch (e) {
    console.error('浏览器启动失败:', e.message);
    console.error('请尝试: npx playwright install chromium');
    process.exit(1);
  }

  const context = await browser.newContext();
  const page = await context.newPage();

  page.on('crash', () => { console.error('页面崩溃，请重试'); process.exit(1); });

  // ── 步骤 1：打开登录页 ───────────────────────────────────
  await page.goto('https://365.kdocs.cn');

  // ── 步骤 2：等待登录完成 ────────────────────────────────
  // 检测标志：URL 离开登录页，且 document.cookie 里含有登录态 cookie
  console.log('等待登录完成（最多 5 分钟）...');
  try {
    await page.waitForFunction(
      () => {
        // 登录后 URL 会跳转到 /latest 或 /l/... 页面
        const notLoginPage = !location.href.includes('/login') &&
                             !location.href.includes('/sso') &&
                             location.hostname.includes('kdocs.cn');
        // 检测登录态（多路径兜底）：
        // 1. window.__userId / window.__WPSENV__.uid（部分页面有）
        // 2. document.cookie 里含有 uid=（/latest 页面已登录时只有 cookie 有 uid）
        const hasSession = !!(
          window.__userId ||
          window.__WPSENV__?.uid ||
          /(?:^|;\s*)uid=\d+/.test(document.cookie)
        );
        return notLoginPage && hasSession;
      },
      { timeout: 5 * 60 * 1000, polling: 1500 }
    );
  } catch (e) {
    const msg = e.message?.includes('Timeout') ? '等待超时（5 分钟内未检测到登录完成）' : e.message;
    console.error(`\n登录检测失败: ${msg}`);
    await browser.close();
    process.exit(1);
  }
  console.log('✓ 检测到登录完成\n');

  // ── 步骤 3：获取登录后的 cookie，调用 API 找文档 ────────
  const cookiesAfterLogin = await context.cookies();
  const partialCookieStr = buildCookieStr(cookiesAfterLogin);

  let fileId = null;
  console.log('正在查找可用文档...');
  try {
    fileId = await findFirstDocId(partialCookieStr);
  } catch (e) {
    console.warn('文档查找失败（将使用首页提取 CSRF）:', e.message);
  }

  // ── 步骤 4：导航到编辑页 ────────────────────────────────
  if (fileId) {
    console.log(`找到文档 ID: ${fileId}，正在导航到编辑页...`);
    await page.goto(`https://365.kdocs.cn/l/doc/${fileId}`, { timeout: 30000 }).catch(() => {});
  } else {
    console.log('未找到文档，尝试从当前页面提取 CSRF...');
  }

  // ── 步骤 5：等待 CSRF token ──────────────────────────────
  console.log('等待编辑器加载（最多 60 秒）...');
  try {
    await page.waitForFunction(
      () => typeof window.__WPSENV__?.csrf_token === 'string' && window.__WPSENV__.csrf_token.length > 10,
      { timeout: 60 * 1000, polling: 1000 }
    );
  } catch {
    // CSRF 不可用时兜底：直接用 homepage 上可能存在的 CSRF
    console.warn('编辑页未加载 CSRF，尝试兜底提取...');
  }

  const csrf = await page.evaluate(() => window.__WPSENV__?.csrf_token ?? '').catch(() => '');

  // ── 步骤 6：提取完整 Cookie ──────────────────────────────
  const allCookies = await context.cookies();
  const cookieStr = buildCookieStr(allCookies);

  await browser.close();

  if (!cookieStr) {
    console.error('提取失败：cookie 为空');
    process.exit(1);
  }
  if (!csrf) {
    console.warn('⚠️  未获取到 CSRF token，块写操作将不可用（只读操作不受影响）');
    console.warn('   可在浏览器打开任意 AirPage 编辑页后重新运行 auth --browser');
  }

  saveCredentials(cookieStr, csrf);

  console.log(`\n✓ 凭据已保存: ${CRED_FILE}`);
  console.log(`  cookie 长度: ${cookieStr.length} 字符`);
  if (csrf) console.log(`  csrf 前缀:   ${csrf.substring(0, 20)}...`);
  console.log('\n现在可以运行 wps-airpage 命令了。');
}

main().catch(err => {
  console.error('错误:', err.message);
  process.exit(1);
});
