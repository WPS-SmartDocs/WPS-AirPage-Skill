---
name: wps-airpage
version: "1.4.0"
platform: claude-code
platforms:
  - claude-code   # full support incl. MCP auto-auth
  - cursor        # CLI + --browser auth
  - codex         # CLI + --browser auth (see AGENTS.md)
  - gemini        # CLI + --browser auth (copy AGENTS.md → GEMINI.md)
requires:
  - chrome-devtools-mcp  # optional, enables fully-automated auth (claude-code only)
language: zh-CN
description: >
  Use for any operation on a WPS 365 / AirPage / 智能文档 / kdocs online document:
  creating new documents, reading or searching block structure, inserting or editing
  paragraphs and headings, operating tables (merge cells, insert rows), uploading
  images into a doc, adding or querying comments, or converting Markdown/HTML into
  blocks. Triggers on natural Chinese requests mentioning kdocs, AirPage, 智能文档,
  or 365.kdocs.cn — e.g. "帮我在那个 kdocs 文档里加一段", "查一下文档的块结构",
  "创建一个新的 AirPage 文档", "把这段 markdown 插进去", "合并表格单元格",
  "往文档里加评论". Do NOT use for local .docx/.xlsx files, WPS desktop app
  issues, Notion, Google Docs, or generic browser/script automation.
---

# WPS AirPage CLI Skill

Use the local CLI to operate WPS 365 AirPage documents. Prefer the CLI over hand-written HTTP requests. Only read raw API references when the CLI cannot express the requested operation.

## When to Use

**Use this skill when:**
- User wants to modify, inspect, search, or create a WPS 365 AirPage / 智能文档 / kdocs document.
- User mentions adding a paragraph, changing a heading, adding comments, uploading an image, querying block structure, finding a block ID, converting Markdown/HTML, or editing a table inside AirPage.
- User asks to automate a WPS smart doc and the target is clearly AirPage rather than a local Office file.

**Do NOT use for:** local `.docx` / `.xlsx`, WPS desktop troubleshooting, Notion/Google Docs, or generic browser automation unrelated to AirPage.

## Task Flow

收到 AirPage 请求时，严格按此顺序执行。**每步有明确的完成条件，未满足前不得进入下一步。**

1. **检查凭据**：`node scripts/cli.js auth`
   - 有效 → 继续 Step 2。
   - 缺失/过期（>8h）/API 报鉴权错误 → 全自动刷新（**全程不得要求用户手动导航或告知状态**）：
     1. MCP 全自动登录（首选）→ 见 `references/auth.md` 方式零
     2. Chrome DevTools MCP 页面已开 → 方式一
     3. `auth --browser`（Playwright 全自动）→ 方式二
     4. 手动兜底：`auth --set-cookie ... --set-csrf ...`
   - **DO NOT 进入 Step 2，直到 `auth` 返回有效状态。**

2. **确认 `file_id`**
   - 用户给了数字 ID、短链（`365.kdocs.cn/l/xxx`）或文档链接（`/office/o/xxx`）→ 直接传给 CLI，自动解析。
   - 给了文档名/关键词 → `search <keyword>`。
   - 没有明确目标 → 主动询问：搜索已有文档 或 新建文档。
   - 搜索/新建**一律用 CLI 完成**，不得要求用户在浏览器手动操作。
   - **DO NOT 进入 Step 3，直到持有有效的数字 file_id。**

3. **执行操作** → 优先用下方核心命令，复杂 payload 再读对应 reference。

4. **验证结果**：内容变更后用 `query` 回读；评论变更后用 `comments` 复查。
   - **DO NOT 省略此步骤。写操作未经验证等于未完成。**
   - `outline` 对新建文档有索引延迟——验证内容用 `query`，不用 `outline`。

5. **回报用户**：说明文档名、`file_id`、变更内容、验证结果；失败时说明卡在哪一步。

## Core Commands

```bash
node scripts/cli.js                          # 交互式向导（推荐用户直接使用）
node scripts/cli.js auth                     # 检查凭据状态
node scripts/cli.js auth --browser           # 全自动刷新凭据（Playwright）
node scripts/cli.js search <keyword>         # 搜索文档，返回数字 file_id
node scripts/cli.js new-doc --name <名称>   # 新建文档，返回 file_id + doc_url
node scripts/cli.js query <file_id> [block_id]   # 查询块（默认查根节点）
node scripts/cli.js insert-markdown <file_id> --content <text|@file> [--pos begin|end]
node scripts/cli.js outline <file_id> [--format markdown|json]   # 目录结构
node scripts/cli.js update <file_id> --body <json>
node scripts/cli.js insert <file_id> --block-id <id> --index <n> --content <json>
node scripts/cli.js upload-image <file_id> <path> [--index <n>]
node scripts/cli.js comments <file_id>
node scripts/cli.js comment-add <file_id> --sid <id> --text <text>
```

完整命令参数见 `references/block-ops.md`。

## Common Task Patterns

### 插入 Markdown 内容（首选方式）

```bash
node scripts/cli.js auth
node scripts/cli.js search <keyword>   # 拿 file_id
node scripts/cli.js insert-markdown <file_id> --content "# 标题\n正文" --pos end
node scripts/cli.js query <file_id>    # 验证
```

> 精细控制插入位置时才改用 `convert` + `insert`。

### 新建文档并写入内容

```bash
node scripts/cli.js new-doc --name "文档名"
# 输出包含 file_id 和 doc_url（格式：https://365.kdocs.cn/office/o/{fileid}）
node scripts/cli.js insert-markdown <file_id> --content @content.md
```

### 查询 / 修改块

```bash
node scripts/cli.js query <file_id>                          # 查根节点
node scripts/cli.js query <file_id> <block_id>               # 查指定块
node scripts/cli.js update <file_id> --body '[{...}]'        # 更新（必须数组）
node scripts/cli.js query <file_id> <block_id>               # 验证
```

### 评论操作

```bash
node scripts/cli.js comments <file_id>
node scripts/cli.js comment-add <file_id> --sid <sid> --text "评论内容"
node scripts/cli.js comment-update <file_id> --id <cid> --sid <sid> --text "新内容"
```

### 查看文档目录

```bash
node scripts/cli.js outline <file_id>              # markdown 格式，含 tileId
node scripts/cli.js outline <file_id> --format json  # 带 level/attrs 结构
```

## Critical Gotchas（无需读 reference，直接记住）

这 4 条是 Claude 最容易默认踩错的行为，优先级高于直觉：

1. **`outline` 对新建文档有索引延迟**：`outline` 可能返回空，即使内容已写入。验证写入结果一律用 `query` 过滤 heading 块，不用 `outline`。
2. **`update --body` 必须是数组**：即使只更新一个块，也必须用 `'[{...}]'`，单对象会报参数错误（错误码 -152）。
3. **inline 文本字段是 `content` 不是 `text`**：`{ "content": [...] }`，写成 `{ "text": "..." }` 会静默失败。
4. **`rangeMarkBegin` / `rangeMarkEnd` 不是真实块**：计算 insert `--index` 时必须跳过这些标记；`update_content` 时如果想保留评论锚点，需要把这些标记一并带回去。

> 完整坑点列表见 `references/verified-behavior.md`。

## Key Constraints

- `file_id` 接受三种形式：数字 ID、短链（`365.kdocs.cn/l/xxx`）、文档链接（`365.kdocs.cn/office/o/xxx`），CLI 自动解析。
- `insert --index` 必须 `>= 1`（title 固定在 index 0）。
- `update --body` 必须是数组，即使只更新一个块。
- 更新含评论的块时需保留 `rangeMarkBegin` / `rangeMarkEnd`。
- `comment-update` 必须同时传 `comment_id` + `selection_id`。
- `insert-markdown --pos` 只支持 `begin` / `end`。
- `outline` 对新建文档有索引延迟；验证内容改用 `query` 过滤 heading 块。
- 文档 URL 格式：`https://365.kdocs.cn/office/o/{fileid}`（`new-doc` 会自动返回）。

## Security

- 凭据存储于 `~/.claude/secrets/wps365.json`（权限 0600），包含 `cookie` + `csrf`。
- `wps_sid` 是 HttpOnly cookie，只能从网络请求头读取，不得依赖 `document.cookie`。
- CSRF token 只在 AirPage 编辑页（非分享/预览页）的 `window.__WPSENV__.csrf_token` 中可用。
- MCP 鉴权通过拦截浏览器网络请求提取，凭据不会离开本地。
- 凭据超过 8 小时自动提示刷新，避免长期暴露陈旧 session。

## Progressive Disclosure

按需读取，不要预加载所有 reference：

| 场景 | 读取 |
|------|------|
| 凭据刷新失败、MCP 步骤、鉴权错误 | `references/auth.md` |
| 搜索文档、理解 file_id | `references/file-search.md` |
| 构造 insert/update/delete/表格 payload | `references/block-ops.md` |
| 块类型、inline 结构、字段约束 | `references/data-structure.md` |
| 错误码 | `references/error-codes.md` |
| 实测坑点、兼容写法、已验证覆盖范围 | `references/verified-behavior.md` |
| CLI 无法覆盖时（低频） | `references/api-reference.md` |
| 现成块 JSON 示例 | `assets/` |

> 如果 `api-reference.md` 与 `verified-behavior.md` 冲突，以 `verified-behavior.md` 为准。
