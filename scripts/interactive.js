'use strict';

/**
 * WPS AirPage 交互式 CLI
 * 运行：node scripts/cli.js interactive
 *      node scripts/cli.js  （无参数时自动进入）
 */

const { AirpageClient } = require('./client');
const { getStatus } = require('./credentials');
const { readFileSync, existsSync } = require('fs');
const { resolve } = require('path');

// 按需安装 inquirer@8（最后一个 CJS 版本）
function ensureInquirer() {
  try {
    return require('inquirer');
  } catch {
    const { execSync } = require('child_process');
    const skillDir = resolve(__dirname, '..');
    console.log('正在安装 inquirer...');
    execSync('npm install inquirer@8 --no-save', { cwd: skillDir, stdio: 'inherit' });
    return require('inquirer');
  }
}

// ── 子流程 ────────────────────────────────────────────────

async function searchAndSelect(inquirer, client) {
  const { keyword } = await inquirer.prompt([{
    type: 'input',
    name: 'keyword',
    message: '请输入搜索关键词：',
    validate: v => v.trim().length > 0 || '关键词不能为空',
  }]);

  process.stdout.write('搜索中...');
  const result = await client.searchFiles({ keyword: keyword.trim(), count: 10 });
  process.stdout.write('\r                \r');

  const files = result.files || [];
  if (!files.length) {
    console.log('没有找到匹配的文档\n');
    return null;
  }

  const choices = files.map(f => ({
    name: `${f.fname.padEnd(36)} [ID: ${f.id}]`,
    value: { id: String(f.id), name: f.fname },
  }));
  choices.push(new inquirer.Separator(), { name: '← 返回', value: null });

  const { doc } = await inquirer.prompt([{
    type: 'list',
    name: 'doc',
    message: `找到 ${files.length} 个文档，请选择：`,
    choices,
    pageSize: 12,
  }]);

  return doc;
}

async function createDoc(inquirer, client) {
  const { name } = await inquirer.prompt([{
    type: 'input',
    name: 'name',
    message: '新文档名称：',
    validate: v => v.trim().length > 0 || '名称不能为空',
  }]);

  process.stdout.write('创建中...');
  const result = await client.newDoc(name.trim());
  process.stdout.write('\r         \r');

  const fileId = result.data?.fileid || result.fileid || result.data?.file_id || result.file_id;
  if (!fileId) throw new Error('创建成功但未返回 file_id');

  const doc = { id: String(fileId), name: name.trim(), url: result.doc_url || null };
  console.log(`✓ 已创建文档「${doc.name}」[ID: ${doc.id}]`);
  if (doc.url) console.log(`  文档链接: ${doc.url}`);
  console.log('');
  return doc;
}

// ── 文档级操作 ────────────────────────────────────────────

async function insertMarkdownFlow(inquirer, client, doc) {
  const { source } = await inquirer.prompt([{
    type: 'list',
    name: 'source',
    message: '内容来源：',
    choices: [
      { name: '✏️  直接输入（打开编辑器）', value: 'editor' },
      { name: '📁 读取本地文件', value: 'file' },
    ],
  }]);

  let content;

  if (source === 'editor') {
    const { text } = await inquirer.prompt([{
      type: 'editor',
      name: 'text',
      message: '请在编辑器中输入 Markdown 内容，保存后关闭：',
    }]);
    content = text;
  } else {
    const { filepath } = await inquirer.prompt([{
      type: 'input',
      name: 'filepath',
      message: '文件路径：',
      validate: v => {
        const p = resolve(v.trim());
        return existsSync(p) || `文件不存在: ${p}`;
      },
    }]);
    content = readFileSync(resolve(filepath.trim()), 'utf-8');
  }

  if (!content?.trim()) {
    console.log('内容为空，已取消\n');
    return;
  }

  const { pos } = await inquirer.prompt([{
    type: 'list',
    name: 'pos',
    message: '插入位置：',
    choices: [
      { name: '末尾 (end)', value: 'end' },
      { name: '开头 (begin)', value: 'begin' },
    ],
  }]);

  process.stdout.write('插入中...');
  await client.insertMarkdown(doc.id, { content, pos });
  process.stdout.write('\r         \r');
  console.log(`✓ 内容已插入到「${doc.name}」\n`);
}

async function outlineFlow(client, doc) {
  process.stdout.write('获取目录中...');
  const result = await client.queryOutline(doc.id, 'markdown');
  process.stdout.write('\r              \r');

  const items = result?.detail || [];
  if (!items.length) {
    console.log('（文档暂无标题）\n');
    return;
  }
  console.log(`\n── 文档目录「${doc.name}」──`);
  items.forEach(item => console.log(item.markdown));
  console.log('');
}

async function queryBlockFlow(inquirer, client, doc) {
  const { blockId } = await inquirer.prompt([{
    type: 'input',
    name: 'blockId',
    message: '块 ID（留空查询根节点）：',
    default: 'doc',
  }]);

  process.stdout.write('查询中...');
  const result = await client.queryBlocks(doc.id, blockId || 'doc');
  process.stdout.write('\r       \r');
  console.log(JSON.stringify(result, null, 2));
  console.log('');
}

// ── 文档操作菜单 ──────────────────────────────────────────

async function docMenu(inquirer, client, doc) {
  console.log(`\n当前文档：${doc.name}  [ID: ${doc.id}]\n`);

  while (true) {
    const { action } = await inquirer.prompt([{
      type: 'list',
      name: 'action',
      message: '选择操作：',
      choices: [
        { name: '📝 插入 Markdown 内容', value: 'insert-markdown' },
        { name: '📋 查看文档目录', value: 'outline' },
        { name: '🔍 查询块', value: 'query' },
        new inquirer.Separator(),
        { name: '← 换文档', value: 'back' },
        { name: '✕  退出', value: 'exit' },
      ],
    }]);

    if (action === 'back') return 'back';
    if (action === 'exit') return 'exit';

    try {
      if (action === 'insert-markdown') await insertMarkdownFlow(inquirer, client, doc);
      if (action === 'outline')         await outlineFlow(client, doc);
      if (action === 'query')           await queryBlockFlow(inquirer, client, doc);
    } catch (err) {
      console.error(`\n错误: ${err.message}\n`);
    }
  }
}

// ── 入口 ──────────────────────────────────────────────────

async function main() {
  const inquirer = ensureInquirer();

  console.log('\n╔══════════════════════════════╗');
  console.log('║   WPS AirPage 智能文档 CLI   ║');
  console.log('╚══════════════════════════════╝\n');

  // 凭据检查
  const status = getStatus();
  if (!status.ok) {
    console.error(`⛔ ${status.message}\n`);
    process.exit(1);
  }
  if (status.stale) {
    console.warn(`⚠️  凭据已超过 8 小时，建议刷新（Ctrl+C 退出后运行 wps-airpage auth --refresh）\n`);
  } else {
    console.log('✓ 凭据有效\n');
  }

  let client;
  try {
    client = new AirpageClient();
  } catch (err) {
    console.error(`⛔ 初始化失败: ${err.message}`);
    process.exit(1);
  }

  // 主循环
  while (true) {
    const { action } = await inquirer.prompt([{
      type: 'list',
      name: 'action',
      message: '主菜单：',
      choices: [
        { name: '🔍 搜索已有文档', value: 'search' },
        { name: '➕ 新建文档', value: 'new' },
        new inquirer.Separator(),
        { name: '✕  退出', value: 'exit' },
      ],
    }]);

    if (action === 'exit') {
      console.log('\n再见！\n');
      break;
    }

    let doc = null;
    try {
      if (action === 'search') doc = await searchAndSelect(inquirer, client);
      if (action === 'new')    doc = await createDoc(inquirer, client);
    } catch (err) {
      console.error(`\n错误: ${err.message}\n`);
      continue;
    }

    if (!doc) continue;

    const result = await docMenu(inquirer, client, doc);
    if (result === 'exit') {
      console.log('\n再见！\n');
      break;
    }
  }
}

module.exports = { main };
