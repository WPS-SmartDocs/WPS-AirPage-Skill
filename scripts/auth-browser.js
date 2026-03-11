#!/usr/bin/env node
/**
 * WPS AirPage 浏览器鉴权助手
 *
 * 用法: node scripts/auth-browser.js
 *       wps-airpage auth --browser
 *
 * 功能：启动可见 Chrome 窗口，等待用户登录并打开 AirPage 文档编辑页，
 *       自动提取完整 Cookie（含 HttpOnly 的 wps_sid）和 CSRF token，
 *       写入 ~/.claude/secrets/wps365.json。
 */

'use strict';

const { execSync, spawnSync } = require('child_process');
const path = require('path');
const skillDir = path.resolve(__dirname, '..');

function ensurePlaywright() {
  // 1. 检查 npm 包
  let playwrightPath;
  try {
    playwrightPath = require.resolve('playwright');
  } catch {
    console.log('未检测到 playwright，正在安装 npm 包...');
    execSync('npm install playwright --no-save', { cwd: skillDir, stdio: 'inherit' });
    playwrightPath = require.resolve('playwright');
  }

  // 2. 检查 chromium 二进制是否存在（通过 playwright-core 的 registry）
  let chromiumReady = false;
  try {
    const { chromium } = require('playwright');
    const exePath = chromium.executablePath();
    const fs = require('fs');
    chromiumReady = exePath && fs.existsSync(exePath);
  } catch { /* 未安装 */ }

  if (!chromiumReady) {
    console.log('正在下载 Chromium 浏览器（约 150MB，仅首次需要）...');
    execSync('npx playwright install chromium', { cwd: skillDir, stdio: 'inherit' });
    console.log('Chromium 下载完成。\n');
  }
}

async function main() {
  ensurePlaywright();

  const { chromium } = require('playwright');
  const { saveCredentials, CRED_FILE } = require('./credentials');

  console.log('\n=== WPS AirPage 鉴权助手 ===\n');
  console.log('步骤 1/2 — 请在弹出的浏览器窗口中登录 WPS 账号');
  console.log('步骤 2/2 — 登录后，打开任意一个 AirPage 文档（必须是编辑页，不是分享预览页）');
  console.log('\n等待中，检测到编辑器加载后自动提取凭据...\n');

  let browser;
  try {
    browser = await chromium.launch({ headless: false, args: ['--no-sandbox'] });
  } catch (e) {
    console.error('浏览器启动失败:', e.message);
    console.error('请尝试手动运行: npx playwright install chromium');
    process.exit(1);
  }

  const context = await browser.newContext();
  const page = await context.newPage();

  page.on('crash', () => {
    console.error('浏览器页面崩溃，请重试');
    process.exit(1);
  });

  await page.goto('https://365.kdocs.cn');

  // 等待 CSRF token（说明 AirPage 编辑器已加载），最多 5 分钟
  try {
    await page.waitForFunction(
      () => typeof window.__WPSENV__?.csrf_token === 'string' && window.__WPSENV__.csrf_token.length > 10,
      { timeout: 5 * 60 * 1000, polling: 1000 }
    );
  } catch (e) {
    const msg = e.message?.includes('Timeout') ? '等待超时（5 分钟）' : e.message;
    console.error(`\n提取失败: ${msg}`);
    console.error('请确保：1) 已完成登录  2) 打开的是 AirPage 文档编辑页（非分享/预览页）');
    await browser.close();
    process.exit(1);
  }

  // 提取 CSRF
  const csrf = await page.evaluate(() => window.__WPSENV__.csrf_token);

  // 提取全部 Cookie（包含 HttpOnly 的 wps_sid）
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
