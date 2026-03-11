class AirpageError extends Error {
  constructor(message, code, response) {
    super(message);
    this.name = 'AirpageError';
    this.code = code;
    this.response = response;
  }
}

// AirPage 专属错误码（见 references/error-codes.md）
const AIRPAGE_ERRORS = {
  '-152': '参数无效',
  1000: 'block not found',
  1001: 'blockId is required',
  1002: 'invalid operation',
  1003: 'invalid appComponent',
  1005: 'unsupport node type',
  1006: 'invalid attrs',
  1007: 'invalid content',
  1008: 'invalid child count',
  1009: 'invalid table',
  1010: 'insert lock block without permission',
  1011: 'invalid RangeMark',
  1013: 'no match block anchor',
  1014: 'no match feature node',
  1015: 'cannot delete all children',
  1016: 'merged cells conflict',
};

function createApiError(result) {
  const code = result.code;
  const msg = result.message || result.msg || AIRPAGE_ERRORS[String(code)] || '未知错误';
  return new AirpageError(`API 错误 [${code}]: ${msg}`, code, result);
}

module.exports = { AirpageError, createApiError, AIRPAGE_ERRORS };
