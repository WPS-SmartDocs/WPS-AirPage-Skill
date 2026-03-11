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
1. 鉴权   → 读缓存 / Chrome DevTools MCP 提取（见下方详细步骤）
2. 选文档  → search 获取数字 file_id（非短链！）
3. 执行操作 → 参考下方命令
```

## CLI 命令参考

| 命令 | 示例 |
|------|------|
| `auth --set-cookie <c> --set-csrf <t>` | 保存凭据到 `~/.claude/secrets/wps365.json` |
| `auth --refresh` | 打印提取步骤 |
| `search <关键词>` | 搜索文档，返回数字 file_id |
| `query <file_id> [block_id]` | 查询块（默认 doc）|
| `batch-query <file_id> <id1> <id2>` | 批量查询 |
| `insert <file_id> --block-id <id> --index <n> --content <json>` | 插入块（index >= 1）|
| `update <file_id> --body <json>` | 更新块 |
| `delete <file_id> --body <json>` | 删除块 |
| `convert <file_id> --content <text>` | Markdown → 块数据 |
| `new-doc --name <名称>` | 创建新 AirPage 文档 |
| `decode <base64>` | 解码 base64（通常不需要，响应已自动处理）|

## 鉴权：获取 Cookie 和 CSRF

**凭据文件**: `~/.claude/secrets/wps365.json`

```json
{
  "cookie": "wps_sid=...; kso_sid=...; ...",
  "csrf": "GpI+ztTX...",
  "updated_at": "2026-03-11T00:00:00Z"
}
```

### ⚠️ 关键约束

- `wps_sid` 是 HttpOnly cookie，**`document.cookie` 读不到它**
- 必须从网络请求 Headers 中提取完整 Cookie
- CSRF token 只在 AirPage **编辑器页面**存在（非纯阅读/分享页）

### 快速获取步骤（Chrome DevTools MCP）

**Step 1 — 获取完整 Cookie（从网络请求头）**

```
1. 打开 https://365.kdocs.cn 并进入任意 AirPage 文档编辑页
2. 在 Chrome DevTools MCP 中列出网络请求，找一个对 365.kdocs.cn 的请求
3. 读取该请求的 Request Headers 中的 Cookie 字段
   （包含 wps_sid、kso_sid 等 HttpOnly cookie）
```

**Step 2 — 获取 CSRF Token**

```javascript
// Chrome DevTools MCP evaluate_script:
() => window.__WPSENV__?.csrf_token
```

**Step 3 — 保存凭据**

```bash
node scripts/cli.js auth \
  --set-cookie "wps_sid=V04...; kso_sid=..." \
  --set-csrf "GpI+ztTX..."
```

## 文件 ID（关键！）

**必须使用数字 ID，不能用短链。**

```bash
# 正确：252348553676
node scripts/cli.js query 252348553676

# 错误：cs4GHvOQrp2w（短链，API 会报错）
```

获取数字 file_id：
1. `search <关键词>` 命令返回的 `[ID: xxxxxx]` 即为数字 ID
2. 浏览器中打开文档后，`window.__WPSENV__.file_info.file.id` 也是数字 ID

## 块操作 API 格式（经过验证）

**统一端点**:

```
POST https://365.kdocs.cn/api/v3/office/file/{数字file_id}/core/execute
Headers:
  Cookie: <完整cookie含wps_sid>
  x-csrf-rand: <csrf>
  Content-Type: application/json
```

### 查询块（已验证）

```json
{
  "command": "http.otl.query",
  "param": {
    "name": "block.query",
    "params": { "blockIds": ["doc"] }
  }
}
```

⚠️ **必须用 `blockIds`（数组），不是 `blockId`（单个字符串），否则报 1001 错误**

响应的 `detail.result` 是**直接的 JSON 对象**（不是 base64），包含 `blocks` 数组和 `version`。

### 插入块（已验证）

```json
{
  "command": "http.otl.exec",
  "param": {
    "subtype": "block.insert",
    "params": {
      "blockId": "doc",
      "index": 1,
      "content": [
        { "type": "paragraph", "content": [{ "type": "text", "text": "Hello" }] }
      ]
    }
  }
}
```

**`index` 必须 >= 1**（index 0 是 title，不可操作）

### 更新块、删除块

详见 `references/block-ops.md`

## 执行规范

1. 每次操作前检查凭据是否存在，缺失则运行鉴权流程
2. `search` 结果格式化为编号列表供用户选择，展示数字 file_id
3. API 响应 `result: "ok"` = 成功，否则对照 `references/error-codes.md` 展示错误
4. `detail.result` 是对象时直接使用；若为字符串则尝试 base64 解码
5. 插入/更新操作后输出响应的 `version` 字段确认成功

## 内容快速参考

**常用 block 类型**（完整定义见 `references/data-structure.md`）:

| type | 说明 | 关键属性 |
|------|------|----------|
| `paragraph` | 段落/列表项 | `align`, `contentIndent`, `listAttrs` |
| `heading` | 标题 H1-H6 | `attrs.level`（1-6） |
| `blockQuote` | 引用 | content 直接是 inline，含 `br` 换行 |
| `codeBlock` | 代码块 | `attrs.lang`（数字编号，见 data-structure） |
| `highLightBlock` | 高亮块 | `attrs.emoji`，不支持 style |
| `table` | 表格 | 包含 tableRow > tableCell > paragraph |
| `picture` | 图片 | `sourceKey`（内部附件 ID）, `width`, `height` |
| `hr` | 分割线 | 无属性 |

**inline 类型**:

| type | 说明 |
|------|------|
| `text` | 文本，attrs 含 bold/italic/underline/strike/color/fontSize |
| `br` | 换行（仅用于 blockQuote 内） |
| `emoji` | 表情 |
| `linkView` | 超链接视图 |

## 参考文件

- `references/block-ops.md` — 操作模板 + 关键限制
- `references/data-structure.md` — 完整块/行内类型定义
- `references/error-codes.md` — AirPage 错误码速查
- `assets/` — 可直接使用的块数据示例 JSON
