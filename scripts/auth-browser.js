#!/usr/bin/env node
/**
 * WPS AirPage 浏览器鉴权助手
 *
 * 用法: node scripts/auth-browser.js
 *
 * 功能：启动可见 Chrome 窗口，等待用户登录并打开 AirPage 文档编辑页，
 *       自动提取完整 Cookie（含 HttpOnly 的 wps_sid）和 CSRF token，
 *       写入 ~/.claude/secrets/wps365.json。
 *
 * 依赖: playwright（可选，首次运行自动安装）
 *   npm install --save-optional playwright
 *   npx playwright install chromium
 */

'use strict';

const { execSync } = require('child_process');
const path = require('path');
const skillDir = path.resolve(__dirname, '..');

// 检查并安装 playwright
function ensurePlaywright() {
  try {
    require.resolve('playwright');
  } catch {
    console.log('未检测到 playwright，正在安装（约 300MB，仅首次需要）...');
    execSync('npm install playwright --no-save', { cwd: skillDir, stdio: 'inherit' });
    // 安装 chromium 浏览器
    execSync('npx playwright install chromium', { cwd: skillDir, stdio: 'inherit' });
    console.log('playwright 安装完成。\n');
  }
}

async function main() {
  ensurePlaywright();

  const { chromium } = require('playwright');
  const { saveCredentials, CRED_FILE } = require('./credentials');

  console.log('\n=== WPS AirPage 鉴权助手 ===\n');

  const browser = await chromium.launch({
    headless: false,
    args: ['--no-sandbox'],
  });

  const context = await browser.newContext();
  const page = await context.newPage();

  await page.goto('https://365.kdocs.cn');

  console.log('步骤 1/2 — 请在弹出的浏览器窗口中登录 WPS 账号');
  console.log('步骤 2/2 — 登录后，打开任意一个 AirPage 文档（必须是编辑页，不是分享预览页）');
  console.log('\n等待中，检测到编辑页后自动提取凭据...\n');

  // 等待 CSRF token 出现，说明 AirPage 编辑器已加载（最多等 5 分钟）
  try {
    await page.waitForFunction(
      () => typeof window.__WPSENV__?.csrf_token === 'string' && window.__WPSENV__.csrf_token.length > 0,
      { timeout: 5 * 60 * 1000 }
    );
  } catch {
    console.error('超时：未在 5 分钟内检测到 AirPage 编辑页。请确保打开的是编辑模式文档。');
    await browser.close();
    process.exit(1);
  }

  // 提取 CSRF
  const csrf = await page.evaluate(() => window.__WPSENV__.csrf_token);

  // 提取全部 Cookie（包含 HttpOnly 的 wps_sid）
  const cookies = await context.cookies('https://365.kdocs.cn');
  // 也抓 www.kdocs.cn / kdocs.cn 域
  const allCookies = await context.cookies();
  const cookieStr = allCookies
    .filter(c => c.domain.includes('kdocs.cn') || c.domain.includes('wps.cn'))
    .map(c => `${c.name}=${c.value}`)
    .join('; ');

  await browser.close();

  if (!cookieStr || !csrf) {
    console.error('提取失败：cookie 或 csrf 为空');
    process.exit(1);
  }

  saveCredentials(cookieStr, csrf);

  console.log(`\n✓ 凭据已保存: ${CRED_FILE}`);
  console.log(`  cookie 长度: ${cookieStr.length} 字符`);
  console.log(`  csrf 前缀:   ${csrf.substring(0, 20)}...`);
  console.log('\n现在可以运行 wps-airpage 命令了。');
}

main().catch(err => {
  console.error('错误:', err.message);
  process.exit(1);
});
