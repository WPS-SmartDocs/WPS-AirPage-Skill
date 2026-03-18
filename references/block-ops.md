# 块操作速查

优先使用 CLI。只有 CLI 不能直接表达时，再手写 payload。

完整字段定义见 `references/data-structure.md`，错误码见 `references/error-codes.md`，已验证坑点见 `references/verified-behavior.md`。

## 关键限制

| 场景 | 约束 |
|------|------|
| `file_id` | 必须是数字 ID，不接受短链 |
| 插入位置 | `insert --index` 必须 `>= 1` |
| 更新操作 | `block.update` 的 `params` 是数组；CLI 会自动包装 |
| 评论锚点 | 保留评论时，`update_content` 需要保留 `rangeMarkBegin` / `rangeMarkEnd` |
| 图片上传 | `picture.attrs.sourceKey` 必须是 WPS 附件 ID，不是外链 URL |
| 附件上传 | 上传端点必须带 `Origin: https://365.kdocs.cn` |

## 统一端点

```http
POST https://365.kdocs.cn/api/v3/office/file/{FILE_ID}/core/execute
Cookie: <cookie>
x-csrf-rand: <csrf>
Content-Type: application/json
```

## CLI 对应关系

| 任务 | CLI |
|------|-----|
| 查询块 | `node scripts/cli.js query <file_id> [block_id]` |
| 批量查询 | `node scripts/cli.js batch-query <file_id> <id1> <id2>` |
| 插入块 | `node scripts/cli.js insert <file_id> --block-id <id> --index <n> --content <json>` |
| 更新块 | `node scripts/cli.js update <file_id> --body <json>` |
| 删除块 | `node scripts/cli.js delete <file_id> --body <json>` |
| Markdown/HTML 转块 | `node scripts/cli.js convert <file_id> --from markdown --content <text>` |

## 查询块

CLI 默认会把可解码的 `detail.result` 处理成 JSON；如果响应里仍然是字符串，再按 base64 尝试手动解码。

推荐 payload：

```json
{
  "command": "http.otl.query",
  "param": {
    "name": "block.query",
    "params": {
      "blockIds": ["doc"]
    }
  }
}
```

批量查询：

```json
{
  "command": "http.otl.query",
  "param": {
    "name": "block.query",
    "params": {
      "blockIds": ["id1", "id2"]
    }
  }
}
```

## 插入块

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
          "type": "heading",
          "attrs": { "level": 1 },
          "content": [{ "type": "text", "content": "标题" }]
        },
        {
          "type": "paragraph",
          "content": [{ "type": "text", "content": "正文内容" }]
        }
      ]
    }
  }
}
```

## 更新块

`params` 必须是数组：

```json
{
  "command": "http.otl.exec",
  "param": {
    "subtype": "block.update",
    "params": [
      {
        "operation": "update_content",
        "blockId": "target_block_id",
        "content": [{ "type": "text", "content": "更新后的内容" }]
      }
    ]
  }
}
```

常见 `operation`：

| operation | 关键参数 |
|-----------|----------|
| `update_content` | `blockId`, `content[]` |
| `update_attrs` | `blockId`, `attrs{}` |
| `insert_table_rows` | `blockId`, `content[]`, `start?` |
| `insert_table_columns` | `blockId`, `content[]`, `start?` |
| `delete_table_rows` | `blockId`, `start?`, `count` |
| `delete_table_columns` | `blockId`, `start?`, `count` |
| `merge_table_cells` | `blockId`, `startRow?`, `startCol?`, `rowSpan`, `colSpan` |
| `split_table_cell` | `blockId`, `startRow?`, `startCol?` |
| `replace_anchor` | `blockId`, `anchorId`, `content{type,attrs}` |
| `replace_feature` | `blockId`, `source`, `target` |

## 删除块

单次删除：

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

批量删除：

```json
{
  "command": "http.otl.exec",
  "param": {
    "subtype": "block.delete",
    "params": [
      { "blockId": "id1", "startIndex": 1, "endIndex": 2 },
      { "blockId": "id2", "startIndex": 0, "endIndex": 1 }
    ]
  }
}
```

## Markdown / HTML 转块

```json
{
  "command": "http.otl.query",
  "param": {
    "name": "convert",
    "params": {
      "format": "markdown",
      "content": "# 标题"
    }
  }
}
```

返回值中的块数据可直接作为后续 `block.insert` 的 `content`。

## 附件图片

CLI：

```bash
node scripts/cli.js upload-image <file_id> ./photo.jpg --index 1 --width 800 --height 600
```

手写 picture 块时使用上传得到的 `attachment_id`：

```json
{
  "type": "picture",
  "attrs": {
    "sourceKey": "<attachment_id>",
    "width": 800,
    "height": 600
  }
}
```

## assets/

`assets/` 里有现成的块数据示例，可直接喂给 `insert --content @path` 或 `update --body @path`。
