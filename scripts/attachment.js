'use strict';

/**
 * AirPage 附件上传
 *
 * 三步流程：
 * 1. 获取上传地址 POST /api/v3/office/file/{fileId}/attachment/upload/address
 * 2. 上传文件二进制到存储服务器
 * 3. 提交完成 POST /api/v3/office/file/{fileId}/attachment/upload/complete
 *
 * 返回 attachment_id，用作 picture/video 块的 sourceKey。
 *
 * ⚠️  需要 Origin: https://365.kdocs.cn 请求头，否则返回 SessionDeleted。
 * ✅  file_id 支持数字 ID（无需 link_id）。
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { AirpageError } = require('./errors');

const BASE_URL = 'https://365.kdocs.cn';

async function uploadAttachment(fileId, filePath, cookie) {
  const fileData = fs.readFileSync(filePath);
  const fileName = path.basename(filePath);
  const fileSize = fileData.length;
  const sha1 = crypto.createHash('sha1').update(fileData).digest('hex');

  const commonHeaders = {
    'Content-Type': 'application/json',
    'Origin': BASE_URL,
    'Cookie': cookie,
  };

  // Step 1: 获取上传地址
  const addrRes = await fetch(
    `${BASE_URL}/api/v3/office/file/${fileId}/attachment/upload/address`,
    {
      method: 'POST',
      headers: commonHeaders,
      body: JSON.stringify({ name: fileName, size: fileSize, sha1 }),
    }
  );
  const addrData = await addrRes.json();
  if (addrData.errno) {
    throw new AirpageError(`获取上传地址失败 [${addrData.errno}]: ${addrData.result || addrData.msg}`);
  }

  const { request: storeReq, upload_id } = addrData;

  // Step 2: 上传文件二进制到存储服务器
  const storeRes = await fetch(storeReq.url, {
    method: storeReq.method,
    headers: { ...storeReq.headers, 'Content-Type': 'application/octet-stream' },
    body: fileData,
  });
  if (!storeRes.ok) {
    throw new AirpageError(`存储服务器上传失败 [${storeRes.status}]`);
  }

  const etag = (storeRes.headers.get('etag') || '').replace(/"/g, '');
  const key = storeRes.headers.get('x-obs-save-key') || '';
  if (!etag || !key) {
    throw new AirpageError('存储服务器未返回 etag 或 x-obs-save-key');
  }

  // Step 3: 提交上传完成
  const completeRes = await fetch(
    `${BASE_URL}/api/v3/office/file/${fileId}/attachment/upload/complete`,
    {
      method: 'POST',
      headers: commonHeaders,
      body: JSON.stringify({ upload_id, params: { etag, key } }),
    }
  );
  const completeData = await completeRes.json();
  if (completeData.errno) {
    throw new AirpageError(`提交上传完成失败 [${completeData.errno}]: ${completeData.result || completeData.msg}`);
  }

  return { attachment_id: completeData.attachment_id };
}

module.exports = { uploadAttachment };
