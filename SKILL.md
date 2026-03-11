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
| `convert <file_id> --from markdown --content <text>` | Markdown → 块数据 |
| `new-doc --name <名称>` | 创建新 AirPage 文档 |

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

### 方式一：`auth --browser` 脚本（推荐，无需任何 MCP）

```bash
node scripts/cli.js auth --browser
```

首次运行自动安装 playwright + chromium（约 300MB，一次性），之后：
1. 自动弹出 Chrome 窗口
2. 在窗口中登录 WPS → 打开任意 AirPage 文档**编辑页**
3. 脚本检测到编辑器加载后，自动提取完整 Cookie（含 wps_sid）和 CSRF
4. 写入 `~/.claude/secrets/wps365.json`，完成

---

### 方式二：Chrome DevTools MCP（已有 MCP 时使用）

1. 确认浏览器已打开某个 AirPage 文档**编辑页**
2. 用 `mcp__chrome-devtools__get_network_request` 找一个 `365.kdocs.cn` 请求，读取 Request Headers 中的 `Cookie`
3. 用 `mcp__chrome-devtools__evaluate_script` 执行 `() => window.__WPSENV__?.csrf_token` 获取 CSRF
4. 保存：`node scripts/cli.js auth --set-cookie "<cookie>" --set-csrf "<csrf>"`

**如未安装**：`claude mcp add chrome-devtools-mcp -- npx -y chrome-devtools-mcp@latest`

---

### 方式二：手动提取（无需任何 MCP，始终可用）

1. 浏览器打开 AirPage 文档**编辑页**，按 **F12**
2. **Network 标签** → 找任意对 `365.kdocs.cn` 的请求 → Request Headers → 复制 `cookie:` 完整值
3. **Console 标签** → 输入 `window.__WPSENV__.csrf_token` → 复制输出
4. 保存：
   ```bash
   node scripts/cli.js auth --set-cookie "wps_sid=...;..." --set-csrf "GpI+..."
   ```

---

### 方式三：Playwright MCP（部分自动化）

CSRF 可自动提取，Cookie 仍需手动：

- CSRF：`mcp__playwright__browser_evaluate` → `() => window.__WPSENV__?.csrf_token`
- Cookie（含 HttpOnly wps_sid）：需配合方式二的 F12 → Network 步骤手动获取

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

```json
{
  "command": "http.otl.exec",
  "param": {
    "subtype": "block.update",
    "params": {
      "operation": "update_content",
      "blockId": "xxx",
      "content": [...]
    }
  }
}
```

operation 类型: `update_content` / `update_attrs` / `insert_table_rows` / `insert_table_columns` / `delete_table_rows` / `delete_table_columns` / `merge_table_cells` / `split_table_cell` / `replace_anchor` / `replace_feature`

### 删除块

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

> 范围为左闭右开 `[startIndex, endIndex)`。`params` 支持数组形式批量删除。

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
| `picture` | 图片 | `sourceKey`（内部附件 ID）, `width`, `height` |
| `hr` | 分割线 | 无属性 |
| `column` / `columnItem` | 分栏 | columnItem.width（百分比字符串）|
| `pictureColumn` | 并排图（2-5 张）| `width`, `align` |

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

> ⚠️ text 节点字段是 `content` 不是 `text`：`{ "type": "text", "content": "文字" }`

## 参考文件

- `references/block-ops.md` — 操作模板
- `references/data-structure.md` — 完整类型定义
- `references/error-codes.md` — 错误码速查
- `assets/` — 块数据示例 JSON
