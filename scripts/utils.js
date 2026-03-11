const fs = require('fs');
const path = require('path');

/**
 * 解析 JSON 输入：支持内联 JSON 字符串或 @filepath
 */
function parseJsonInput(input) {
  if (!input) return null;
  if (input.startsWith('@')) {
    const filePath = path.resolve(input.slice(1));
    const cwd = process.cwd();
    if (!filePath.startsWith(cwd + path.sep) && filePath !== cwd) {
      throw new Error(`安全限制: @filepath 只能读取当前工作目录下的文件，拒绝访问 ${filePath}`);
    }
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  }
  return JSON.parse(input);
}

/**
 * base64 解码 AirPage 查询响应中的 data.result
 */
function decodeResult(result) {
  try {
    return JSON.parse(Buffer.from(result, 'base64').toString('utf-8'));
  } catch {
    return result;
  }
}

/**
 * 格式化输出：自动解码 data.result 中的 base64
 */
function formatResponse(data) {
  if (data && data.detail && typeof data.detail.result === 'string') {
    try {
      const decoded = decodeResult(data.detail.result);
      return { ...data, detail: { ...data.detail, result: decoded } };
    } catch {
      // 不是 base64，原样返回
    }
  }
  return data;
}

module.exports = { parseJsonInput, decodeResult, formatResponse };
