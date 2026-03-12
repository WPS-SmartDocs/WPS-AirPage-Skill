#!/usr/bin/env node

'use strict';

const fs = require('fs');
const path = require('path');
const skillDir = path.resolve(__dirname, '..');

// 首次运行自动安装依赖
if (!fs.existsSync(path.join(skillDir, 'node_modules'))) {
  const { execSync } = require('child_process');
  console.log('首次运行，正在自动安装依赖 (npm install) …');
  execSync('npm install --omit=dev', { cwd: skillDir, stdio: 'inherit' });
  console.log('依赖安装完成。\n');
}

const { Command } = require('commander');
const { AirpageClient } = require('./client');
const { getStatus, saveCredentials, CRED_FILE } = require('./credentials');
const { parseJsonInput, decodeResult } = require('./utils');
const pkg = require('../package.json');

const program = new Command();

function handleError(err) {
  if (err.response) {
    console.error(`错误: ${err.message}\n${JSON.stringify(err.response, null, 2)}`);
  } else {
    console.error(`错误: ${err.message}`);
  }
  process.exitCode = 1;
}

function formatDate(ts) {
  if (!ts) return '-';
  return new Date(ts * 1000).toLocaleDateString('zh-CN');
}

program
  .name('wps-airpage')
  .description('WPS 智能文档 CLI — 通过 Cookie 认证操作 AirPage')
  .version(pkg.version);

// ── auth ──────────────────────────────────────────────
program
  .command('auth')
  .description('查看/更新鉴权凭据（cookie + CSRF）')
  .option('--set-cookie <cookie>', '手动设置 cookie 字符串')
  .option('--set-csrf <csrf>', '手动设置 CSRF token')
  .option('--browser', '启动浏览器自动提取凭据（需 playwright）')
  .option('--refresh', '提示如何重新提取（需配合 Chrome DevTools MCP）')
  .action((opts) => {
    if (opts.browser) {
      // 转发给 auth-browser.js
      const { spawnSync } = require('child_process');
      const result = spawnSync(process.execPath, [require.resolve('./auth-browser')], { stdio: 'inherit' });
      process.exitCode = result.status ?? 0;
      return;
    }

    if (opts.setCookie || opts.setCsrf) {
      const status = getStatus();
      const existing = status.creds || {};
      const cookie = opts.setCookie || existing.cookie || '';
      const csrf = opts.setCsrf || existing.csrf || '';
      saveCredentials(cookie, csrf);
      console.log(`凭据已保存到: ${CRED_FILE}`);
      return;
    }

    if (opts.refresh) {
      console.log(`
刷新凭据步骤（需要 Chrome DevTools MCP）：

1. 在浏览器打开 https://365.kdocs.cn 并打开任意 AirPage 文档
2. 在 Claude 会话中执行：
   - mcp__chrome-devtools__evaluate_script: document.cookie
   - mcp__chrome-devtools__evaluate_script: window.__WPSENV__.csrf_token
3. 将结果填入：
   wps-airpage auth --set-cookie "<cookie>" --set-csrf "<csrf>"

凭据文件: ${CRED_FILE}
      `.trim());
      return;
    }

    const status = getStatus();
    console.log(status.message);
    if (status.stale) {
      console.log('运行 wps-airpage auth --refresh 查看刷新步骤');
    }
  });

// ── search ────────────────────────────────────────────
program
  .command('search <keyword>')
  .description('搜索 AirPage 文档列表')
  .option('--count <n>', '返回数量', '10')
  .option('--sort <field>', '排序字段: modify_time | create_time', 'modify_time')
  .action(async (keyword, opts) => {
    try {
      const client = new AirpageClient();
      const result = await client.searchFiles({
        keyword,
        count: parseInt(opts.count, 10),
        sortBy: opts.sort,
      });
      const files = result.files || [];
      if (!files.length) {
        console.log('没有找到匹配的文档');
        return;
      }
      console.log(`找到 ${files.length} 个文档:\n`);
      files.forEach((f, i) => {
        console.log(`  ${i + 1}. ${f.fname.padEnd(30)} [ID: ${f.id}]  修改: ${formatDate(f.mtime)}`);
      });
      console.log('\n提示: export WPS_FILE_ID=<ID> 设置默认文档');
    } catch (err) { handleError(err); }
  });

// ── query ─────────────────────────────────────────────
program
  .command('query <file_id> [block_id]')
  .description('查询文档块（默认查询根节点 "doc"）')
  .option('--raw', '输出原始响应（不解码 base64）')
  .action(async (fileId, blockId = 'doc', opts) => {
    try {
      const client = new AirpageClient();
      const result = await client.queryBlocks(fileId, blockId);
      if (opts.raw) {
        console.log(JSON.stringify(result, null, 2));
      } else {
        // detail.result 已在 formatResponse 中自动解码
        console.log(JSON.stringify(result, null, 2));
      }
    } catch (err) { handleError(err); }
  });

// ── batch-query ───────────────────────────────────────
program
  .command('batch-query <file_id> <block_ids...>')
  .description('批量查询指定块 IDs')
  .action(async (fileId, blockIds) => {
    try {
      const client = new AirpageClient();
      const result = await client.queryBlocksBatch(fileId, blockIds);
      console.log(JSON.stringify(result, null, 2));
    } catch (err) { handleError(err); }
  });

// ── insert ────────────────────────────────────────────
program
  .command('insert <file_id>')
  .description('在文档中插入块内容')
  .option('--block-id <id>', '父块 ID', 'doc')
  .option('--index <n>', '插入位置（>= 1）', '1')
  .requiredOption('--content <json>', '块内容 JSON 数组，或 @filepath')
  .action(async (fileId, opts) => {
    try {
      const client = new AirpageClient();
      const content = parseJsonInput(opts.content);
      const index = parseInt(opts.index, 10);
      if (index < 1) throw new Error('--index 必须 >= 1（title 固定在 index 0）');
      const result = await client.insertBlocks(fileId, opts.blockId, index, content);
      console.log(JSON.stringify(result, null, 2));
    } catch (err) { handleError(err); }
  });

// ── update ────────────────────────────────────────────
program
  .command('update <file_id>')
  .description('更新文档块（单个或批量）')
  .requiredOption('--body <json>', '更新参数 JSON，或 @filepath（支持数组形式批量）')
  .action(async (fileId, opts) => {
    try {
      const client = new AirpageClient();
      const params = parseJsonInput(opts.body);
      const result = await client.updateBlocks(fileId, params);
      console.log(JSON.stringify(result, null, 2));
    } catch (err) { handleError(err); }
  });

// ── delete ────────────────────────────────────────────
program
  .command('delete <file_id>')
  .description('删除文档块（按 blockId 或 startIndex/endIndex）')
  .requiredOption('--body <json>', '删除参数 JSON，或 @filepath（支持数组形式批量）')
  .action(async (fileId, opts) => {
    try {
      const client = new AirpageClient();
      const params = parseJsonInput(opts.body);
      const result = await client.deleteBlocks(fileId, params);
      console.log(JSON.stringify(result, null, 2));
    } catch (err) { handleError(err); }
  });

// ── convert ───────────────────────────────────────────
program
  .command('convert <file_id>')
  .description('将 Markdown/HTML 转换为块数据')
  .option('--from <format>', '源格式: markdown | html', 'markdown')
  .requiredOption('--content <text>', '要转换的内容字符串，或 @filepath 读取文件')
  .action(async (fileId, opts) => {
    try {
      const client = new AirpageClient();
      let content = opts.content;
      // 支持 @filepath 读取文本文件
      if (content.startsWith('@')) {
        const { readFileSync } = require('fs');
        const { resolve } = require('path');
        content = readFileSync(resolve(content.slice(1)), 'utf-8');
      }
      const result = await client.convertContent(fileId, content, opts.from);
      console.log(JSON.stringify(result, null, 2));
    } catch (err) { handleError(err); }
  });

// ── new-doc ───────────────────────────────────────────
program
  .command('new-doc')
  .description('创建新 AirPage 文档')
  .requiredOption('--name <name>', '文档名称')
  .action(async (opts) => {
    try {
      const client = new AirpageClient();
      const result = await client.newDoc(opts.name);
      console.log(JSON.stringify(result, null, 2));
      const fileId = result.data?.fileid || result.fileid || result.data?.file_id || result.file_id;
      if (fileId) {
        console.log(`\n提示: export WPS_FILE_ID=${fileId}`);
      }
    } catch (err) { handleError(err); }
  });

// ── upload-image ──────────────────────────────────────
program
  .command('upload-image <file_id> <image_path>')
  .description('上传图片并插入到文档（返回 attachment_id 可作为 picture.sourceKey）')
  .option('--index <n>', '插入位置（>= 1），0 表示仅上传不插入', '0')
  .option('--width <n>', '图片宽度（px）')
  .option('--height <n>', '图片高度（px）')
  .action(async (fileId, imagePath, opts) => {
    try {
      const { uploadAttachment } = require('./attachment');
      const { loadCredentials } = require('./credentials');
      const resolvedPath = require('path').resolve(imagePath);
      if (!require('fs').existsSync(resolvedPath)) {
        throw new Error(`文件不存在: ${resolvedPath}`);
      }
      const creds = loadCredentials();
      console.error('上传图片中...');
      const { attachment_id } = await uploadAttachment(fileId, resolvedPath, creds.cookie);
      console.error(`附件上传成功: ${attachment_id}`);

      const index = parseInt(opts.index, 10);
      if (index < 1) {
        console.log(JSON.stringify({ attachment_id }));
        return;
      }

      const client = new AirpageClient();
      const pictureAttrs = { sourceKey: attachment_id };
      if (opts.width) pictureAttrs.width = parseInt(opts.width, 10);
      if (opts.height) pictureAttrs.height = parseInt(opts.height, 10);
      const result = await client.insertBlocks(fileId, 'doc', index, [
        { type: 'picture', attrs: pictureAttrs },
      ]);
      console.log(JSON.stringify({ attachment_id, insert: result }, null, 2));
    } catch (err) { handleError(err); }
  });

// ── decode ────────────────────────────────────────────
program
  .command('decode <base64_string>')
  .description('解码 AirPage 查询响应中的 base64 data.result')
  .action((b64) => {
    try {
      const decoded = decodeResult(b64);
      console.log(JSON.stringify(decoded, null, 2));
    } catch (err) {
      console.error(`解码失败: ${err.message}`);
      process.exitCode = 1;
    }
  });

program.parseAsync().catch(handleError);
