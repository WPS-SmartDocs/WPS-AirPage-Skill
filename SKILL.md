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
| `auth --install-mcp` | 安装 Chrome DevTools MCP（推荐，一键，需重启会话）|
| `auth --browser` | 启动浏览器自动提取（无 MCP 时使用）|
| `auth --set-cookie <c> --set-csrf <t>` | 手动保存凭据到 `~/.claude/secrets/wps365.json` |
| `auth --refresh` | 打印手动提取步骤 |
| `search <关键词>` | 搜索文档，返回数字 file_id |
| `query <file_id> [block_id]` | 查询块（默认 doc）|
| `batch-query <file_id> <id1> <id2>` | 批量查询 |
| `insert <file_id> --block-id <id> --index <n> --content <json>` | 插入块（index >= 1）|
| `update <file_id> --body <json>` | 更新块 |
| `delete <file_id> --body <json>` | 删除块 |
| `convert <file_id> --from markdown --content <text>` | Markdown → 块数据 |
| `new-doc --name <名称>` | 创建新 AirPage 文档 |
| `upload-image <file_id> <image_path> [--index <n>] [--width <w>] [--height <h>]` | 上传图片并插入文档（index=0 仅上传不插入）|
| `comments <file_id> [--sids <ids>] [--cids <ids>]` | 查询评论列表 |
| `comment-add <file_id> --sid <selection_id> --text <text> [--reply-id <id>]` | 创建/回复评论 |
| `comment-update <file_id> --id <comment_id> --sid <sid> --text <text>` | 更新评论内容 |

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

- `wps_sid` 是 **HttpOnly cookie**，`document.cookie` / JS 读不到它
- 必须从**网络请求 Headers** 中提取完整 Cookie（包含 wps_sid）
- CSRF token 只在 AirPage **编辑器页面**存在（文档必须在编辑模式打开，不能是纯阅读页）

---

### 方式一：Chrome DevTools MCP【最推荐 — 浏览器已开文档时全自动】

**已装 MCP 时**：浏览器已打开 AirPage 文档编辑页，Claude 执行以下步骤即可，无需用户任何操作：

```
1. mcp__chrome-devtools__list_network_requests  → 找到 365.kdocs.cn 的请求
2. mcp__chrome-devtools__get_network_request    → 读取 Request Headers 里的 cookie 字段
3. mcp__chrome-devtools__evaluate_script        → () => window.__WPSENV__?.csrf_token
4. node scripts/cli.js auth --set-cookie "<cookie>" --set-csrf "<csrf>"
```

**未装 MCP 时，一键安装**：

```bash
# CLI 一键安装（推荐）
node scripts/cli.js auth --install-mcp

# 或手动
claude mcp add chrome-devtools-mcp -- npx -y chrome-devtools-mcp@latest
```

安装后重启 Claude Code 会话，MCP 即生效。之后只要浏览器开着 AirPage 文档，Claude 可随时自动刷新凭据。

---

### 方式二：`auth --browser` 脚本（无任何 MCP、浏览器未开时使用）

```bash
node scripts/cli.js auth --browser
```

首次运行自动安装 playwright + chromium（约 300MB，一次性），之后：
1. 自动弹出 Chrome 窗口
2. 在窗口中登录 WPS → 打开任意 AirPage 文档**编辑页**
3. 脚本检测到编辑器加载后，自动提取完整 Cookie（含 wps_sid）和 CSRF
4. 写入 `~/.claude/secrets/wps365.json`，完成

---

### 方式三：手动 F12（兜底，无需任何工具）

1. 浏览器打开 AirPage 文档**编辑页**，按 **F12**
2. **Network 标签** → 找任意对 `365.kdocs.cn` 的请求 → Request Headers → 复制 `cookie:` 完整值
3. **Console 标签** → 输入 `window.__WPSENV__.csrf_token` → 复制输出
4. 保存：
   ```bash
   node scripts/cli.js auth --set-cookie "wps_sid=...;..." --set-csrf "GpI+..."
   ```

---

### 保存凭据

```bash
node scripts/cli.js auth --set-cookie "<完整cookie>" --set-csrf "<csrf>"
```

## 文件 ID（关键！）

**必须使用数字 ID，不能用短链。**

```bash
# 正确：252348553676
node scripts/cli.js query 252348553676

# 错误：cs4GHvOQrp2w（短链，API 会报错）
```

获取数字 file_id：
1. `search <关键词>` 返回的 `[ID: xxxxxx]` 即为数字 ID
2. `window.__WPSENV__.file_info.file.id` 也是数字 ID

## 评论 API

评论走独立端点（非 core/execute），仅需 Cookie + x-csrf-rand。

```
POST /api/v3/office/outline/file/{file_id}/comment
GET  /api/v3/office/outline/file/{file_id}/comments
```

**创建评论**：`selection_id` 可以是任意自定义字符串（作为评论锚点 ID），不需要预先创建选区。

```json
{ "selection_id": "my-anchor-01", "content": { "text": "评论内容" }, "type": 0 }
```

**回复评论**：额外传 `reply_id`（被回复的 comment_id）。

```json
{ "selection_id": "my-anchor-01", "reply_id": "<comment_id>", "content": { "text": "回复内容" }, "type": 0 }
```

**更新评论**：传 `id`（comment_id）+ `selection_id` + 新 `content`，`selection_id` 不可省略。

```json
{ "id": "<comment_id>", "selection_id": "my-anchor-01", "content": { "text": "更新后内容" } }
```

**查询评论**：

```
GET /comments?sids=sid1,sid2   ← 按选区过滤
GET /comments?cids=id1,id2     ← 按评论 ID 过滤
GET /comments?pageno=0&size=20&order=desc  ← 分页
```

> ⚠️ 更新评论时必须传 `selection_id`，否则返回 "selection id invalid"

## 附件上传（图片/视频/文件）

上传附件获取 `attachment_id`，再作为 `sourceKey` 插入 picture/video 块。

**CLI（推荐）**：

```bash
# 上传并插入图片（index=1 插在第一个内容块位置）
node scripts/cli.js upload-image <file_id> ./photo.jpg --index 1 --width 800 --height 600

# 仅上传，返回 attachment_id（后续手动插入）
node scripts/cli.js upload-image <file_id> ./photo.jpg --index 0
```

**原始 API 三步流程**（`scripts/attachment.js` 已封装）：

```
# Step 1: 获取上传地址
POST /api/v3/office/file/{file_id}/attachment/upload/address
Headers: Cookie / Content-Type / Origin: https://365.kdocs.cn   ← Origin 必须加，否则 SessionDeleted
Body: { name, size, sha1 }  → 返回 { request: {url,method,headers}, upload_id }

# Step 2: 上传二进制到存储
{request.method} {request.url}
Headers: ...request.headers + Content-Type: application/octet-stream
Body: <file binary>  → Response Headers: etag / x-obs-save-key

# Step 3: 提交完成
POST /api/v3/office/file/{file_id}/attachment/upload/complete
Body: { upload_id, params: { etag, key } }  → 返回 { attachment_id }
```

> ✅ `file_id` 支持数字 ID，无需 link_id
> ⚠️ `Origin: https://365.kdocs.cn` 头是必须的，缺少会返回 SessionDeleted

**picture 块插入示例**（上传后）：

```json
{
  "type": "picture",
  "attrs": { "sourceKey": "<attachment_id>", "width": 800, "height": 600 }
}
```

## 块操作 API 格式（经过验证）

**统一端点**:

```
POST https://365.kdocs.cn/api/v3/office/file/{数字file_id}/core/execute
Headers:
  Cookie: <完整cookie含wps_sid>
  x-csrf-rand: <csrf>
  Content-Type: application/json
```

### 查询块（单个）

```json
{
  "command": "http.otl.query",
  "param": {
    "name": "block.query",
    "params": { "blockId": "doc" }
  }
}
```

> ⚠️ **单个查询用 `blockId`（字符串），批量查询用 `blockIds`（数组）**
> 若单个查询报 1001，改用 `blockIds: ["doc"]` 数组形式也有效。

### 查询块（批量）

```json
{
  "command": "http.otl.query",
  "param": {
    "name": "block.query",
    "params": { "blockIds": ["id1", "id2"] }
  }
}
```

查询响应的 `detail.result` 是**直接的 JSON 对象**（含 `blocks` 数组和 `version`），不是 base64。

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
        {
          "type": "paragraph",
          "content": [{ "type": "text", "content": "Hello" }]
        }
      ]
    }
  }
}
```

> `index` 默认 0，title 固定在 0，**实际插入从 1 开始**；负数表示首个子节点，超出范围则追加末尾。

### 更新块

> ⚠️ **`params` 必须是数组**（即使只有一个操作）。传单个对象会返回 `ExecuteFailed Invalid parameter`。CLI 已自动处理包装。

```json
{
  "command": "http.otl.exec",
  "param": {
    "subtype": "block.update",
    "params": [
      {
        "operation": "update_content",
        "blockId": "xxx",
        "content": [...]
      }
    ]
  }
}
```

operation 类型及关键参数（均已通过 CLI 验证 ✅）:

| operation | 必填参数 | 说明 |
|-----------|---------|------|
| `update_content` | `blockId`, `content[]` | 更新块内容 |
| `update_attrs` | `blockId`, `attrs{}` | 更新块属性 |
| `insert_table_rows` | `blockId`, `content[]`（行数组，每行含列数个 tableCell）| `start` 可选，插入位置 |
| `insert_table_columns` | `blockId`, `content[]`（行数数组，每行含 1 个 tableCell）| `start` 可选，需与表格行数对齐 |
| `delete_table_rows` | `blockId`, `count`（≥1）| `start` 可选（起始行号），`start+count` ≤ 总行数 |
| `delete_table_columns` | `blockId`, `count`（≥1）| `start` 可选（起始列号） |
| `merge_table_cells` | `blockId`, `rowSpan`, `colSpan`（不可同时为 1）| `startRow`/`startCol` 可选 |
| `split_table_cell` | `blockId` | `startRow`/`startCol` 可选，目标必须是合并单元格 |
| `replace_anchor` | `blockId`, `anchorId`, `content{type,attrs{}}` | `content.attrs` 须嵌套；无匹配返回 "no match block anchor" |
| `replace_feature` | `blockId`, `source{type,attrs{}}`, `target{type,attrs{}}` | 支持 WPSUser/WPSDocument/schedule；无匹配返回 1014 |

### 删除块（单个）

```json
{
  "command": "http.otl.exec",
  "param": {
    "subtype": "block.delete",
    "params": {
      "blockId": "doc",
      "startIndex": 1,
      "endIndex": 2
    }
  }
}
```

> 范围为左闭右开 `[startIndex, endIndex)`。

### 删除块（批量）

```json
{
  "command": "http.otl.exec",
  "param": {
    "subtype": "block.delete",
    "params": [
      { "blockId": "xxx1", "startIndex": 1, "endIndex": 2 },
      { "blockId": "xxx2", "startIndex": 0, "endIndex": 1 }
    ]
  }
}
```

### 转换 Markdown

```json
{
  "command": "http.otl.query",
  "param": {
    "name": "convert",
    "params": { "format": "markdown", "content": "# 标题" }
  }
}
```

> ⚠️ 参数是 `format`（不是 `from`）

### RangeMark（评论区间标记）

查询块时，`content` 数组中可能出现 `rangeMarkBegin` / `rangeMarkEnd` 节点：

```json
{ "type": "rangeMarkBegin", "id": "abc", "data": [{ "type": "comment", "ids": ["..."] }] }
{ "type": "rangeMarkEnd", "id": "abc" }
```

> ⚠️ **重要**：
> - 调用 `insert` / `delete` 时，index 计算需**忽略** rangeMark 节点（它们不占真实位置）
> - 调用 `update_content` 时，若希望**保留评论**，需将查询到的 rangeMark 节点原样放入 `content`

## 块类型快速参考

**常用 block 类型**（完整定义见 `references/data-structure.md`）:

| type | 说明 | 关键属性 |
|------|------|----------|
| `paragraph` | 段落/列表项 | `align`, `contentIndent`, `listAttrs` |
| `heading` | 标题 H1-H6 | `attrs.level`（1-6） |
| `blockQuote` | 引用 | content 直接是 inline 数组，`br` 换行 |
| `codeBlock` | 代码块 | `attrs.lang`（数字，见 data-structure）, `autoWrap`, `theme` |
| `highLightBlock` | 高亮块 | `attrs.emoji`（必填）, `attrs.style`（可选：fontColor/backgroundColor/borderColor）|
| `table` | 表格 | 含 tableRow > tableCell > paragraph |
| `picture` | 图片 | `attrs.sourceKey`（attachment_id）, `attrs.width`, `attrs.height` |
| `video` | 视频 | `attrs.sourceId`（视频资源 id）, `attrs.sourceKey`（封面图 id）, `attrs.width`, `attrs.height` |
| `audio` | 音频 | `attrs.sourceId`（音频资源 id）, `attrs.title` |
| `hr` | 分割线 | 无属性 |
| `column` / `columnItem` | 分栏 | columnItem.width（百分比字符串）|
| `pictureColumn` | 并排图（2-5 张）| `width`, `align` |
| `lockBlock` | 内容保护区（仅创建者可编辑）| 无属性 |
| `blockAnchor` | 占位节点（loading 样式）| `id`（必填）, `aimType`（picture/video/processon/spreadsheet）, `width`, `height` |

**inline 类型**（`content` 字段存文本，不是 `text`）:

| type | 说明 | 关键属性 |
|------|------|----------|
| `text` | 文本 | `content`（必填）; attrs: bold/italic/underline/strike/color/fontSize |
| `br` | 换行（仅 blockQuote 内）| 无 |
| `emoji` | 表情 | `attrs.emoji` |
| `linkView` | 超链接 | title/url/viewType/sourceKey/description |
| `WPSUser` | @人 | userId/name |
| `WPSDocument` | 云文档/附件 | wpsDocumentId/wpsDocumentName/viewType |
| `latex` | 公式 | latexStr/width/height |
| `schedule` | 日程 | id/name/startTime/endTime（unix ms）|
| `staticTime` | 日期 | time（unix ms）, timeType（1-日期/2-日期时间）|

> ⚠️ text 节点字段是 `content` 不是 `text`：`{ "type": "text", "content": "文字" }`

## API 验证状态（file_id: 500419903935）

以下所有操作均通过 CLI (`node scripts/cli.js`) 实测验证 ✅：

| 操作 | 命令 | 状态 |
|------|------|------|
| 搜索文档 | `search` | ✅ |
| 查询块 | `query` / `batch-query` | ✅ |
| 插入块 | `insert` | ✅ |
| update_content | `update --body '[{...}]'` | ✅ |
| update_attrs | `update --body '[{...}]'` | ✅ |
| insert_table_rows | `update` | ✅ |
| insert_table_columns | `update` | ✅ |
| delete_table_rows | `update` | ✅ |
| delete_table_columns | `update` | ✅ |
| merge_table_cells | `update` | ✅ |
| split_table_cell | `update` | ✅ |
| replace_anchor | `update` | ✅（无匹配锚点时返回 "no match block anchor"，格式正确）|
| replace_feature | `update` | ✅（无匹配特性时返回 1014，格式正确）|
| 删除块 | `delete` | ✅ |
| Markdown 转换 | `convert` | ✅ |
| 创建文档 | `new-doc` | ✅ |
| 附件上传（图片）| `upload-image` | ✅（attachment_id=`EAPFAIRGACADE`，picture 块插入成功）|
| 评论查询 | `comments` | ✅ |
| 评论创建 | `comment-add` | ✅（`selection_id` 可自定义任意字符串）|
| 评论回复 | `comment-add --reply-id` | ✅ |
| 评论更新 | `comment-update` | ✅（需同时传 `--sid`）|

**已修正的 API 格式问题（避免重蹈）**：
1. `block.query` 单个查询也用 `blockIds: ["id"]` 数组形式（singular `blockId` 返回 1001）
2. `block.update` 的 `params` 必须是**数组** `[{...}]`，单对象返回 500410002
3. `convert` 参数是 `format`，不是 `from`
4. text inline 节点字段是 `content`，不是 `text`
5. `delete_table_rows`/`delete_table_columns` 参数是 `start`/`count`，不是 `startIndex`/`endIndex`
6. `replace_anchor` 的 `content` 格式：`{"type": "picture", "attrs": {...}}`（attrs 嵌套）
7. 附件上传端点必须加 `Origin: https://365.kdocs.cn` 头，否则返回 SessionDeleted（与 core/execute 不同）

## 参考文件

- `references/block-ops.md` — 操作模板
- `references/data-structure.md` — 完整类型定义
- `references/error-codes.md` — 错误码速查
- `assets/` — 块数据示例 JSON
