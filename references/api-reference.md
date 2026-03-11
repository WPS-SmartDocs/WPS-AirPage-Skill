---
title: Airpage 智能文档 API 参考手册
tags:
  - wps
  - airpage
  - api
  - 智能文档
  - reference
date: 2026-03-11
status: active
---

# Airpage 智能文档 API 参考手册

## 1. 概述

### 1.1 统一请求端点

内部系统已将 WPS 开放平台的 Airpage API 统一封装为单一 POST 端点：

```
POST https://365.kdocs.cn/api/v3/office/file/{file_id}/core/execute
```

所有块操作均通过该端点发送，不再使用原始的 `openapi.wps.cn` 地址和 KSO-1 签名。

### 1.2 Command 结构

根据操作类型分为两种 command：

**写操作（创建/更新/删除）** 使用 `http.otl.exec`：

```json
{
    "command": "http.otl.exec",
    "param": {
        "subtype": "<subtype>",
        "params": { ... }
    }
}
```

**读操作（查询/转换）** 使用 `http.otl.query`：

```json
{
    "command": "http.otl.query",
    "param": {
        "name": "<name>",
        "params": { ... }
    }
}
```

### 1.3 响应格式

**成功：**

```json
{
    "detail": {
        "result": "ok"
    },
    "result": "ok"
}
```

**失败：**

```json
{
    "code": -1,
    "message": "",
    "msg": "",
    "result": "ExecuteFailed"
}
```

### 1.4 关键差异说明

| 项目 | 原始 API | 内部封装 |
|------|----------|----------|
| 端点 | 每个 API 独立 URL | 统一 POST 端点 |
| 签名 | KSO-1 | 无需（内部鉴权） |
| 参数字段名 | `arg` | `params` |
| 编码 | base64 编码 | 直接 JSON |

---

## 2. API 快速参考表

| API | 功能 | command | subtype / name |
|-----|------|---------|----------------|
| 创建块内容 | 在指定块中插入内容 | `http.otl.exec` | subtype: `block.insert` |
| 查询文档块 | 查询文档中的块 | `http.otl.query` | name: `block.query` |
| 批量查询块 | 批量查询文档中的块 | `http.otl.query` | name: `block.query` |
| 更新文档块 | 对指定块进行更新操作 | `http.otl.exec` | subtype: `block.update` |
| 批量更新块 | 批量调用块的更新操作 | `http.otl.exec` | subtype: `block.update`（数组形式） |
| 删除块内容 | 删除指定块的内容 | `http.otl.exec` | subtype: `block.delete` |
| 批量删除块内容 | 批量删除指定块的内容 | `http.otl.exec` | subtype: `block.delete`（数组形式） |
| 转换文档块 | 将 Markdown/HTML 转化为块数据 | `http.otl.query` | name: `convert` |

---

## 3. 创建块内容 (block.insert)

在指定块中插入内容。

### 请求示例

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
                    "content": [
                        {
                            "type": "text",
                            "content": "测试文本"
                        }
                    ]
                }
            ]
        }
    }
}
```

### 参数说明

| 名称 | 类型 | 必填 | 说明 |
|------|------|------|------|
| blockId | string | 是 | 父块 ID，为 `"doc"` 表示插入文档根级别 |
| index | integer | 否 | 插入位置。小于 0 作为父块首个子节点；大于子节点数量则作为末尾子节点。默认 0 |
| content | array | 是 | 创建的节点数组，作为父块的内容 |

### 响应体

```yaml
response:
  type: object
  properties:
    code:
      type: integer
      description: 正常情况下为 0
    msg:
      type: string
      description: 错误信息
    data:
      type: object
      properties:
        results:
          type: object
          properties:
            blockId:
              type: string
              description: 父块 ID
            version:
              type: integer
              description: 文档数据版本
```

### 响应示例

```json
{
    "code": 0,
    "msg": "",
    "data": {
        "results": {
            "blockId": "doc",
            "version": 21
        }
    }
}
```

---

## 4. 查询文档块 (block.query)

查询文档中的块。

### 请求示例

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

### 参数说明

| 名称 | 类型 | 必填 | 说明 |
|------|------|------|------|
| blockId | string | 是 | 块 ID，为 `"doc"` 查询文档块 |

### 响应示例

```json
{
    "code": 0,
    "msg": "",
    "data": {
        "result": {
            "blocks": [
                {
                    "attrs": {
                        "align": 1
                    },
                    "content": [
                        {
                            "content": "123",
                            "type": "text"
                        }
                    ],
                    "id": "xxx",
                    "type": "paragraph"
                }
            ],
            "version": 1
        }
    }
}
```

---

## 5. 批量查询块 (block.query - 批量)

批量查询文档中的块。与单个查询的区别在于：传 `blockIds`（数组）而非 `blockId`（字符串）。

### 请求示例

```json
{
    "command": "http.otl.query",
    "param": {
        "name": "block.query",
        "params": {
            "blockIds": ["xxx1", "xxx2"]
        }
    }
}
```

### 参数说明

| 名称 | 类型 | 必填 | 说明 |
|------|------|------|------|
| blockIds | array\<string\> | 是 | 块 ID 数组，`"doc"` 表示查询文档块 |

### 响应体

同查询文档块的响应体。

---

## 6. 更新文档块 (block.update)

对指定块进行更新操作。根据 `operation` 字段区分不同操作类型。

### 6.1 update_content - 更新块内容

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

| 名称 | 类型 | 必填 | 说明 |
|------|------|------|------|
| blockId | string | 是 | 块 ID，为 `"doc"` 表示更新文档内容 |
| operation | string | 是 | 固定为 `"update_content"` |
| content | array | 是 | 块的内容，不包含块自身 |

### 6.2 update_attrs - 更新块属性

```json
{
    "command": "http.otl.exec",
    "param": {
        "subtype": "block.update",
        "params": {
            "operation": "update_attrs",
            "blockId": "xxx",
            "attrs": {}
        }
    }
}
```

| 名称 | 类型 | 必填 | 说明 |
|------|------|------|------|
| blockId | string | 是 | 块 ID |
| operation | string | 是 | 固定为 `"update_attrs"` |
| attrs | object | 是 | 块属性 |

> 注意：目前不支持 doc、appComponent、lockBlock 设置属性。tableCell 的 colspan 和 rowspan 属性请通过表格相关操作设置。

### 6.3 insert_table_rows - 插入表格行

blockId 对应块必须为 table。

```json
{
    "command": "http.otl.exec",
    "param": {
        "subtype": "block.update",
        "params": {
            "operation": "insert_table_rows",
            "blockId": "xxx",
            "start": 0,
            "content": [
                {
                    "type": "tableRow",
                    "content": [
                        {
                            "type": "tableCell",
                            "content": [
                                {
                                    "type": "paragraph"
                                }
                            ]
                        }
                    ]
                }
            ]
        }
    }
}
```

| 名称 | 类型 | 必填 | 说明 |
|------|------|------|------|
| blockId | string | 是 | 块 ID，对应块必须是 table |
| operation | string | 是 | 固定为 `"insert_table_rows"` |
| start | integer | 否 | 行索引，默认 0 |
| content | array | 是 | 表格行数组，需与表格列数对齐 |

### 6.4 insert_table_columns - 插入表格列

blockId 对应块必须为 table。

```json
{
    "command": "http.otl.exec",
    "param": {
        "subtype": "block.update",
        "params": {
            "operation": "insert_table_columns",
            "blockId": "xxx",
            "start": 0,
            "content": [
                {
                    "type": "tableRow",
                    "content": [
                        {
                            "type": "tableCell",
                            "content": [
                                {
                                    "type": "paragraph"
                                }
                            ]
                        }
                    ]
                }
            ]
        }
    }
}
```

| 名称 | 类型 | 必填 | 说明 |
|------|------|------|------|
| blockId | string | 是 | 块 ID，对应块必须是 table |
| operation | string | 是 | 固定为 `"insert_table_columns"` |
| start | integer | 否 | 列索引，默认 0 |
| content | array | 是 | 表格行数组，需与表格行数对齐 |

### 6.5 delete_table_rows - 删除表格行

```json
{
    "command": "http.otl.exec",
    "param": {
        "subtype": "block.update",
        "params": {
            "operation": "delete_table_rows",
            "blockId": "xxx",
            "start": 0,
            "count": 1
        }
    }
}
```

| 名称 | 类型 | 必填 | 说明 |
|------|------|------|------|
| blockId | string | 是 | 块 ID，对应块必须是 table |
| operation | string | 是 | 固定为 `"delete_table_rows"` |
| start | integer | 否 | 起始行号，默认 0 |
| count | integer | 是 | 行数，至少为 1，行号 + 行数不可超过表格最大行数 |

### 6.6 delete_table_columns - 删除表格列

```json
{
    "command": "http.otl.exec",
    "param": {
        "subtype": "block.update",
        "params": {
            "operation": "delete_table_columns",
            "blockId": "xxx",
            "start": 0,
            "count": 1
        }
    }
}
```

| 名称 | 类型 | 必填 | 说明 |
|------|------|------|------|
| blockId | string | 是 | 块 ID，对应块必须是 table |
| operation | string | 是 | 固定为 `"delete_table_columns"` |
| start | integer | 否 | 起始列号，默认 0 |
| count | integer | 是 | 列数，至少为 1，列号 + 列数不可超过表格最大列数 |

### 6.7 merge_table_cells - 合并单元格

```json
{
    "command": "http.otl.exec",
    "param": {
        "subtype": "block.update",
        "params": {
            "operation": "merge_table_cells",
            "blockId": "xxx",
            "startRow": 0,
            "startCol": 0,
            "rowSpan": 2,
            "colSpan": 3
        }
    }
}
```

| 名称 | 类型 | 必填 | 说明 |
|------|------|------|------|
| blockId | string | 是 | 块 ID，对应块必须是 table |
| operation | string | 是 | 固定为 `"merge_table_cells"` |
| startRow | integer | 否 | 起始行号，默认 0 |
| startCol | integer | 否 | 起始列号，默认 0 |
| rowSpan | integer | 是 | 合并行数，为 1 代表不合并（rowSpan 和 colSpan 不可同时为 1） |
| colSpan | integer | 是 | 合并列数，为 1 代表不合并 |

### 6.8 split_table_cell - 拆分单元格

单元格必须为合并单元格。

```json
{
    "command": "http.otl.exec",
    "param": {
        "subtype": "block.update",
        "params": {
            "operation": "split_table_cell",
            "blockId": "xxx",
            "startRow": 0,
            "startCol": 0
        }
    }
}
```

| 名称 | 类型 | 必填 | 说明 |
|------|------|------|------|
| blockId | string | 是 | 块 ID，对应块必须是 table，单元格必须为合并单元格 |
| operation | string | 是 | 固定为 `"split_table_cell"` |
| startRow | integer | 否 | 起始行号，默认 0 |
| startCol | integer | 否 | 起始列号，默认 0 |

### 6.9 replace_anchor - 替换占位节点

替换 blockId 对应块内的指定占位节点。

```json
{
    "command": "http.otl.exec",
    "param": {
        "subtype": "block.update",
        "params": {
            "operation": "replace_anchor",
            "blockId": "xxx",
            "anchorId": "123",
            "content": {
                "type": "picture",
                "attrs": {}
            }
        }
    }
}
```

| 名称 | 类型 | 必填 | 说明 |
|------|------|------|------|
| blockId | string | 是 | 块 ID，为 `"doc"` 表示替换全文符合要求的占位节点 |
| operation | string | 是 | 固定为 `"replace_anchor"` |
| anchorId | string | 是 | 占位节点 id |
| content | object | 是 | 替换块，type 必须与占位节点的 aimType 一致 |

### 6.10 replace_feature - 替换特性元素

替换 blockId 对应块内的指定特性元素。

```json
{
    "command": "http.otl.exec",
    "param": {
        "subtype": "block.update",
        "params": {
            "operation": "replace_feature",
            "blockId": "doc",
            "source": {
                "type": "WPSUser",
                "attrs": {
                    "userId": "123",
                    "name": "张三"
                }
            },
            "target": {
                "type": "WPSUser",
                "attrs": {
                    "userId": "456",
                    "name": "李四"
                }
            }
        }
    }
}
```

| 名称 | 类型 | 必填 | 说明 |
|------|------|------|------|
| blockId | string | 是 | 块 ID，为 `"doc"` 表示替换全文 |
| operation | string | 是 | 固定为 `"replace_feature"` |
| source | object | 是 | 指定特性元素。支持类型：WPSUser（需指定 userId）、WPSDocument（需指定 wpsDocumentId）、schedule（需指定 scheduleId） |
| target | object | 是 | 替换特性元素，type 需要与 source 一致 |

### 更新操作响应体

```json
{
    "code": 0,
    "msg": "",
    "data": {
        "result": {
            "version": 1,
            "blocks": [
                {
                    "attrs": { "align": 2 },
                    "content": [
                        { "content": "测试数据", "type": "text" }
                    ],
                    "id": "xxx",
                    "type": "title"
                }
            ]
        }
    }
}
```

---

## 7. 批量更新块 (block.update - 数组形式)

批量调用块的更新操作。`params` 为更新操作的数组形式。

### 请求示例

```json
{
    "command": "http.otl.exec",
    "param": {
        "subtype": "block.update",
        "params": [
            {
                "operation": "update_content",
                "blockId": "xxx1",
                "content": [...]
            },
            {
                "operation": "update_attrs",
                "blockId": "xxx2",
                "attrs": {}
            }
        ]
    }
}
```

### 响应体

同更新文档块的响应体。

---

## 8. 删除块内容 (block.delete)

删除指定块的内容。

### 请求示例

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

### 参数说明

| 名称 | 类型 | 必填 | 说明 |
|------|------|------|------|
| blockId | string | 是 | 父块 ID |
| startIndex | integer | 是 | 起始位置（>= 0） |
| endIndex | integer | 是 | 结束位置，需大于 startIndex（>= 1） |

> 注意：删除范围为 `[startIndex, endIndex)`，即左闭右开区间。

### 响应示例

```json
{
    "code": 0,
    "msg": "",
    "data": {
        "result": {
            "blockId": "doc",
            "version": 24
        }
    }
}
```

---

## 9. 批量删除块内容 (block.delete - 数组形式)

批量删除指定块的内容。`params` 为删除操作的数组形式。

### 请求示例

```json
{
    "command": "http.otl.exec",
    "param": {
        "subtype": "block.delete",
        "params": [
            {
                "blockId": "doc",
                "startIndex": 1,
                "endIndex": 2
            }
        ]
    }
}
```

### 响应示例

```json
{
    "code": 0,
    "msg": "",
    "data": {
        "success_list": [
            {
                "blockId": "doc",
                "version": 27
            }
        ],
        "fail_list": []
    }
}
```

---

## 10. 转换文档块 (convert)

将 Markdown 或 HTML 格式的数据转化为智能文档的块数据。

### 请求示例

```json
{
    "command": "http.otl.query",
    "param": {
        "name": "convert",
        "params": {
            "format": "markdown",
            "content": "# 测试数据"
        }
    }
}
```

### 参数说明

| 名称 | 类型 | 必填 | 说明 |
|------|------|------|------|
| format | string | 是 | 格式，可选值：`"markdown"` / `"html"` |
| content | string | 是 | 转换内容 |

### 响应示例

```json
{
    "code": 0,
    "msg": "",
    "data": {
        "result": {
            "blocks": [
                {
                    "id": "xxx",
                    "type": "heading",
                    "content": [
                        { "content": "测试数据", "type": "text" }
                    ],
                    "attrs": { "level": 1 }
                }
            ]
        }
    }
}
```

---

## 11. 文档数据结构参考

### 11.1 节点总览

Airpage 文档由三种节点组成：

1. **块节点 (Block)** - 文档的结构单元（段落、标题、表格等）
2. **内联节点 (Inline)** - 块内的行内元素（文本、@人、公式等）
3. **区间信息 (RangeMark)** - 虚拟节点，表示评论等区间信息

### 11.2 块节点 (Block)

```typescript
interface IBlock {
    id: string;       // 查询可获得，凭此进行块相关操作
    type: string;     // 块节点类型
    attrs: Record<string, any>;  // 块属性
    content?: IBlock[] | IInline[];  // 块内容
}
```

#### 1. 文档标题 (title)

全文档唯一，且必须为 doc 的第一个子块。

| 属性 | 类型 | 可选值 | 默认值 | 说明 |
|------|------|--------|--------|------|
| align | integer | 1, 2, 3 | 1 | 水平对齐：1-左对齐 / 2-居中 / 3-右对齐 |

#### 2. 段落 (paragraph)

分为普通段落、有序列表段落、无序列表段落和任务列表段落。

| 属性 | 类型 | 可选值 | 默认值 | 说明 |
|------|------|--------|--------|------|
| indent | integer | 0, 1 | 0 | 首行缩进 |
| contentIndent | integer | >= 0 | 0 | 内容缩进 |
| align | integer | 1, 2, 3 | 1 | 水平对齐：1-左 / 2-中 / 3-右 |
| listAttrs | object | - | - | 列表属性（见下表） |

**listAttrs 属性：**

| 属性 | 类型 | 说明 |
|------|------|------|
| id | string | 编号树 id |
| type | integer | 列表类型：1-无序列表 / 2-有序列表 / 3-任务列表 |
| styleType | integer | 列表项标记类型（见下方详细说明） |
| level | integer | 列表级别（>= 0） |
| styleFormat | integer | 列表分隔项类型 |

**styleType 详细取值：**

| type 值 | styleType | 说明 |
|---------|-----------|------|
| 1 (无序) | 1 | 实心点 |
| 1 | 2 | 空心点 |
| 1 | 3 | 方块 |
| 2 (有序) | 4 | 阿拉伯数字 |
| 2 | 5 | 字母 |
| 2 | 6 | 罗马数字 |
| 2 | 9 | 大写字母 |
| 2 | 10 | 大写罗马数字 |
| 2 | 11 | 圆圈数字 |
| 2 | 12 | 中文数字 |
| 2 | 13 | 大写中文数字 |
| 3 (任务) | 7 | 未勾选 |
| 3 | 8 | 勾选 |

**styleFormat 取值：**

| 值 | 格式 |
|----|------|
| 1 | `{0}.` |
| 2 | `{0}、` |
| 3 | `{0}]` |
| 4 | `{0}】` |
| 5 | `{0})` |
| 6 | `({0})` |
| 7 | `【{0}】` |
| 8 | `[{0}]` |
| 9 | `{0}` |

#### 3. 标题 (heading)

标题 1-6，不是文档标题（title）。

| 属性 | 类型 | 可选值 | 默认值 | 说明 |
|------|------|--------|--------|------|
| level | integer | 1-6 | 1 | 标题级别 |
| indent | integer | 0, 1 | 0 | 首行缩进 |
| contentIndent | integer | >= 0 | 0 | 内容缩进 |
| align | integer | 1, 2, 3 | 1 | 水平对齐 |
| listAttrs | object | - | - | 列表属性（同段落的 listAttrs） |

#### 4. 引用 (blockQuote)

| 属性 | 类型 | 可选值 | 默认值 | 说明 |
|------|------|--------|--------|------|
| indent | integer | 0, 1 | 0 | 首行缩进 |
| contentIndent | integer | >= 0 | 0 | 内容缩进 |
| align | integer | 1, 2, 3 | 1 | 水平对齐 |

#### 5. 代码块 (codeBlock)

| 属性 | 类型 | 可选值 | 默认值 | 说明 |
|------|------|--------|--------|------|
| lang | integer | 1-43 | 1 | 语言类型 |
| autoWrap | boolean | - | true | 自动换行 |
| theme | integer | 1, 2 | 1 | 1-亮色主题 / 2-暗色主题 |

**lang 语言映射表：**

| 值 | 语言 | 值 | 语言 | 值 | 语言 |
|----|------|----|----|----|----|
| 1 | plaintext | 16 | java | 31 | matlab |
| 2 | css | 17 | json | 32 | rust |
| 3 | go | 18 | php | 33 | nginx |
| 4 | python | 19 | javascript | 34 | dart |
| 5 | shell | 20 | c-like | 35 | erlang |
| 6 | objectivec | 21 | xml | 36 | groovy |
| 7 | markdown | 22 | fortran | 37 | haskell |
| 8 | lua | 23 | r | 38 | kotlin |
| 9 | scss | 24 | cmake | 39 | lisp |
| 10 | less | 25 | bash | 40 | perl |
| 11 | swift | 26 | csharp | 41 | scala |
| 12 | typescript | 27 | dockerfile | 42 | scheme |
| 13 | sql | 28 | julia | 43 | yaml |
| 14 | ruby | 29 | latex | | |
| 15 | http | 30 | makefile | | |

> 仅代码块中的 text 节点可包含换行符 `\n`

#### 6. 高亮块 (highLightBlock)

通常用于美化文档结构或突出重要内容。

| 属性 | 类型 | 必填 | 说明 |
|------|------|------|------|
| emoji | string | 是 | 表情 |
| style | object | 否 | 高亮块样式 |

**style 属性：**

| 属性 | 类型 | 说明 |
|------|------|------|
| fontColor | integer (1-12) | 字体颜色：1-黑色 / 2-灰色 / 3-红色 / 4-粉色 / 5-橙色 / 6-黄色 / 7-绿色1 / 8-绿色2 / 9-绿色3 / 10-蓝色1 / 11-蓝色2 / 12-紫色 |
| backgroundColor | integer (1-6) | 背景颜色：1-灰色 / 2-粉色 / 3-橙色 / 4-绿色 / 5-蓝色 / 6-紫色 |
| borderColor | string | 边框颜色，rgba 十六进制代码，如 `"#112233"` |

#### 7. 内容保护区 (lockBlock)

区域中的内容仅文件创建者可以编辑。无属性。

#### 8. 表格 (table)

| 属性 | 类型 | 可选值 | 说明 |
|------|------|--------|------|
| borderStyle | integer | 1, 2 | 1-无边框 / 2-实线 |

##### 8.1 表格行 (tableRow)

单元格的容器。无属性。

##### 8.1.1 单元格 (tableCell)

| 属性 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| width | number | - | 宽度（同列单元格宽度需一致） |
| height | number | - | 高度（同行单元格高度需一致） |
| colspan | integer | 1 | 合并列数（1 代表不合并） |
| rowspan | integer | 1 | 合并行数（1 代表不合并） |
| verticalAlign | integer | 1 | 垂直对齐：1-顶端 / 2-居中 / 3-底端 |

#### 9. 分栏 (column)

分栏列的容器，支持 1-10 个分栏列。

| 属性 | 类型 | 说明 |
|------|------|------|
| backgroundColor | integer (1-12) | 背景颜色（1-6 为单色，7-12 为多色） |

##### 9.1 分栏列 (columnItem)

| 属性 | 类型 | 说明 |
|------|------|------|
| width | string | 宽度（至多两位小数的百分比字符串） |
| backgroundColor | integer (1-42) | 背景颜色（1-6 单色，7-42 多色，每组 6 个颜色） |

#### 10. 并排图 (pictureColumn)

可将多张图片并排展示，支持 2-5 张图片。

| 属性 | 类型 | 说明 |
|------|------|------|
| width | number | 宽度（百分比，0-100） |
| align | integer | 水平对齐：1-左 / 2-中 / 3-右 |

#### 11. 图片 (picture)

| 属性 | 类型 | 必填 | 说明 |
|------|------|------|------|
| sourceKey | string | 是 | 图片资源 id |
| width | number | 是 | 图片原始宽度 |
| height | number | 是 | 图片原始高度 |
| renderWidth | number | 否 | 图片渲染宽度 |
| caption | string | 否 | 图片描述 |
| rotate | integer | 否 | 旋转角度：0 / -90 / -180 / -270 |
| borderType | integer | 否 | 0-无边框 / 1-灰色1px边框 |
| align | integer | 否 | 水平对齐：1-左 / 2-中 / 3-右 |

#### 12. 占位节点 (blockAnchor)

可作为图片等节点的占位，调用 replace_anchor 替换为占位目标。前端显示为 loading 样式。

| 属性 | 类型 | 必填 | 说明 |
|------|------|------|------|
| id | string | 是 | 占位 id（用于替换的标识） |
| aimType | string | 是 | 占位目标类型：`picture` / `video` / `processon` / `spreadsheet` |
| width | number | 是 | 占位宽度 |
| height | number | 是 | 占位高度 |

> blockAnchor 是否能存在于某个块容器内，取决于它的 aimType。

#### 13. 分隔线 (hr)

无属性。

#### 14. 音视频类

##### 14.1 视频 (video)

| 属性 | 类型 | 必填 | 说明 |
|------|------|------|------|
| sourceId | string | 是 | 视频资源 id |
| sourceKey | string | 是 | 视频封面图 id |
| width | number | 是 | 视频原始宽度 |
| height | number | 是 | 视频原始高度 |
| title | string | 否 | 视频文件名 |
| align | integer | 否 | 水平对齐：1-左 / 2-中 / 3-右 |

##### 14.2 音频 (audio)

| 属性 | 类型 | 必填 | 说明 |
|------|------|------|------|
| sourceId | string | 是 | 音频资源 id |
| title | string | 否 | 音频标题 |

##### 14.3 视频链接 (videoLink)

| 属性 | 类型 | 必填 | 说明 |
|------|------|------|------|
| url | string | 是 | 视频资源链接 |
| platform | integer | 否 | 资源平台：1-bilibili |
| align | integer | 否 | 水平对齐：1-左 / 2-中 / 3-右 |

#### 15. 应用类

##### 15.1 倒计时 (countdown)

| 属性 | 类型 | 必填 | 说明 |
|------|------|------|------|
| type | integer | 是 | 1-日期模式 / 2-时间模式 |
| duration | integer | 否 | 倒计时时长（毫秒，0-86399999000），默认 0 |

##### 15.2 地图 (map)

| 属性 | 类型 | 必填 | 说明 |
|------|------|------|------|
| lng | number | 是 | 经度（-180 ~ 180） |
| lat | number | 是 | 纬度（-90 ~ 90） |
| address | string | 是 | 详细地址描述 |
| addressName | string | 是 | 地点名称 |
| platform | integer | 否 | 地图平台：1-高德地图 |
| mapZoom | integer | 否 | 地图缩放尺度 |
| align | integer | 否 | 水平对齐 |

##### 15.3 第三方资源 (thirdResource)

| 属性 | 类型 | 必填 | 说明 |
|------|------|------|------|
| url | string | 是 | 资源链接 |
| type | integer | 否 | 1-慕客 / 2-墨刀 / 3-masterGo / 4-网易云音乐 / 5-阿里云盘视频 / 6-意向收集 / 7-figma / 8-pixso / 9-小画桌 |
| align | integer | 否 | 水平对齐 |

##### 15.4 多维表 (dbsheet)

| 属性 | 类型 | 必填 | 说明 |
|------|------|------|------|
| sourceId | string | 是 | 多维表 id |
| width | number | 否 | 宽度 |
| height | number | 否 | 高度 |

##### 15.5 电子表格 (spreadsheet)

| 属性 | 类型 | 必填 | 说明 |
|------|------|------|------|
| sourceId | string | 是 | 电子表格 id |
| sheetId | integer | 否 | 电子表格索引 id，默认 0 |

##### 15.6 群名片 (groupCard)

| 属性 | 类型 | 必填 | 说明 |
|------|------|------|------|
| id | string | 是 | 群名片 id |
| name | string | 是 | 群名 |
| masterName | string | 是 | 群主名 |

##### 15.7 appComponent

| 属性 | 类型 | 说明 |
|------|------|------|
| type | integer | 1-投票 / 2-视频号 / 3-关注文档更新 / 4-内部特定插件 / 5-数据联动 / 6-金山待办 / 7-文档数据看板 / 8-画板 |

##### 15.8 流程图/思维导图 (processon)

| 属性 | 类型 | 必填 | 说明 |
|------|------|------|------|
| type | integer | 是 | 1-流程图 / 2-思维导图 |
| sourceId | string | 是 | 元数据 id |
| sourceKey | string | 是 | 预览图 id |
| caption | string | 否 | 描述 |
| rotate | integer | 否 | 旋转角度：0 / -90 / -180 / -270 |
| width | number | 是 | 原始宽度 |
| height | number | 是 | 原始高度 |
| renderWidth | number | 否 | 渲染宽度 |
| borderType | integer | 否 | 0-无边框 / 1-灰色边框 |
| align | integer | 否 | 水平对齐 |

---

### 11.3 内联节点 (Inline)

```typescript
interface IInline {
    type: string;              // 节点类型
    attrs: Record<string, any>; // 节点属性
    content?: string;          // 仅 text 节点有该字段
}
```

#### 1. 文本 (text)

text 节点的内容是一个非空字符串。仅代码块 (codeBlock) 下的 text 可携带换行符 `\n`。

#### 2. 云文档/本地文件 (WPSDocument)

云文档与本地文件共用该节点。

| 属性 | 类型 | 必填 | 说明 |
|------|------|------|------|
| wpsDocumentId | string | 是 | 云文档（本地文件）id |
| wpsDocumentName | string | 是 | 云文档（本地文件）名 |
| wpsDocumentType | string | 是 | 云文档（本地文件）类型 |
| wpsDocumentLink | string | 云文档必填 | 云文档链接（http/https 协议头） |
| viewType | integer | 否 | 视图类型（见下表） |
| size | integer | 本地文件必填 | 本地文件大小（单位 Byte） |
| width | number | 否 | 预览视图窗口宽度（推荐 400-800） |
| height | number | 否 | 预览视图窗口高度（推荐 400-800） |
| align | integer | 否 | 预览视图水平对齐 |

**viewType 取值：**

| 值 | 说明 | 约束 |
|----|------|------|
| 1 | 标题视图 | 默认 |
| 2 | 预览视图 | 父块必须是 paragraph，且不能有兄弟节点 |
| 3 | 卡片视图 | 父块必须是 paragraph，且不能有兄弟节点 |
| 4 | 附件视图 | 本地文件请选择该视图，父块必须是 paragraph，且不能有兄弟节点 |

#### 3. 表情符号 (emoji)

| 属性 | 类型 | 必填 | 说明 |
|------|------|------|------|
| emoji | string | 是 | 单个 emoji 表情（不支持的 emoji 回落为 text 节点） |

#### 4. 引用换行 (br)

引用块中的换行。无属性。

#### 5. 公式 (latex)

| 属性 | 类型 | 必填 | 说明 |
|------|------|------|------|
| width | number | 是 | 宽度 |
| height | number | 是 | 高度 |
| latexStr | string | 是 | LaTeX 公式字符串 |

#### 6. 超链接视图 (linkView)

| 属性 | 类型 | 必填 | 说明 |
|------|------|------|------|
| title | string | 是 | 标题 |
| url | string | 是 | 超链接（http(s):// 开头） |
| viewType | integer | 是 | 1-标题视图 / 2-卡片视图（父块必须是 paragraph 且无兄弟节点） |
| sourceKey | string | 是 | 图标 id |
| description | string | 是 | 超链接描述 |

#### 7. 日程 (schedule)

| 属性 | 类型 | 必填 | 说明 |
|------|------|------|------|
| id | string | 是 | 日程组合 id（taskId + '\|' + sid + '\|' + teamId） |
| name | string | 是 | 日程名字 |
| startTime | number | 是 | 开始时间（unix 毫秒时间戳） |
| endTime | number | 是 | 结束时间（unix 毫秒时间戳） |
| actionType | integer | 否 | 1-非全天 / 2-全天 |

#### 8. 日期 (staticTime)

| 属性 | 类型 | 必填 | 说明 |
|------|------|------|------|
| time | number | 是 | 时间（unix 毫秒时间戳） |
| timeType | integer | 否 | 1-日期 / 2-日期时间 |

#### 9. @人 (WPSUser)

| 属性 | 类型 | 必填 | 说明 |
|------|------|------|------|
| userId | string | 是 | 用户 id |
| name | string | 是 | 用户名 |
| avatar | string | 否 | 用户头像地址 |

---

### 11.4 内联节点通用属性

适用于所有内联节点（文档标题和代码块里的 text 节点除外）。在内联容器上设置通用属性，等价于为容器中每个内联节点设置。

| 属性 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| bold | boolean | false | 加粗 |
| italic | boolean | false | 斜体 |
| underline | boolean | false | 下划线 |
| strike | boolean | false | 删除线 |
| sup | boolean | false | 上标 |
| sub | boolean | false | 下标 |
| fontSize | object | - | 字号配置 |
| color | object | - | 颜色配置 |

**fontSize 属性：**

| 属性 | 类型 | 可选值 | 说明 |
|------|------|--------|------|
| fontSize | number | 9, 11, 13, 15, 16, 19, 22 | 字号（单位 pt），默认 11 |

**color 属性：**

| 属性 | 类型 | 说明 |
|------|------|------|
| fontColor | string | 字体颜色，可选值：`#080F17` / `#C21C13` / `#DB7800` / `#078654` / `#0E52D4` / `#0080A0` / `#757575` / `#DA326B` / `#D1A300` / `#58A401` / `#116AF0` / `#A639D7` |
| backgroundColor | string | 背景颜色，可选值：`#FBF5B3` / `#F8D7B7` / `#F7C7D3` / `#DFF0C4` / `#C6EADD` / `#D9EEFB` / `#D5DCF7` / `#E6D6F0` / `#E6E6E6` |
| fontGradientColor | integer (1-6) | 字体渐变色：1-殷红琥珀 / 2-浅烙翡翠 / 3-海涛魏紫 / 4-金盏糖蓝 / 5-蔚蓝桃红 / 6-梦幻极光 |

> 注意：fontColor、backgroundColor 请勿使用取值范围外的值，否则可能不生效。

---

### 11.5 区间信息 (RangeMark)

用于表示评论等区间信息的虚拟节点。调用 API 若涉及 index，需要忽略虚拟节点。

```typescript
interface IRangeMark {
    type: string;      // rangeMarkBegin / rangeMarkEnd
    id: string;        // 用于配对的 id
    data?: IRangeData[]; // 仅 rangeMarkBegin 携带
}

interface IRangeData {
    type: string;   // 如 'comment'
    ids: string[];  // 对应的评论 id
}
```

**rangeMarkBegin** - 区间标识起点，携带区间数据（如评论）。需和 rangeMarkEnd 配对使用，以 id 作为唯一标识。

**rangeMarkEnd** - 区间标识终点，仅需 id 属性。

---

## 12. 常见问题

### Q1: 查询块后结果里出现的 rangeMarkBegin/rangeMarkEnd 是什么？

是区间信息，用于表示评论的起始结束位置。当调用 update_content 操作时，若希望保留评论，可以将查询得到的 rangeMark 填入 content 中。

**重要**：当调用的操作（如创建文档块、删除文档块等）涉及 index 时，需要忽略 rangeMark，因为 rangeMark 并不是真实存在的节点。

### Q2: appComponent 节点如何保留？

appComponent 的数据来源复杂，目前无法通过创建文档块插入文档。但可以在调用 update_content 操作时，将查询得到的 appComponent 填入 content 中，避免文档已有的 appComponent 丢失。

### Q3: 错误码参考

| 错误码 | 错误信息 | 排查建议 |
|--------|----------|----------|
| -152 | Invalid parameter | 检查传入参数的结构是否正确 |
| 1000 | block not found | 检查 blockId 对应的块是否存在 |
| 1001 | blockId is required | 检查传入参数中是否遗漏 blockId |
| 1002 | invalid operation | 检查操作是否合法（如表格操作时 blockId 对应的块是否为表格） |
| 1003 | invalid appComponent | 检查传入的 appComponent 占位是否符合要求 |
| 1005 | unsupport node type | 检查节点的 type 是否符合要求 |
| 1006 | invalid attrs | 检查节点的 attrs 是否符合要求 |
| 1007 | invalid content | 检查节点的 content 是否符合要求（类型、数量、视图等） |
| 1008 | invalid child count | 检查节点的内容数量是否符合要求 |
| 1009 | invalid table | 检查表格结构是否符合要求 |
| 1010 | insert lock block without permission | 检查是否在非当前用户所有的文档中插入内容保护区 |
| 1011 | invalid RangeMark | 检查 rangeMark 的结构、配对是否符合要求 |
| 1013 | there is no match block anchor | 检查是否未匹配到任何占位节点 |
| 1014 | there is no match feature node | 检查是否未匹配到任何特性节点 |
| 1015 | image column container delete, cannot delete all children | 检查是否将并排图中所有图片删除 |
| 1016 | not support, operating area has merged cells | 检查是否表格操作的区域与合并单元格区域交叉 |
| -1 | -- | 未定义错误，请根据错误信息排查或进行反馈 |

---

## 13. 附录：创建空白文档

新建空白智能文档，获取 file_id 后即可使用块操作 API。

### 请求

```
POST /api/v3/office/new/{type}/file
```

**权限要求：** 登录

### 请求参数

| 名称 | 位置 | 类型 | 必填 | 说明 |
|------|------|------|------|------|
| type | path | string | 是 | 文档类型：`s`(表格), `w`(文字), `p`(演示), `b`(白板), `o`(文档/提纲), `d`(轻维表) |
| from | query | string | 否 | 来源标识，如 `wpsPCWin` |
| disable_roam | query | boolean | 否 | 是否禁止漫游，默认不禁止，要禁止传 `true` |
| gid | query | integer | 否 | group id，大于 0 生效 |
| pid | query | string | 否 | parent id，用户希望存放的目录 ID |

### 请求示例

创建一个智能文档（提纲类型）：

```
POST /api/v3/office/new/o/file?pid=xxx
```

### 响应示例

```json
{
    "fileid": "234543245"
}
```

> 拿到 `fileid` 后，即可作为块操作 API 中的 `{file_id}` 使用。
