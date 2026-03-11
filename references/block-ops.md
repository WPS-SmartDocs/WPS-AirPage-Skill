# 块操作速查

完整 API 文档见: `references/api-reference.md`（安装后放置于同目录）

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

### 批量查询块 (block.query with blockIds)

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
          "type": "paragraph",
          "content": [{"type": "text", "content": "文本内容"}]
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
      "blockId": "<target_block_id>",
      "content": [{"type": "text", "content": "新内容"}]
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
      {"blockId": "id1", "content": [...]},
      {"blockId": "id2", "content": [...]}
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
      "blockId": "<target_block_id>"
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
      "content": "# 标题\n\n段落内容",
      "from": "markdown"
    }
  }
}
```

## 创建新文档

```
POST https://365.kdocs.cn/api/v3/office/new/o/file
Headers: Cookie + x-csrf-rand
Body: { "fname": "新文档名称" }
```

## 常用块内容构造

### 带格式文本

```json
{
  "type": "paragraph",
  "content": [
    {"type": "text", "content": "普通文字"},
    {"type": "text", "content": "加粗", "bold": true},
    {"type": "text", "content": "链接", "href": "https://..."}
  ]
}
```

### 标题

```json
{"type": "heading1", "content": [{"type": "text", "content": "一级标题"}]}
```

### 代码块

```json
{
  "type": "code",
  "language": "javascript",
  "content": [{"type": "text", "content": "const x = 1;"}]
}
```
