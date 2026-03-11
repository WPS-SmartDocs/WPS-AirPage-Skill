---
name: wps-airpage
description: >
  WPS 智能文档操作技能。通过 WPS 365 API 管理智能文档（AirPage）。
  支持文档创建、块内容查询/创建/更新/删除等。
  触发词：wps-airpage、智能文档、AirPage、wps block、kdocs
---

# WPS AirPage CLI Skill

CLI 风格操作 WPS 365 智能文档（AirPage）。

## 工作流

```
1. 鉴权   → 读缓存 / Chrome DevTools MCP 提取
2. 选文档  → $WPS_FILE_ID 或搜索选择
3. 执行操作 → 参考下方命令
```

## 命令参考

| 命令 | 功能 |
|------|------|
| `auth` | 刷新鉴权凭据（cookie + CSRF） |
| `search <关键词>` | 搜索文档列表，选择目标文档 |
| `select <file_id>` | 直接指定文档 ID |
| `blocks [block_id]` | 查询文档块（默认 root） |
| `get <block_id>` | 获取指定块详情 |
| `insert <block_id> <index> <content>` | 在指定位置插入块 |
| `update <block_id> <content>` | 更新指定块内容 |
| `delete <block_id>` | 删除指定块 |
| `batch-delete <id1> <id2> ...` | 批量删除块 |
| `convert <markdown>` | Markdown → 块数据 |
| `new-doc` | 创建新 AirPage 文档 |

## 鉴权模块

**凭据文件**: `~/.claude/secrets/wps365.json`

```json
{
  "cookie": "wps_sid=...; ...",
  "csrf": "xxxxxx",
  "updated_at": "2026-03-11T00:00:00Z"
}
```

**获取流程**（`auth` 命令或凭据缺失时）:

1. 确认用户已在浏览器打开 `https://365.kdocs.cn`（并打开某个 AirPage 文档以获取 CSRF）
2. 使用 Chrome DevTools MCP 提取：
   - Cookie: `mcp__chrome-devtools__evaluate_script` → `document.cookie`
   - CSRF: `mcp__chrome-devtools__evaluate_script` → `window.__WPSENV__.csrf_token`
3. 写入 `~/.claude/secrets/wps365.json`

**两种凭据用途**:
- `cookie` only → 文件搜索 API
- `cookie` + `x-csrf-rand: <csrf>` → 所有块操作 API

详见: `references/auth.md`

## 文件选择

优先级：
1. 环境变量 `$WPS_FILE_ID`（`export WPS_FILE_ID=xxxxx`）
2. 命令行参数 `--file-id <id>`
3. 执行 `search <关键词>` → 展示列表 → 用户选择

**搜索 API**（仅需 cookie）:
```
GET https://365.kdocs.cn/3rd/drive/api/v6/search/files
  ?offset=0&count=10&sort_by=create_time&order=desc&searchname=<关键词>
```

详见: `references/file-search.md`

## 块操作 API

**统一端点**:
```
POST https://365.kdocs.cn/api/v3/office/file/{file_id}/core/execute
Headers:
  Cookie: <cookie>
  x-csrf-rand: <csrf>
  Content-Type: application/json
```

详见: `references/block-ops.md`（对应 `03_Resources/Work-WPS/Airpage-API-Reference.md`）

## 执行规范

1. 每次操作前检查凭据是否存在，缺失则运行 `auth` 流程
2. 搜索结果格式化为编号列表供用户选择
3. API 响应 `result: "ok"` = 成功，否则展示错误信息
4. 块内容变更后输出受影响的 block_id
5. 批量操作逐条列出结果

## 内容快速参考

**最常用的 block 类型**:

| type | 说明 |
|------|------|
| `paragraph` | 段落 |
| `heading1/2/3` | 标题 |
| `bulletList` | 无序列表 |
| `orderedList` | 有序列表 |
| `code` | 代码块 |
| `table` | 表格 |
| `image` | 图片 |

**inline 类型**:

| type | 说明 |
|------|------|
| `text` | 纯文本 |
| `link` | 链接 |
| `bold/italic/underline/strike` | 格式 |
