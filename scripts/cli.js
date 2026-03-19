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

// ── MCP 安装（多平台） ────────────────────────────────

const MCP_SERVER_CONFIG = {
  'chrome-devtools-mcp': {
    command: 'npx',
    args: ['-y', 'chrome-devtools-mcp@latest'],
  },
};

/** 各平台 MCP 配置文件路径 */
const MCP_CONFIGS = {
  'claude-code': null, // 用 `claude mcp add` 命令安装
  cursor: path.join(require('os').homedir(), '.cursor', 'mcp.json'),
  codex: path.join(require('os').homedir(), '.codex', 'mcp.json'),
  gemini: path.join(require('os').homedir(), '.gemini', 'settings.json'),
};

function mergeMcpJson(filePath, serverKey, serverConfig) {
  let existing = {};
  try { existing = JSON.parse(fs.readFileSync(filePath, 'utf-8')); } catch { /* new file */ }
  const mcpServers = { ...(existing.mcpServers || {}), [serverKey]: serverConfig };
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify({ ...existing, mcpServers }, null, 2) + '\n');
}

function installMcp(platform = 'all') {
  const { execSync } = require('child_process');
  const targets = platform === 'all' ? Object.keys(MCP_CONFIGS) : [platform];
  const invalid = targets.filter(p => !(p in MCP_CONFIGS));
  if (invalid.length) {
    console.error(`未知平台: ${invalid.join(', ')}。可选: ${Object.keys(MCP_CONFIGS).join('|')}|all`);
    process.exitCode = 1;
    return;
  }

  console.log(`\n正在为 [${targets.join(', ')}] 安装 Chrome DevTools MCP...\n`);

  for (const p of targets) {
    if (p === 'claude-code') {
      console.log('Claude Code: claude mcp add chrome-devtools-mcp -- npx -y chrome-devtools-mcp@latest');
      try {
        execSync('claude mcp add chrome-devtools-mcp -- npx -y chrome-devtools-mcp@latest', { stdio: 'inherit' });
        console.log('✓ Claude Code MCP 安装完成，请重启会话生效。\n');
      } catch {
        console.warn('⚠  claude 命令不可用，请手动运行上方命令。\n');
      }
    } else {
      const cfgPath = MCP_CONFIGS[p];
      try {
        mergeMcpJson(cfgPath, 'chrome-devtools-mcp', MCP_SERVER_CONFIG['chrome-devtools-mcp']);
        console.log(`✓ ${p.padEnd(12)} → ${cfgPath}`);
      } catch (e) {
        console.error(`✗ ${p.padEnd(12)} 失败: ${e.message}`);
      }
    }
  }

  console.log('\n安装完成！重启对应编辑器/CLI 使 MCP 生效。');
  console.log('安装后运行: node scripts/cli.js auth --browser  （或在 AI 中触发鉴权流程）');
}

// ── auth ──────────────────────────────────────────────
program
  .command('auth')
  .description('查看/更新鉴权凭据（cookie + CSRF）')
  .option('--set-cookie <cookie>', '手动设置 cookie 字符串')
  .option('--set-csrf <csrf>', '手动设置 CSRF token')
  .option('--browser', '启动浏览器自动提取凭据（需 playwright）')
  .option('--install-mcp [platform]', '安装 Chrome DevTools MCP（claude-code|cursor|codex|gemini|all，默认 all）')
  .option('--refresh', '提示如何重新提取（需配合 Chrome DevTools MCP）')
  .action((opts) => {
    if (opts.installMcp !== undefined) {
      installMcp(opts.installMcp === true ? 'all' : opts.installMcp);
      return;
    }

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
   - mcp__chrome-devtools__list_network_requests
   - mcp__chrome-devtools__get_network_request（从 Request Headers 复制完整 cookie）
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
      fileId = await client.resolveFileId(fileId);
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
      fileId = await client.resolveFileId(fileId);
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
      fileId = await client.resolveFileId(fileId);
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
      fileId = await client.resolveFileId(fileId);
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
      fileId = await client.resolveFileId(fileId);
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
      fileId = await client.resolveFileId(fileId);
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
      if (result.fileid) {
        console.log(`\nfile_id: ${result.fileid}`);
        if (result.doc_url) console.log(`文档链接: ${result.doc_url}`);
        console.log(`提示: export WPS_FILE_ID=${result.fileid}`);
      }
    } catch (err) { handleError(err); }
  });

// ── comments ──────────────────────────────────────────
program
  .command('comments <file_id>')
  .description('查询文档评论')
  .option('--sids <ids>', '按 selection_id 过滤（逗号分隔）')
  .option('--cids <ids>', '按 comment_id 过滤（逗号分隔）')
  .option('--page <n>', '页码', '0')
  .option('--size <n>', '每页数量（最大 100）', '20')
  .option('--order <asc|desc>', '排序方向', 'desc')
  .action(async (fileId, opts) => {
    try {
      const client = new AirpageClient();
      fileId = await client.resolveFileId(fileId);
      const result = await client.queryComments(fileId, {
        sids: opts.sids, cids: opts.cids,
        pageno: opts.page, size: opts.size, order: opts.order,
      });
      const sels = result.selections || [];
      console.log(`共 ${sels.length} 个选区\n`);
      sels.forEach(sel => {
        console.log(`[选区 ${sel.selection_id}] 评论数: ${sel.comment_count}  文本: "${sel.selection_text}"`);
        (sel.comments || []).forEach(c => {
          const prefix = c.reply_id ? '  └─ 回复' : '  ●';
          console.log(`  ${prefix} [${c.id.slice(0, 8)}] ${c.content?.text}`);
        });
      });
    } catch (err) { handleError(err); }
  });

program
  .command('comment-add <file_id>')
  .description('创建评论（selection_id 可自定义字符串，作为评论锚点 ID）')
  .requiredOption('--sid <selection_id>', '选区 ID（可自定义任意字符串）')
  .requiredOption('--text <text>', '评论内容')
  .option('--reply-id <comment_id>', '回复指定评论 ID')
  .action(async (fileId, opts) => {
    try {
      const client = new AirpageClient();
      fileId = await client.resolveFileId(fileId);
      const body = { selection_id: opts.sid, content: { text: opts.text }, type: 0 };
      if (opts.replyId) body.reply_id = opts.replyId;
      const result = await client.upsertComment(fileId, body);
      console.log(JSON.stringify(result, null, 2));
    } catch (err) { handleError(err); }
  });

program
  .command('comment-update <file_id>')
  .description('更新评论内容')
  .requiredOption('--id <comment_id>', '评论 ID')
  .requiredOption('--sid <selection_id>', '选区 ID')
  .requiredOption('--text <text>', '新的评论内容')
  .action(async (fileId, opts) => {
    try {
      const client = new AirpageClient();
      fileId = await client.resolveFileId(fileId);
      const result = await client.upsertComment(fileId, {
        id: opts.id, selection_id: opts.sid, content: { text: opts.text },
      });
      console.log(JSON.stringify(result, null, 2));
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
      const client = new AirpageClient();
      fileId = await client.resolveFileId(fileId);
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

      const pictureAttrs = { sourceKey: attachment_id };
      if (opts.width) pictureAttrs.width = parseInt(opts.width, 10);
      if (opts.height) pictureAttrs.height = parseInt(opts.height, 10);
      const result = await client.insertBlocks(fileId, 'doc', index, [
        { type: 'picture', attrs: pictureAttrs },
      ]);
      console.log(JSON.stringify({ attachment_id, insert: result }, null, 2));
    } catch (err) { handleError(err); }
  });

// ── insert-markdown ───────────────────────────────────
program
  .command('insert-markdown <file_id>')
  .description('插入 Markdown 内容到文档（title/content 必填其一）')
  .option('--title <text>', '文档大标题')
  .option('--content <text>', 'Markdown 正文内容，或 @filepath 读取文件')
  .option('--pos <pos>', '插入位置: begin | end', 'end')
  .action(async (fileId, opts) => {
    try {
      if (!opts.title && !opts.content) {
        console.error('错误: --title 或 --content 必填其一');
        process.exitCode = 1;
        return;
      }
      let content = opts.content;
      if (content && content.startsWith('@')) {
        const { readFileSync } = require('fs');
        const { resolve } = require('path');
        content = readFileSync(resolve(content.slice(1)), 'utf-8');
      }
      const client = new AirpageClient();
      fileId = await client.resolveFileId(fileId);
      const result = await client.insertMarkdown(fileId, {
        title: opts.title,
        content,
        pos: opts.pos,
      });
      console.log(JSON.stringify(result, null, 2));
    } catch (err) { handleError(err); }
  });

// ── outline ───────────────────────────────────────────
program
  .command('outline <file_id>')
  .description('获取文档目录结构（标题列表）')
  .option('--format <fmt>', '响应格式: json | markdown', 'markdown')
  .action(async (fileId, opts) => {
    try {
      const client = new AirpageClient();
      fileId = await client.resolveFileId(fileId);
      const result = await client.queryOutline(fileId, opts.format);
      if (opts.format === 'markdown') {
        const items = result?.detail || [];
        if (!items.length) { console.log('（文档无标题）'); return; }
        items.forEach(item => console.log(item.markdown));
      } else {
        console.log(JSON.stringify(result, null, 2));
      }
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

// ── interactive ───────────────────────────────────────
program
  .command('interactive')
  .alias('i')
  .description('启动交互式向导（搜索/新建文档、插入内容、查看目录等）')
  .action(async () => {
    const { main } = require('./interactive');
    try { await main(); } catch (err) { handleError(err); }
  });

// 无子命令时默认进入交互模式
program.action(async () => {
  const { main } = require('./interactive');
  try { await main(); } catch (err) { handleError(err); }
});

program.parseAsync().catch(handleError);
