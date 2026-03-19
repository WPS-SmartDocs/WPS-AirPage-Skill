# WPS AirPage CLI Skill

> Automate WPS 365 / AirPage / 智能文档 (kdocs) documents from any AI coding agent.

Operate [WPS 365 AirPage](https://365.kdocs.cn) smart documents via a local CLI — create docs, insert Markdown, edit blocks, manage tables, upload images, and handle comments. Works with Claude Code, Cursor, Codex, Gemini CLI, and any agent that can run Node.js.

---

## Capabilities

| Feature | Command |
|---------|---------|
| Search documents | `node scripts/cli.js search <keyword>` |
| Create new document | `node scripts/cli.js new-doc --name <name>` |
| Query block structure | `node scripts/cli.js query <file_id> [block_id]` |
| Insert Markdown content | `node scripts/cli.js insert-markdown <file_id> --content <text\|@file>` |
| Get document outline | `node scripts/cli.js outline <file_id>` |
| Update a block | `node scripts/cli.js update <file_id> --body <json>` |
| Insert a block | `node scripts/cli.js insert <file_id> --block-id <id> --index <n> --content <json>` |
| Delete a block | `node scripts/cli.js delete <file_id> --body <json>` |
| Upload image | `node scripts/cli.js upload-image <file_id> <path>` |
| List comments | `node scripts/cli.js comments <file_id>` |
| Add / reply comment | `node scripts/cli.js comment-add <file_id> --sid <id> --text <text>` |
| Update comment | `node scripts/cli.js comment-update <file_id> --id <cid> --sid <sid> --text <text>` |
| Interactive wizard | `node scripts/cli.js` _(no args)_ |

---

## Prerequisites

- **Node.js 18+**
- **WPS 365 account** at [365.kdocs.cn](https://365.kdocs.cn)
- _(Optional)_ **Chrome DevTools MCP** — enables fully automated one-click credential extraction (Claude Code only)

---

## Installation

### Claude Code

```bash
npx skills add ioopsd/wps-airpage
```

Or clone and install locally:

```bash
git clone https://github.com/ioopsd/wps-airpage ~/.claude/skills/wps-airpage
```

The skill auto-activates when you mention `kdocs`, `AirPage`, `智能文档`, or `365.kdocs.cn`.

### Cursor / Windsurf

Add to `.cursor/rules/wps-airpage.mdc`:

```
---
description: Use for WPS AirPage / 智能文档 document operations
globs:
alwaysApply: false
---
```

Then paste the contents of `SKILL.md` below the frontmatter.

Or reference `AGENTS.md` in your Cursor system prompt:

```
See AGENTS.md in this repo for WPS AirPage automation instructions.
```

### OpenAI Codex / Codex CLI

`AGENTS.md` in this repo is automatically loaded by Codex. Clone the repo or copy `AGENTS.md` to your project root:

```bash
curl -o AGENTS.md https://raw.githubusercontent.com/ioopsd/wps-airpage/main/AGENTS.md
```

### Gemini CLI

Copy `AGENTS.md` to `GEMINI.md` in your project:

```bash
curl -o GEMINI.md https://raw.githubusercontent.com/ioopsd/wps-airpage/main/AGENTS.md
```

### Any other agent

Point your agent at `SKILL.md` (Claude Code format) or `AGENTS.md` (plain Markdown, no frontmatter triggers).

---

## Quick Start

```bash
# 1. Install dependencies
cd ~/.claude/skills/wps-airpage
npm install

# 2. Authenticate (silent if already logged in, shows browser otherwise)
node scripts/cli.js auth --browser

# 3. Search and operate
node scripts/cli.js search "my doc"
node scripts/cli.js insert-markdown 502816392406 --content "# Hello\nWorld" --pos end

# 4. Or use the interactive wizard
node scripts/cli.js
```

---

## Authentication

Credentials are stored locally at `~/.claude/secrets/wps365.json` (mode `0600`).

| Method | When |
|--------|------|
| Silent headless | Session active in Playwright profile — no UI shown |
| Headed browser | First run or session expired — browser window opens for login |
| Chrome DevTools MCP | Claude Code only — fully automated, extracts from open browser tab |
| Manual | `auth --set-cookie "..." --set-csrf "..."` |

```bash
node scripts/cli.js auth            # check status
node scripts/cli.js auth --browser  # silent if logged in, headed if not
```

Credentials auto-expire after 8 hours and prompt for refresh.

---

## Platform Compatibility

| Platform | CLI | Auto-auth | MCP auth |
|----------|-----|-----------|---------|
| Claude Code | ✅ | ✅ `--browser` | ✅ Chrome DevTools MCP |
| Cursor | ✅ | ✅ `--browser` | ❌ |
| Codex CLI | ✅ | ✅ `--browser` | ❌ |
| Gemini CLI | ✅ | ✅ `--browser` | ❌ |
| Any Node.js env | ✅ | ✅ `--browser` | ❌ |

MCP-based auto-auth (zero-click credential extraction) requires Claude Code with Chrome DevTools MCP installed.

---

## Project Structure

```
wps-airpage/
├── SKILL.md                    # Claude Code skill definition
├── AGENTS.md                   # Codex / plain-Markdown agents
├── README.md                   # This file
├── scripts/
│   ├── cli.js                  # Main CLI entry point
│   ├── client.js               # API client
│   ├── auth-browser.js         # Silent/headed auth (Playwright)
│   ├── credentials.js          # Credential storage
│   ├── interactive.js          # Inquirer wizard
│   └── ...
└── references/
    ├── auth.md                 # Auth flow details
    ├── block-ops.md            # Block operation payloads
    ├── data-structure.md       # Block type reference
    ├── verified-behavior.md    # Tested gotchas & edge cases
    └── ...
```

---

## Security

- Credentials stored at `~/.claude/secrets/wps365.json` (mode `0600`)
- `wps_sid` is an HttpOnly cookie — extracted from network request headers, never from `document.cookie`
- CSRF token only available on AirPage editing pages (`window.__WPSENV__.csrf_token`)
- Playwright profile stored at `~/.claude/secrets/wps-airpage-profile/`
- All credentials remain local — nothing is sent to third parties

---

## Key Constraints

- `file_id` must be a numeric ID, not a short link
- `update --body` must be a JSON array, even for a single operation
- `insert --index` must be `>= 1` (title block is always at index 0)
- `outline` has indexing delay on new docs — use `query` to verify writes
- Document URL format: `https://365.kdocs.cn/office/o/{fileid}`

---

## License

MIT
