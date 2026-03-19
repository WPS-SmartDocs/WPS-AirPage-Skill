# WPS AirPage CLI Skill

[English](./README.md) | **中文**

> 让任意 AI 编程助手直接操作 WPS 365 / AirPage / 智能文档 (kdocs) 文档。

通过本地 CLI 操作 [WPS 365 AirPage](https://365.kdocs.cn) 智能文档 — 新建文档、插入 Markdown、编辑块、管理表格、上传图片、处理评论。支持 Claude Code、Cursor、Codex、Gemini CLI 以及所有能运行 Node.js 的 AI Agent。

---

## 能力

- 按关键词搜索文档
- 新建文档
- 查询并导航块结构
- 插入 Markdown 或 HTML 内容
- 更新、插入、删除块
- 管理表格（合并单元格、插入行列）
- 上传并嵌入图片
- 列出、添加、回复、更新评论
- 查看文档标题大纲
- 交互式向导（适合手动使用）

---

## 使用场景

安装后，直接用自然语言告诉 AI 你想做什么，无需记忆命令。

**新建文档并写入内容**
> "帮我新建一个 AirPage 文档，标题叫「Q2 复盘」，写入以下 Markdown 内容：……"

**搜索并编辑现有文档**
> "找到「项目周报」这个文档，在末尾加一段：本周完成了用户认证模块开发。"

**查看文档结构**
> "查一下那个 kdocs 文档的块结构" / "给我看看文档的大纲"

**修改特定内容**
> "把文档里第二个标题改成「实施方案」"

**表格操作**
> "在表格第二行后面插入一行，内容是：张三、产品、2026-03"

### 触发关键词（Claude Code 自动激活）

在对话中提到以下任意词汇，Skill 会自动启用：

`kdocs` · `AirPage` · `智能文档` · `365.kdocs.cn`

---

## 前提条件

- **Node.js 18+**
- **WPS 365 账号**（[365.kdocs.cn](https://365.kdocs.cn)）
- _(可选)_ **Chrome DevTools MCP** — 在任意支持 MCP 的平台上实现零点击全自动凭据提取

---

## 安装

### Claude Code

```bash
npx skills add ioopsd/wps-airpage
```

当你在对话中提到 `kdocs`、`AirPage`、`智能文档` 或 `365.kdocs.cn` 时，Skill 会自动激活。

### Cursor / Windsurf

在 Cursor Rules 或系统提示词中引用 `AGENTS.md`：

```
See AGENTS.md in this repo for WPS AirPage automation instructions.
```

或新建 `.cursor/rules/wps-airpage.mdc`，将 `SKILL.md` 的内容粘贴到 frontmatter 下方。

### OpenAI Codex / Codex CLI

Codex 会自动加载项目根目录的 `AGENTS.md`。克隆仓库或将文件复制到项目根目录：

```bash
curl -o AGENTS.md https://raw.githubusercontent.com/ioopsd/wps-airpage/main/AGENTS.md
```

### Gemini CLI

将 `AGENTS.md` 复制为项目中的 `GEMINI.md`：

```bash
curl -o GEMINI.md https://raw.githubusercontent.com/ioopsd/wps-airpage/main/AGENTS.md
```

### 其他 Agent

将 `SKILL.md`（Claude Code 格式）或 `AGENTS.md`（纯 Markdown）指向你的 Agent 即可。

---

## 鉴权

凭据存储于本地 `~/.claude/secrets/wps365.json`（权限 0600）。首次运行无需手动配置，Skill 会自动处理。

| 方式 | 适用场景 |
|------|----------|
| 静默无头浏览器 | Profile 中 session 有效，完全无感知 |
| 有头浏览器 | 首次运行或 session 过期，弹窗登录一次后保存 |
| Chrome DevTools MCP | 任意支持 MCP 的平台，零点击全自动提取 |
| 手动录入 | `auth --set-cookie "..." --set-csrf "..."` |

启用 MCP 零点击鉴权，安装一次 `chrome-devtools-mcp`：

```bash
node scripts/cli.js auth --install-mcp           # 所有平台
node scripts/cli.js auth --install-mcp cursor    # 仅 Cursor
node scripts/cli.js auth --install-mcp codex     # 仅 Codex CLI
node scripts/cli.js auth --install-mcp gemini    # 仅 Gemini CLI
```

---

## 平台兼容性

| 平台 | CLI | 自动鉴权 | MCP 鉴权 |
|------|-----|----------|----------|
| Claude Code | ✅ | ✅ | ✅ `--install-mcp claude-code` |
| Cursor | ✅ | ✅ | ✅ `--install-mcp cursor` |
| Codex CLI | ✅ | ✅ | ✅ `--install-mcp codex` |
| Gemini CLI | ✅ | ✅ | ✅ `--install-mcp gemini` |
| 任意 Node.js 环境 | ✅ | ✅ | ➕ 平台支持 MCP 时可用 |

---

## 安全

- 凭据存储于 `~/.claude/secrets/wps365.json`（权限 0600）
- Playwright profile 存储于 `~/.claude/secrets/wps-airpage-profile/`
- 所有凭据均保留在本地，不会发送给任何第三方

---

## License

MIT
