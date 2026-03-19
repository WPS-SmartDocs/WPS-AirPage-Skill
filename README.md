# WPS AirPage CLI Skill

**English** | [中文](./README.zh.md)

> Automate WPS 365 / AirPage / 智能文档 (kdocs) documents from any AI coding agent.

Operate [WPS 365 AirPage](https://365.kdocs.cn) smart documents via a local CLI — create docs, insert Markdown, edit blocks, manage tables, upload images, and handle comments. Works with Claude Code, Cursor, Codex, Gemini CLI, and any agent that can run Node.js.

---

## Capabilities

- Search documents by keyword
- Create new documents
- Query and navigate block structure
- Insert Markdown or HTML content
- Update, insert, and delete blocks
- Manage tables (merge cells, add rows/columns)
- Upload and embed images
- List, add, reply to, and update comments
- View document heading outline
- Interactive wizard for manual use

---

## Usage Examples

Once installed, just describe what you want in natural language — no commands to memorize.

**Create a document and write content**
> "Create a new AirPage document titled 'Q2 Review' and insert this Markdown: ..."

**Find and edit an existing document**
> "Find the 'Weekly Report' document and append a paragraph: Completed user auth module this week."

**Inspect document structure**
> "Show me the block structure of that kdocs document" / "Give me the outline of the document"

**Update specific content**
> "Change the second heading in the document to 'Implementation Plan'"

**Table operations**
> "Insert a row after the second row with: Alice, Product, 2026-03"

**Upload an image**
> "Upload this screenshot to the end of the document"

**Manage comments**
> "List all comments in the document" / "Add a comment on the first paragraph: needs a data source"

### Trigger Keywords (Claude Code auto-activates on)

Mention any of these in conversation and the skill activates automatically:

`kdocs` · `AirPage` · `智能文档` · `365.kdocs.cn`

---

## Prerequisites

- **Node.js 18+**
- **WPS 365 account** at [365.kdocs.cn](https://365.kdocs.cn)
- _(Optional)_ **Chrome DevTools MCP** — enables fully automated zero-click credential extraction on any MCP-enabled platform

---

## Installation

### Claude Code

```bash
npx skills add ioopsd/wps-airpage
```

The skill auto-activates when you mention `kdocs`, `AirPage`, `智能文档`, or `365.kdocs.cn`.

### Cursor / Windsurf

Reference `AGENTS.md` in your Cursor rules or system prompt:

```
See AGENTS.md in this repo for WPS AirPage automation instructions.
```

Or add to `.cursor/rules/wps-airpage.mdc` and paste the contents of `SKILL.md`.

### OpenAI Codex / Codex CLI

`AGENTS.md` is automatically loaded by Codex. Clone the repo or copy it to your project root:

```bash
curl -o AGENTS.md https://raw.githubusercontent.com/ioopsd/wps-airpage/main/AGENTS.md
```

### Gemini CLI

Copy `AGENTS.md` as `GEMINI.md` in your project:

```bash
curl -o GEMINI.md https://raw.githubusercontent.com/ioopsd/wps-airpage/main/AGENTS.md
```

### Any other agent

Point your agent at `SKILL.md` (Claude Code format) or `AGENTS.md` (plain Markdown).

---

## Authentication

Credentials are stored locally at `~/.claude/secrets/wps365.json` (mode `0600`). The skill handles auth automatically — no manual setup needed on first run.

| Method | When |
|--------|------|
| Silent headless | Session active in saved profile — no UI shown |
| Headed browser | First run or session expired — browser window opens once |
| Chrome DevTools MCP | Any MCP-enabled platform — fully automated zero-click extraction |
| Manual | `auth --set-cookie "..." --set-csrf "..."` |

To enable MCP-based zero-click auth, install `chrome-devtools-mcp` once:

```bash
node scripts/cli.js auth --install-mcp           # all platforms
node scripts/cli.js auth --install-mcp cursor    # Cursor only
node scripts/cli.js auth --install-mcp codex     # Codex CLI only
node scripts/cli.js auth --install-mcp gemini    # Gemini CLI only
```

---

## Platform Compatibility

| Platform | CLI | Auto-auth | MCP auth |
|----------|-----|-----------|---------|
| Claude Code | ✅ | ✅ | ✅ `--install-mcp claude-code` |
| Cursor | ✅ | ✅ | ✅ `--install-mcp cursor` |
| Codex CLI | ✅ | ✅ | ✅ `--install-mcp codex` |
| Gemini CLI | ✅ | ✅ | ✅ `--install-mcp gemini` |
| Any Node.js env | ✅ | ✅ | ➕ if platform supports MCP |

---

## Security

- Credentials stored at `~/.claude/secrets/wps365.json` (mode `0600`)
- Playwright profile stored at `~/.claude/secrets/wps-airpage-profile/`
- All credentials remain local — nothing is sent to third parties

---

## License

MIT
