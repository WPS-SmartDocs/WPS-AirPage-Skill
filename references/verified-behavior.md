# 已验证行为与坑点

这份记录优先级高于旧的逆向笔记。若 `api-reference.md` 与这里冲突，以这里为准。

## 已验证命令覆盖

| 操作 | 命令 | 状态 |
|------|------|------|
| 搜索文档 | `search` | ✅ |
| 查询块 | `query` / `batch-query` | ✅ |
| 插入块 | `insert` | ✅ |
| 更新内容 | `update --body '[{...}]'` | ✅ |
| 更新属性 | `update --body '[{...}]'` | ✅ |
| 插入表格行 | `update` | ✅ |
| 插入表格列 | `update` | ✅ |
| 删除表格行 | `update` | ✅ |
| 删除表格列 | `update` | ✅ |
| 合并单元格 | `update` | ✅ |
| 拆分单元格 | `update` | ✅ |
| 替换锚点 | `update` | ✅ |
| 替换特性 | `update` | ✅ |
| 删除块 | `delete` | ✅ |
| Markdown 转换 | `convert` | ✅ |
| 创建文档 | `new-doc` | ✅ |
| 上传图片 | `upload-image` | ✅ |
| 查询评论 | `comments` | ✅ |
| 创建评论 | `comment-add` | ✅ |
| 回复评论 | `comment-add --reply-id` | ✅ |
| 更新评论 | `comment-update` | ✅ |

## 鉴权检测坑点

- `/latest` 首页登录后，`window.__userId` 和 `window.__WPSENV__` 可能为 null/undefined，但 `document.cookie` 里已有 `uid=<数字>`。
- 正确的登录检测需三路兜底：`window.__userId || window.__WPSENV__?.uid || /uid=\d+/.test(document.cookie)`。
- `window.__WPSENV__.csrf_token` 只在 AirPage **编辑页**（URL 含 `/doc/`）加载后才出现；首页、分享页、预览页均为 null。

## outline API 坑点

- `queryContentByStyle`（`outline` 命令）对**新建文档**可能立即返回空列表，即使内容已成功插入。
- 原因：服务端索引有一定延迟（通常几秒到几十秒）。
- 验证文档内容应使用 `query <file_id> doc`，可立即看到块数据；`outline` 仅用于目录导航。
- 如需确认 heading 已写入：从 `query` 结果中过滤 `type === "heading"` 的块即可。

## new-doc 响应与 URL 坑点

- `new-doc` 成功时服务端只返回 `{"fileid": "<id>"}`,不含 `result:"ok"`，CLI 已兼容处理。
- 文档 URL 格式为 `https://365.kdocs.cn/office/o/{fileid}`，无需 `groupid`。
- `fname` 仅设置文件名（搜索可见），文档内部标题块（index 0，`type: "title"`）默认为空。
- CLI **不会**自动写入 title 块（cli.js `new-doc` 命令仅调用 `newDoc()`，无后续写入逻辑）。`new-doc` 后必须手动：先 `query <file_id>` 拿到 title 块 ID，再用 `update` 写入内容。title 块的 `content` 字段结构与 paragraph 相同（inline 数组），不能用 `update_content` 的 `replace_text` op（会报 invalid operation）。

## 关键坑点

1. `block.query` 优先使用 `blockIds: ["id"]` 数组形式；CLI 已默认这样做。
2. `block.update` 的 `params` 必须是数组；单对象会报参数错误。
3. `convert` 的参数名是 `format`，不是 `from`。
4. inline 文本节点字段是 `content`，不是 `text`。
5. `delete_table_rows` / `delete_table_columns` 使用 `start` + `count`。
6. `replace_anchor` 的 `content` 需要 `{"type": "...", "attrs": {...}}` 结构。
7. 附件上传端点必须加 `Origin: https://365.kdocs.cn`，否则可能返回 `SessionDeleted`。
8. 更新评论时必须传 `selection_id`，否则会报 `selection id invalid`。

## 查询结果兼容说明

- CLI 查询输出会尝试自动解码 `detail.result`。
- 如果服务端返回的是 base64 字符串，CLI 会解码为 JSON。
- 如果服务端已经直接返回 JSON 对象，CLI 会原样保留。
- 因此文档编写时应以“CLI 输出最终可直接消费”为准，而不是假设服务端只有一种编码形式。

## 带评论块的更新

查询结果里可能出现：

```json
{ "type": "rangeMarkBegin", "id": "abc", "data": [{ "type": "comment", "ids": ["..."] }] }
{ "type": "rangeMarkEnd", "id": "abc" }
```

- 做 `insert` / `delete` 时，计算 index 要忽略这些标记。
- 做 `update_content` 时，如果想保留评论锚点，需要把这些标记一并带回去。
