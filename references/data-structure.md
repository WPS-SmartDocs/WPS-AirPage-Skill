# 数据结构

AirPage 文档由块节点（Block）树形结构组成。每个块包含行内节点（Inline）作为文本内容。

## 块节点 (IBlock)

```typescript
interface IBlock {
  id: string;              // 块 ID（查询获得，用于块操作）
  type: string;            // 块类型
  attrs: Record<string, any>;  // 块属性
  content?: IBlock[] | IInline[];  // 子块或行内内容
}
```

### 块类型一览

| 类型 | 说明 | 关键属性 |
|------|------|----------|
| `title` | 文档标题（唯一，必须是 doc 的第一个子块） | `align`（1=左对齐, 2=居中, 3=右对齐） |
| `paragraph` | 段落（普通/有序列表/无序列表/任务列表） | `align`, `indent`, `contentIndent`, `listAttrs` |
| `heading` | 标题 H1-H6 | `level`(1-6), `align`, `indent`, `listAttrs` |
| `blockQuote` | 引用块（content 直接包含 IInline，不是子块） | `align`, `indent`, `contentIndent` |
| `codeBlock` | 代码块 | `lang`(1-43), `autoWrap`, `theme`(1=浅色, 2=深色) |
| `highLightBlock` | 高亮块 | `emoji`（创建时 `style` 属性不受支持） |
| `lockBlock` | 内容保护区（仅文件创建者可编辑） | 无属性 |
| `table` | 表格 | `borderStyle`(1=无边框, 2=实线) |
| `tableRow` | 表格行 | 无属性 |
| `tableCell` | 表格单元格 | `width`, `height`, `colspan`, `rowspan`, `verticalAlign`(1=上, 2=中, 3=下) |
| `column` | 分栏布局（1-10 栏） | `backgroundColor` |
| `columnItem` | 分栏子项 | `width`（百分比字符串）, `backgroundColor` |
| `pictureColumn` | 并排图片（2-5 张） | 创建时不支持 `width`/`align` 属性，只需 content 包含 picture 子块 |
| `picture` | 图片 | `sourceKey`\*, `width`\*, `height`\*, `renderWidth`, `caption`, `rotate`, `align` |
| `blockAnchor` | 占位节点 | `id`\*, `aimType`(picture/video/processon/spreadsheet), `width`, `height` |
| `hr` | 水平线 | 无属性 |
| `video` | 视频 | `sourceId`, `sourceKey`, `width`, `height`, `title`, `align` |
| `audio` | 音频 | `sourceId`, `title` |
| `videoLink` | 视频链接 | `url`, `platform`(1=bilibili), `align` |
| `countdown` | 倒计时 | `type`(1=日期, 2=时间), `duration`(毫秒) |
| `map` | 地图 | `lng`, `lat`, `address`, `addressName`, `mapZoom`, `align` |
| `thirdResource` | 第三方资源 | `url`, `type`(1-9), `align` |
| `dbsheet` | 多维表格 | `sourceId`, `width`, `height` |
| `spreadsheet` | 电子表格 | `sourceId`, `sheetId` |
| `groupCard` | 群卡片 | `id`, `name`, `masterName` |
| `appComponent` | 应用组件 | `type`(1=投票, 2=视频号, 3=关注更新, 4=内部插件, 5=数据联动, 6=金山待办, 7=文档数据看板, 8=画布) |
| `processon` | 流程图/脑图 | `type`(1=流程图, 2=脑图), `sourceId`, `sourceKey`, `width`, `height` |

### listAttrs（段落/标题的列表属性）

> **重要：** 创建列表项时，段落的 `attrs` 必须同时包含 `contentIndent` 和完整的 `listAttrs`（含 `styleType`），否则 API 会返回 `invalid attrs` 错误。

| 属性 | 说明 |
|------|------|
| `type` | 1=无序列表, 2=有序列表, 3=任务列表 |
| `styleType` | 列表样式（**创建时必填**）：无序 level0=1, level1=2, level2=3; 有序 level0=4, level1=5, level2=6; 任务未选中=7, 已选中=8 |
| `level` | 缩进层级（从 0 开始） |
| `styleFormat` | 有序列表格式 |

段落 `attrs` 中还需设置 `contentIndent`（值 = level + 1）。示例：
```json
{ "type": "paragraph", "attrs": { "contentIndent": 1, "listAttrs": { "type": 1, "styleType": 1, "level": 0 } }, "content": [...] }
```

### codeBlock 语言编号

| 编号 | 语言 | 编号 | 语言 | 编号 | 语言 |
|------|------|------|------|------|------|
| 1 | plaintext | 16 | sql | 31 | dart |
| 2 | css | 17 | swift | 32 | matlab |
| 3 | go | 18 | objectivec | 33 | groovy |
| 4 | html | 19 | rust | 34 | abap |
| 5 | javascript | 20 | scala | 35 | julia |
| 6 | json | 21 | shell | 36 | scheme |
| 7 | python | 22 | lua | 37 | markdown |
| 8 | ruby | 23 | vb | 38 | mermaid |
| 9 | markdown | 24 | erlang | 39 | nginx |
| 10 | xml | 25 | delphi | 40 | lisp |
| 11 | java | 26 | clojure | 41 | toml |
| 12 | cpp | 27 | haskell | 42 | docker |
| 13 | csharp | 28 | elixir | 43 | diff |
| 14 | php | 29 | r | | |
| 15 | typescript | 30 | kotlin | | |

---

## 行内节点 (IInline)

```typescript
interface IInline {
  type: string;
  attrs: Record<string, any>;
  content?: string;  // 仅 text 节点有此字段
}
```

### 行内类型一览

| 类型 | 说明 | 关键属性 |
|------|------|----------|
| `text` | 文本（content 为非空字符串；仅 codeBlock 中的文本可包含 `\n`） | 公共行内属性 |
| `WPSDocument` | 云文档/本地文件 | `wpsDocumentId`, `wpsDocumentName`, `viewType`(1=标题, 2=预览, 3=卡片, 4=附件) |
| `emoji` | 表情符号 | `emoji`（单个 emoji 字符串） |
| `br` | 换行（仅用于 blockQuote 内） | 无属性 |
| `latex` | 公式 | `width`, `height`, `latexStr` |
| `linkView` | 超链接视图 | `title`, `url`, `viewType`(1=标题, 2=卡片), `sourceKey`, `description` |
| `schedule` | 日程 | `id`(taskId\|sid\|teamId), `name`, `startTime`, `endTime`, `actionType`(1=非全天, 2=全天) |
| `staticTime` | 日期 | `time`(unix 毫秒时间戳), `timeType`(1=日期, 2=日期时间) |
| `WPSUser` | @提及用户 | `userId`, `name`, `avatar` |

### 公共行内属性

适用于所有行内节点（title 和 codeBlock 中的文本除外）：

| 属性 | 类型 | 说明 |
|------|------|------|
| `bold` | boolean | 加粗 |
| `italic` | boolean | 斜体 |
| `underline` | boolean | 下划线 |
| `strike` | boolean | 删除线 |
| `sup` | boolean | 上标 |
| `sub` | boolean | 下标 |
| `fontSize` | object | 字号 (`fontSize`: 9/11/13/15/16/19/22 pt) |
| `color` | object | 颜色 (`fontColor`, `backgroundColor`, `fontGradientColor`) |

---

## 区间信息 (IRangeMark)

不是真实节点，用于标记区间范围（如评论）。

```typescript
interface IRangeMark {
  type: string;       // "rangeMarkBegin" 或 "rangeMarkEnd"
  id: string;         // 配对 ID
  data?: IRangeData[];  // 仅在 rangeMarkBegin 上
}

interface IRangeData {
  type: string;   // 如 "comment"
  ids: string[];  // 评论 ID 列表
}
```

> **重要：** 调用 `update_content` 时包含 rangeMarks 可保留评论。操作涉及 index（创建/删除块）时必须忽略 rangeMarks。
