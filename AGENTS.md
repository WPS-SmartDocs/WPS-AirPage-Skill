# WPS AirPage CLI Skill

Use the local CLI (`node scripts/cli.js`) to operate WPS 365 AirPage / 智能文档 / kdocs documents.

**Use this skill when** the user wants to create, read, modify, search, or delete content inside a WPS 365 AirPage document. Triggers on requests mentioning: kdocs, AirPage, 智能文档, 365.kdocs.cn.

**Do NOT use for:** local `.docx`/`.xlsx` files, WPS desktop app, Notion, Google Docs, or generic browser automation.

---

## Task Flow

Execute in strict order. Each step must complete before the next.

**Step 1 — Check credentials**

```bash
node scripts/cli.js auth
```

- Valid → proceed to Step 2.
- Missing / stale (>8h) / API auth error → refresh automatically:
  ```bash
  node scripts/cli.js auth --browser
  # Silent if already logged in; opens browser window if session expired.
  ```
  Do not proceed until `auth` returns valid status.

**Step 2 — Resolve `file_id`**

- User provided numeric ID → use it directly.
- User provided name/keyword → `node scripts/cli.js search <keyword>`
- No target specified → ask: search existing doc or create new one.
- Never use short link IDs as `file_id`.

**Step 3 — Execute operation** (see commands below)

**Step 4 — Verify**

- Content changes: `node scripts/cli.js query <file_id>` to read back modified blocks.
- Comment changes: `node scripts/cli.js comments <file_id>` to verify.
- Do not skip verification. Unverified writes are not complete.
- Note: `outline` has indexing delay on new docs — use `query` to verify, not `outline`.

**Step 5 — Report** file name, `file_id`, what changed, and verification result.

---

## Commands

```bash
node scripts/cli.js                                          # interactive wizard
node scripts/cli.js auth                                     # check credential status
node scripts/cli.js auth --browser                          # refresh (silent or headed)
node scripts/cli.js search <keyword>                         # find doc → numeric file_id
node scripts/cli.js new-doc --name <name>                   # create doc → file_id + doc_url
node scripts/cli.js query <file_id> [block_id]              # query blocks (default: root)
node scripts/cli.js batch-query <file_id> <id1> <id2> ...   # query multiple blocks
node scripts/cli.js insert-markdown <file_id> \
  --content <"text" | @file.md> [--pos begin|end]           # insert Markdown (preferred)
node scripts/cli.js outline <file_id> [--format json]       # document heading outline
node scripts/cli.js update <file_id> --body <json-array>    # update block(s)
node scripts/cli.js insert <file_id> \
  --block-id <id> --index <n> --content <json>              # insert block at position
node scripts/cli.js delete <file_id> --body <json>          # delete block(s)
node scripts/cli.js convert <file_id> \
  --from markdown --content <text>                           # convert Markdown → blocks
node scripts/cli.js upload-image <file_id> <path> \
  [--index <n>] [--width <w>] [--height <h>]               # upload & insert image
node scripts/cli.js comments <file_id>                       # list comments
node scripts/cli.js comment-add <file_id> \
  --sid <selection_id> --text <text> [--reply-id <id>]      # add / reply comment
node scripts/cli.js comment-update <file_id> \
  --id <comment_id> --sid <selection_id> --text <text>      # update comment
```

---

## Common Patterns

### Insert Markdown into existing doc

```bash
node scripts/cli.js auth
node scripts/cli.js search "doc name"          # get file_id
node scripts/cli.js insert-markdown <file_id> --content "# Title\nBody text" --pos end
node scripts/cli.js query <file_id>            # verify
```

### Create new doc and write content

```bash
node scripts/cli.js new-doc --name "My Document"
# returns file_id and doc_url (https://365.kdocs.cn/office/o/{fileid})
node scripts/cli.js insert-markdown <file_id> --content @content.md
node scripts/cli.js query <file_id>
```

### Query and update a block

```bash
node scripts/cli.js query <file_id>                          # find block IDs
node scripts/cli.js update <file_id> --body '[{
  "operation": "update_content",
  "blockId": "<id>",
  "content": [{"type": "text", "content": "new text"}]
}]'
node scripts/cli.js query <file_id> <block_id>               # verify
```

### Add a comment

```bash
node scripts/cli.js comments <file_id>                       # find selection_id
node scripts/cli.js comment-add <file_id> --sid <sid> --text "Comment text"
node scripts/cli.js comments <file_id>                       # verify
```

---

## Critical Gotchas

1. **`update --body` must be a JSON array** — even for one operation. Single object returns error -152.
2. **`outline` has indexing delay on new docs** — verify content with `query`, filter `type === "heading"`.
3. **Inline text field is `content`, not `text`** — `{"content": [...]}`, not `{"text": "..."}`.
4. **`rangeMarkBegin`/`rangeMarkEnd` are not real blocks** — skip them when calculating `--index`; preserve them in `update_content` to keep comment anchors.
5. **`file_id` must be numeric** — do not use short link IDs like `cqLJVsi247LF`.
6. **`insert --index` must be ≥ 1** — the title block is always at index 0.
7. **Document URL format**: `https://365.kdocs.cn/office/o/{fileid}` (no groupid needed).

---

## Authentication Details

Credentials stored at `~/.claude/secrets/wps365.json` (mode `0600`).

`auth --browser` flow:
1. Tries headless Playwright with saved profile (`~/.claude/secrets/wps-airpage-profile/`)
2. If session is active → silently extracts cookie + CSRF, no UI shown
3. If session expired → opens headed browser window, user logs in once, profile saved for next time

Manual fallback:
```bash
node scripts/cli.js auth --set-cookie "<cookie>" --set-csrf "<token>"
```

---

## Key Constraints

- `file_id`: numeric only
- `update --body`: JSON array always
- `insert --index`: ≥ 1
- `insert-markdown --pos`: `begin` or `end` only
- `comment-update`: requires both `--id` (comment_id) and `--sid` (selection_id)
- Image upload `--index 0`: uploads only, does not insert block
