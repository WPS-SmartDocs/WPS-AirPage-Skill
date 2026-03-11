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
   */
  async newDoc(name, type = 'o') {
    if (!this.csrf) throw new AirpageError('缺少 CSRF token，请运行: wps-airpage auth');
    const data = await request(NEW_DOC_URL(type), {
      method: 'POST',
      headers: { Cookie: this.cookie, 'x-csrf-rand': this.csrf },
      body: { fname: name },
    });
    if (data.result !== 'ok') throw createApiError(data);
    return data;
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
    return this.execute(fileId, {
      command: 'http.otl.exec',
      param: { subtype: 'block.update', params },
    });
  }

  deleteBlocks(fileId, params) {
    return this.execute(fileId, {
      command: 'http.otl.exec',
      param: { subtype: 'block.delete', params },
    });
  }

  convertContent(fileId, content, from = 'markdown') {
    return this.execute(fileId, {
      command: 'http.otl.query',
      param: { name: 'convert', params: { content, from } },
    });
  }
}

module.exports = { AirpageClient };
