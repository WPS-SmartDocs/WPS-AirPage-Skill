/**
 * WPS AirPage 内部 API 客户端
 *
 * 认证：Cookie + x-csrf-rand（从 ~/.claude/secrets/wps365.json 读取）
 * 端点：https://365.kdocs.cn/api/v3/office/file/{file_id}/core/execute
 */

const axios = require('axios');
const { loadCredentials } = require('./credentials');
const { AirpageError, createApiError } = require('./errors');
const { formatResponse } = require('./utils');

const BASE_URL = 'https://365.kdocs.cn';
const EXECUTE_PATH = (fileId) => `/api/v3/office/file/${fileId}/core/execute`;
const SEARCH_PATH = '/3rd/drive/api/v6/search/files';
const NEW_DOC_PATH = (type) => `/api/v3/office/new/${type}/file`;

class AirpageClient {
  constructor() {
    const creds = loadCredentials();
    if (!creds || !creds.cookie) {
      throw new AirpageError('未找到凭据，请先运行: wps-airpage auth');
    }
    this.cookie = creds.cookie;
    this.csrf = creds.csrf || '';
    this.http = axios.create({ baseURL: BASE_URL, timeout: 30000 });
  }

  /**
   * 执行块操作（写：exec，读：query）
   */
  async execute(fileId, command) {
    if (!this.csrf) {
      throw new AirpageError('缺少 CSRF token，块操作需要 csrf。请运行: wps-airpage auth');
    }
    const response = await this.http.post(EXECUTE_PATH(fileId), command, {
      headers: {
        Cookie: this.cookie,
        'x-csrf-rand': this.csrf,
        'Content-Type': 'application/json',
      },
    });

    const result = response.data;
    if (result.result !== 'ok') {
      throw createApiError(result);
    }
    return formatResponse(result);
  }

  /**
   * 搜索文件（仅需 cookie）
   */
  async searchFiles({ keyword, offset = 0, count = 10, sortBy = 'modify_time', order = 'desc' }) {
    const response = await this.http.get(SEARCH_PATH, {
      headers: { Cookie: this.cookie },
      params: { offset, count, sort_by: sortBy, order, searchname: keyword },
    });
    const result = response.data;
    if (result.result !== 'ok') {
      throw createApiError(result);
    }
    return result;
  }

  /**
   * 创建新文档（type: o = AirPage）
   */
  async newDoc(name, type = 'o') {
    if (!this.csrf) {
      throw new AirpageError('缺少 CSRF token，请运行: wps-airpage auth');
    }
    const response = await this.http.post(NEW_DOC_PATH(type), { fname: name }, {
      headers: {
        Cookie: this.cookie,
        'x-csrf-rand': this.csrf,
        'Content-Type': 'application/json',
      },
    });
    const result = response.data;
    if (result.result !== 'ok') {
      throw createApiError(result);
    }
    return result;
  }

  // ── 块操作快捷方法 ────────────────────────────────

  queryBlocks(fileId, blockId = 'doc') {
    return this.execute(fileId, {
      command: 'http.otl.query',
      param: { name: 'block.query', params: { blockId } },
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
