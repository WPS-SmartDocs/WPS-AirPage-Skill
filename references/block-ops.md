# 块操作速查

完整 API 文档见: `references/api-reference.md`
块数据结构完整定义见: `references/data-structure.md`
错误码见: `references/error-codes.md`

## ⚠️ 关键限制（必读）

| 场景 | 限制 |
|------|------|
| 查询响应 | `data.result` 是 **base64 编码的 JSON**，必须解码才能读取块数据：`echo "$RESULT" \| base64 -d \| python3 -m json.tool` |
| 插入 index | **必须 >= 1**（title 固定在 index 0），传 0 或负数返回 `invalid operation` |
| blockQuote | content 直接包含 inline 节点（text、br），**不能嵌套 paragraph 子块**，否则返回 `invalid content` |
| 列表段落 | attrs 必须同时含 `contentIndent` 和完整 `listAttrs`（含 `styleType`），缺一返回 `invalid attrs` |
| highLightBlock | 创建时**不支持 `style` 属性**，只支持 `emoji`，传 style 返回 `invalid attrs` |
| picture.sourceKey | **必须是 WPS 内部附件 ID**（如 `E3IJKFJGABQGO`），外部 URL API 接受但不渲染 |
| pictureColumn | 创建时**不支持 `width`/`align`**，只需 content 中放 picture 子块 |
| rangeMarks | 操作涉及 index（插入/删除）时必须忽略 rangeMarks；update_content 时可包含 rangeMarks 以保留评论 |

## 统一端点

```
POST https://365.kdocs.cn/api/v3/office/file/{FILE_ID}/core/execute
Headers:
  Cookie: <cookie>
  x-csrf-rand: <csrf>
  Content-Type: application/json
```

## 操作模板

### 查询块 (block.query)

```json
{
  "command": "http.otl.query",
  "param": {
    "name": "block.query",
    "params": {
      "blockId": "doc"
    }
  }
}
```

> 响应中 `data.result` 是 base64 编码，需解码：
> ```bash
> echo "<data.result值>" | base64 -d | python3 -m json.tool
> ```

### 批量查询块

```json
{
  "command": "http.otl.query",
  "param": {
    "name": "block.query",
    "params": {
      "blockIds": ["blockId1", "blockId2"]
    }
  }
}
```

### 插入块 (block.insert)

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
          "content": [{"type": "text", "content": "标题"}]
        },
        {
          "type": "paragraph",
          "content": [
            {"type": "text", "content": "普通文字"},
            {"type": "text", "content": "加粗", "attrs": {"bold": true}}
          ]
        }
      ]
    }
  }
}
```

### 插入列表（必须含 contentIndent + listAttrs.styleType）

```json
{
  "command": "http.otl.exec",
  "param": {
    "subtype": "block.insert",
    "params": {
      "blockId": "doc",
      "index": 2,
      "content": [
        {
          "type": "paragraph",
          "attrs": { "contentIndent": 1, "listAttrs": { "type": 1, "styleType": 1, "level": 0 } },
          "content": [{"type": "text", "content": "无序列表项"}]
        },
        {
          "type": "paragraph",
          "attrs": { "contentIndent": 1, "listAttrs": { "type": 2, "styleType": 4, "level": 0 } },
          "content": [{"type": "text", "content": "有序列表项"}]
        }
      ]
    }
  }
}
```

### 插入引用块（content 直接是 inline，不嵌套 paragraph）

```json
{
  "command": "http.otl.exec",
  "param": {
    "subtype": "block.insert",
    "params": {
      "blockId": "doc",
      "index": 3,
      "content": [
        {
          "type": "blockQuote",
          "content": [
            {"type": "text", "content": "引用内容第一行", "attrs": {"italic": true}},
            {"type": "br"},
            {"type": "text", "content": "— 作者"}
          ]
        }
      ]
    }
  }
}
```

### 插入代码块（lang 用数字编号，见 data-structure.md）

```json
{
  "command": "http.otl.exec",
  "param": {
    "subtype": "block.insert",
    "params": {
      "blockId": "doc",
      "index": 4,
      "content": [
        {
          "type": "codeBlock",
          "attrs": { "lang": 5 },
          "content": [{"type": "text", "content": "console.log('hello');"}]
        }
      ]
    }
  }
}
```

### 更新块 (block.update)

```json
{
  "command": "http.otl.exec",
  "param": {
    "subtype": "block.update",
    "params": {
      "operation": "update_content",
      "blockId": "<target_block_id>",
      "content": [{"type": "text", "content": "新内容", "attrs": {"bold": true}}]
    }
  }
}
```

更新属性（不改内容）：

```json
{
  "command": "http.otl.exec",
  "param": {
    "subtype": "block.update",
    "params": {
      "operation": "update_attrs",
      "blockId": "<target_block_id>",
      "attrs": { "align": 2 }
    }
  }
}
```

### 批量更新块

```json
{
  "command": "http.otl.exec",
  "param": {
    "subtype": "block.update",
    "params": [
      {"operation": "update_content", "blockId": "id1", "content": [...]},
      {"operation": "update_attrs", "blockId": "id2", "attrs": {"align": 2}}
    ]
  }
}
```

### 删除块 (block.delete)

```json
{
  "command": "http.otl.exec",
  "param": {
    "subtype": "block.delete",
    "params": {
      "blockId": "doc",
      "startIndex": 1,
      "endIndex": 3
    }
  }
}
```

### 批量删除块

```json
{
  "command": "http.otl.exec",
  "param": {
    "subtype": "block.delete",
    "params": [
      {"blockId": "id1"},
      {"blockId": "id2"}
    ]
  }
}
```

### Markdown 转块 (convert)

```json
{
  "command": "http.otl.query",
  "param": {
    "name": "convert",
    "params": {
      "content": "# 标题\n\n- 列表项1\n- 列表项2\n\n```python\nprint('hello')\n```",
      "from": "markdown"
    }
  }
}
```

> 响应的 `data.result` 同样需要 base64 解码。解码后得到 blocks 数组，再用 block.insert 写入。

## 创建新文档

```
POST https://365.kdocs.cn/api/v3/office/new/o/file
Headers: Cookie + x-csrf-rand
Body: { "fname": "新文档名称" }
```

## assets/ 示例文件说明

`assets/` 目录包含可直接使用的块数据 JSON，块结构与本 API 完全兼容。
使用时将 content 数组放入 block.insert 的 `params.content` 字段：

- `create-blocks.json` — 常用块类型示例（heading/paragraph/list/codeBlock）
- `demo-content.json` — 完整富文本演示（含表格、列表、引用、代码、高亮块）
- `update-blocks.json` — update_content 示例
