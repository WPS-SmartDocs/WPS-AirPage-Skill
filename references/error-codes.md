# 常见问题与错误码

## 常见问题

### Q: 查询结果中的 rangeMarkBegin / rangeMarkEnd 是什么？

这是[区间信息](data-structure.md#区间信息)标记，表示评论的起止位置。调用 `update_content` 时可以在内容中包含查询到的 rangeMarks 以保留评论。当操作涉及 `index`（创建/删除块）时，必须忽略 rangeMarks，因为它们不是真实节点。

### Q: 如何保留 appComponent 节点？

appComponent 数据源复杂，无法通过创建块 API 插入。但调用 `update_content` 时，可以在内容中包含查询到的 appComponent 数据，避免丢失已有的 appComponent。

## AirPage 错误码

| 错误码 | 说明 | 排查建议 |
|--------|------|----------|
| -152 | 参数无效 | 检查输入参数结构是否正确 |
| 1000 | block not found | 检查 blockId 对应的块是否存在 |
| 1001 | blockId is required | 检查输入参数是否缺少 blockId |
| 1002 | invalid operation | 检查操作是否有效（如表格操作时，目标块是否为表格） |
| 1003 | invalid appComponent | 检查 appComponent 占位是否符合要求 |
| 1005 | unsupport node type | 检查节点类型是否有效 |
| 1006 | invalid attrs | 检查节点属性是否符合要求 |
| 1007 | invalid content | 检查节点内容是否符合要求（类型、数量、视图等） |
| 1008 | invalid child count | 检查子节点数量是否符合要求 |
| 1009 | invalid table | 检查表格结构是否符合要求 |
| 1010 | insert lock block without permission | 非文件创建者不能插入内容保护区 |
| 1011 | invalid RangeMark | 检查 rangeMark 结构/配对是否符合要求 |
| 1013 | no match block anchor | 未找到匹配的占位节点 |
| 1014 | no match feature node | 未找到匹配的特征节点 |
| 1015 | cannot delete all children | 不能删除并排图片容器中的所有图片 |
| 1016 | merged cells conflict | 表格操作区域与合并单元格区域交叉 |

## 通用 API 错误码

| code | 说明 |
|------|------|
| 0 | 成功 |
| 100400 | 参数错误 |
| 100401 | 认证失败 |
| 100403 | 权限不足 |
| 100404 | 资源不存在 |
| 100429 | 频率限制（CLI 自动重试） |
