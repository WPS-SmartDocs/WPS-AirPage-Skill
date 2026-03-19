/**
 * WPS AirPage 内部 API 客户端
 *
 * 认证：Cookie + x-csrf-rand（从 ~/.claude/secrets/wps365.json 读取）
 * 端点：https://365.kdocs.cn/api/v3/office/file/{file_id}/core/execute
 *
 * 使用 Node.js 内置 fetch（Node 18+），避免 axios 与 Node 24 的兼容问题。
 */

const { loadCredentials } = require('./credentials');
const { AirpageError, createApiError } = require('./errors');
const { formatResponse } = require('./utils');

const BASE_URL = 'https://365.kdocs.cn';
const EXECUTE_PATH = (fileId) => `${BASE_URL}/api/v3/office/file/${fileId}/core/execute`;
const SEARCH_URL = `${BASE_URL}/3rd/drive/api/v6/search/files`;
const NEW_DOC_URL = (type) => `${BASE_URL}/api/v3/office/new/${type}/file`;
// 短链：365.kdocs.cn/l/<code>
const SHORT_LINK_RE = /365\.kdocs\.cn\/l\/[A-Za-z0-9]+/;
// 长链：365.kdocs.cn/office/o/<numeric_id>
const LONG_LINK_RE = /365\.kdocs\.cn\/(?:office\/o|l\/\w+.*?[?&]id=)\/?\s*(\d+)/;
// 纯数字 file_id
const NUMERIC_RE = /^\d+$/;

/**
 * 从 kdocs 文档页 HTML 中提取 file_id。
 * window.__WPSENV__.file_info.file.id 是第一个 "file":{} 下的 "id" 字段。
 */
async function resolveShortLink(url, cookie) {
  const res = await fetch(url, { headers: { Cookie: cookie, 'Accept-Encoding': 'identity' } });
  const html = await res.text();
  // 优先从 __WPSENV__ file 对象第一个字段提取（id 是第一个 key）
  const m = html.match(/"file"\s*:\s*\{\s*"id"\s*:\s*"(\d+)"/);
  if (!m) throw new AirpageError(`无法从链接解析 file_id: ${url}`);
  return m[1];
}

/**
 * 将任意形式的文档引用统一解析为数字 file_id：
 *   - 纯数字         → 原样返回
 *   - /office/o/123  → 从路径提取
 *   - /l/xxx 短链    → 请求页面提取
 *   - 其他字符串     → 抛出明确错误
 */
async function normalizeFileId(fileIdOrUrl, cookie) {
  const s = String(fileIdOrUrl).trim();

  // 1. 纯数字
  if (NUMERIC_RE.test(s)) return s;

  // 2. 长链 /office/o/{id}
  const longM = s.match(/365\.kdocs\.cn\/office\/o\/(\d+)/);
  if (longM) return longM[1];

  // 3. 短链 /l/<code>
  if (SHORT_LINK_RE.test(s)) return resolveShortLink(s, cookie);

  // 4. 无法识别
  throw new AirpageError(`无效的 file_id："${s}"。请传入数字 ID、短链（365.kdocs.cn/l/xxx）或文档链接（365.kdocs.cn/office/o/xxx）。`);
}

async function request(url, { method = 'GET', headers = {}, body, params } = {}) {
  const fullUrl = params ? `${url}?${new URLSearchParams(params)}` : url;
  const opts = { method, headers: { 'Accept-Encoding': 'identity', ...headers } };
  if (body !== undefined) {
    opts.body = JSON.stringify(body);
    opts.headers['Content-Type'] = 'application/json';
  }
  const res = await fetch(fullUrl, opts);
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { throw new AirpageError(`响应解析失败 [${res.status}]: ${text.substring(0, 200)}`); }
  return data;
}

class AirpageClient {
  constructor() {
    const creds = loadCredentials();
    if (!creds || !creds.cookie) {
      throw new AirpageError('未找到凭据，请先运行: wps-airpage auth');
    }
    this.cookie = creds.cookie;
    this.csrf = creds.csrf || '';
  }

  /**
   * 将短链或数字 ID 统一解析为数字 file_id
   */
  async resolveFileId(fileIdOrUrl) {
    return normalizeFileId(fileIdOrUrl, this.cookie);
  }

  /**
   * 执行块操作（写：exec，读：query）
   */
  async execute(fileId, command) {
    if (!this.csrf) {
      throw new AirpageError('缺少 CSRF token，块操作需要 csrf。请运行: wps-airpage auth');
    }
    const data = await request(EXECUTE_PATH(fileId), {
      method: 'POST',
      headers: { Cookie: this.cookie, 'x-csrf-rand': this.csrf },
      body: command,
    });
    if (data.result !== 'ok') throw createApiError(data);
    return formatResponse(data);
  }

  /**
   * 搜索文件（仅需 cookie）
   */
  async searchFiles({ keyword, offset = 0, count = 10, sortBy = 'modify_time', order = 'desc' }) {
    const data = await request(SEARCH_URL, {
      headers: { Cookie: this.cookie },
      params: { offset, count, sort_by: sortBy, order, searchname: keyword },
    });
    if (data.result !== 'ok' && data.status !== 0) throw createApiError(data);
    return data;
  }

  /**
   * 创建新文档（type: o = AirPage）
   * 返回值包含 fileid、doc_url（完整编辑页链接）
   */
  async newDoc(name, type = 'o') {
    if (!this.csrf) throw new AirpageError('缺少 CSRF token，请运行: wps-airpage auth');
    const data = await request(NEW_DOC_URL(type), {
      method: 'POST',
      headers: { Cookie: this.cookie, 'x-csrf-rand': this.csrf },
      body: { fname: name },
    });
    // new-doc 响应只有 {"fileid":"<id>"}，不含 result:"ok"
    const fileId = String(data.fileid || data.data?.fileid || data.data?.file_id || data.file_id || '');
    if (!fileId) throw createApiError(data);

    const docUrl = `https://365.kdocs.cn/office/o/${fileId}`;

    // 设置文档内部标题块（index 0 的 title 块默认为空）
    try {
      const root = await this.queryBlocks(fileId, 'doc');
      const children = root?.detail?.result?.blocks?.[0]?.content ?? [];
      const titleBlock = children.find(b => b.type === 'title');
      if (titleBlock?.id) {
        await this.updateBlocks(fileId, [{
          operation: 'update_content',
          blockId: titleBlock.id,
          content: [{ type: 'text', content: name }],
        }]);
      }
    } catch { /* 标题设置失败不影响主流程 */ }

    return { result: 'ok', fileid: fileId, doc_url: docUrl };
  }

  // ── 块操作快捷方法 ────────────────────────────────

  queryBlocks(fileId, blockId = 'doc') {
    return this.execute(fileId, {
      command: 'http.otl.query',
      param: { name: 'block.query', params: { blockIds: [blockId] } },
    });
  }

  queryBlocksBatch(fileId, blockIds) {
    return this.execute(fileId, {
      command: 'http.otl.query',
      param: { name: 'block.query', params: { blockIds } },
    });
  }

  insertBlocks(fileId, blockId, index, content) {
    return this.execute(fileId, {
      command: 'http.otl.exec',
      param: { subtype: 'block.insert', params: { blockId, index, content } },
    });
  }

  updateBlocks(fileId, params) {
    // params 必须是数组形式，单个对象自动包装
    const normalizedParams = Array.isArray(params) ? params : [params];
    return this.execute(fileId, {
      command: 'http.otl.exec',
      param: { subtype: 'block.update', params: normalizedParams },
    });
  }

  deleteBlocks(fileId, params) {
    return this.execute(fileId, {
      command: 'http.otl.exec',
      param: { subtype: 'block.delete', params },
    });
  }

  convertContent(fileId, content, format = 'markdown') {
    return this.execute(fileId, {
      command: 'http.otl.query',
      param: { name: 'convert', params: { content, format } },
    });
  }

  /**
   * 插入 Markdown 内容（整段写入，比 convert+insert 更简单）
   * @param {string} fileId
   * @param {object} opts - { title, content, pos: 'begin'|'end' }
   *   title 和 content 必填其一
   */
  insertMarkdown(fileId, { title, content, pos = 'end' } = {}) {
    if (!title && !content) throw new AirpageError('title 和 content 必填其一');
    const params = { pos };
    if (title) params.title = title;
    if (content) params.content = content;
    return this.execute(fileId, {
      command: 'http.otl.exec',
      param: { subType: 'insertContent', params },
    });
  }

  /**
   * 获取文档目录结构（标题列表）
   * @param {string} fileId
   * @param {string} format - 'json' | 'markdown'
   */
  queryOutline(fileId, format = 'markdown') {
    return this.execute(fileId, {
      command: 'http.otl.query',
      param: {
        name: 'queryContentByStyle',
        params: { attrs: { nodeType: 'heading' }, format },
      },
    });
  }

  // ── 评论操作 ──────────────────────────────────────────

  /**
   * 查询评论
   * @param {string} fileId
   * @param {object} opts - { sids, cids, pageno, size, order }
   */
  queryComments(fileId, opts = {}) {
    const params = new URLSearchParams();
    if (opts.sids) params.set('sids', Array.isArray(opts.sids) ? opts.sids.join(',') : opts.sids);
    if (opts.cids) params.set('cids', Array.isArray(opts.cids) ? opts.cids.join(',') : opts.cids);
    if (opts.pageno != null) params.set('pageno', opts.pageno);
    if (opts.size) params.set('size', opts.size);
    if (opts.order) params.set('order', opts.order);
    const qs = params.toString();
    const url = `${BASE_URL}/api/v3/office/outline/file/${fileId}/comments${qs ? '?' + qs : ''}`;
    return request(url, { headers: { Cookie: this.cookie, 'x-csrf-rand': this.csrf } });
  }

  /**
   * 创建/回复/更新评论
   * 创建：{ selection_id, content, type }
   * 回复：{ selection_id, reply_id, content, type }
   * 更新：{ id, selection_id, content }
   */
  upsertComment(fileId, body) {
    return request(`${BASE_URL}/api/v3/office/outline/file/${fileId}/comment`, {
      method: 'POST',
      headers: { Cookie: this.cookie, 'x-csrf-rand': this.csrf },
      body,
    });
  }
}

module.exports = { AirpageClient };
