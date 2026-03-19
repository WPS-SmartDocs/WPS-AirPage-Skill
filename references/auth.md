# 鉴权参考

优先级：MCP 自动导航登录 > Chrome DevTools MCP（页面已开） > `auth --browser` > 手动录入。

## 凭据文件

```json
// ~/.claude/secrets/wps365.json
{
  "cookie": "wps_sid=...; kso_sid=...; ...",
  "csrf": "abc123def456",
  "updated_at": "2026-03-12T08:00:00.000Z"
}
```

`node scripts/cli.js auth` 会读取这个文件，并在凭据超过 8 小时时提示刷新。

## 关键约束

- `wps_sid` 是 HttpOnly cookie，`document.cookie` 不可靠，也通常拿不到完整值。
- 必须从 `365.kdocs.cn` 的网络请求头读取完整 `cookie`。
- `csrf` 只能从 AirPage 编辑页拿；如果页面不是编辑态，`window.__WPSENV__?.csrf_token` 可能为空。

## 方式零：MCP 全自动登录（凭据缺失/过期时首选）

适用场景：凭据不存在或已过期，Chrome DevTools MCP 可用。**全程自动，用户只需完成账号登录，无需手动告知 Claude 任何状态。**

**完整步骤（Claude 执行）：**

1. 打开登录页
   ```
   mcp__chrome-devtools-mcp__list_pages   # 检查是否已有 kdocs.cn 页面
   ```
   - 若无 kdocs.cn 页面 → `mcp__chrome-devtools-mcp__new_page  url="https://365.kdocs.cn"`
   - 已有页面时直接用，无需新开。

2. 告知用户登录（这是唯一需要用户操作的步骤）
   > "请在浏览器中完成 WPS 账号登录，登录后不需要做任何其他操作，我会自动检测并完成后续步骤。"

3. 轮询等待登录完成（每隔 3 秒调用一次，最多重试 60 次 / 3 分钟）
   ```
   mcp__chrome-devtools-mcp__evaluate_script
     function: "() => !!(window.__userId || window.__WPSENV__?.uid || /(?:^|;\\s*)uid=\\d+/.test(document.cookie))"
   ```
   - 返回 `true` → 登录完成，继续步骤 4。
   - 返回 `false` → 等待 3 秒后重试（不打扰用户）。
   - **注意**：`/latest` 页面登录后 `window.__userId` 可能为 null，但 `document.cookie` 里有 `uid=<数字>`，三路检测任一为真即视为登录。

4. 自动获取文档并导航到编辑页（无需用户操作）

   4a. 从网络请求中提取登录后的部分 cookie
   ```
   mcp__chrome-devtools-mcp__list_network_requests  resourceTypes=["fetch","xhr"]
   mcp__chrome-devtools-mcp__get_network_request  reqid=<任意一条 kdocs.cn 请求的 id>
   ```
   从 Request Headers 取 `cookie` 字段，记为 `<partial_cookie>`。

   4b. 调用文件搜索 API 获取第一个文档 ID（搜索 API 只需 cookie，不需要 CSRF）
   ```
   GET https://365.kdocs.cn/3rd/drive/api/v6/search/files?offset=0&count=5&sort_by=modify_time&order=desc&searchname=
   Headers: Cookie: <partial_cookie>
   ```
   取返回 `files[0].id` 作为 `<file_id>`。

   4c. 导航到编辑页
   ```
   mcp__chrome-devtools-mcp__navigate_page  url="https://365.kdocs.cn/office/o/<file_id>"
   ```

5. 轮询等待 CSRF token 出现（每 2 秒一次，最多 30 次 / 1 分钟）
   ```
   mcp__chrome-devtools-mcp__evaluate_script
     function: "() => (typeof window.__WPSENV__?.csrf_token === 'string' && window.__WPSENV__.csrf_token.length > 10) ? window.__WPSENV__.csrf_token : null"
   ```
   - 返回字符串 → 记录为 `<csrf>`，继续步骤 6。
   - 返回 `null` → 等待 2 秒后重试。

6. 提取完整 Cookie（含 HttpOnly 的 `wps_sid`）
   ```
   mcp__chrome-devtools-mcp__list_network_requests  resourceTypes=["fetch","xhr"]
   mcp__chrome-devtools-mcp__get_network_request  reqid=<编辑页产生的 kdocs.cn 请求 id>
   ```
   从 Request Headers 取完整 `cookie`，记为 `<cookie>`。

7. 保存并验证
   ```bash
   node scripts/cli.js auth --set-cookie "<cookie>" --set-csrf "<csrf>"
   node scripts/cli.js auth
   ```

**常见问题**
- 步骤 3 超时（3 分钟未检测到登录）：提示用户确认是否完成登录，然后重试。
- 步骤 4b 返回空列表（账号下没有文档）：用 `new-doc` 命令新建一个文档后，导航到该文档编辑页，再从步骤 5 继续。
- 步骤 5 超时（CSRF 一直为 null）：可能被导航到分享/预览页，尝试在 URL 末尾加 `?from=edit` 或重新 `navigate_page` 到同一 URL。
- MCP 不可用：降级到方式二 `auth --browser`（同样全自动，无需用户手动导航）。

---

## 方式一：Chrome DevTools MCP（页面已开）

适用场景：用户浏览器已经打开 AirPage 编辑页。

1. 找到目标页面
   - `mcp__chrome-devtools__list_pages`
2. 抓带有 `365.kdocs.cn` 的网络请求
   - `mcp__chrome-devtools__list_network_requests`
   - `mcp__chrome-devtools__get_network_request`
3. 从 Request Headers 里复制完整 `cookie`
4. 读取 CSRF
   - `mcp__chrome-devtools__evaluate_script`
   - 脚本：`() => window.__WPSENV__?.csrf_token`
5. 写入本地缓存

```bash
node scripts/cli.js auth --set-cookie "<完整cookie>" --set-csrf "<csrf>"
```

## 方式二：浏览器脚本

适用场景：没有 MCP，但允许启动浏览器进行自动提取。

```bash
node scripts/cli.js auth --browser
```

流程：

1. 脚本打开浏览器
2. 用户登录 WPS，并进入任意 AirPage 编辑页
3. 脚本自动提取 Cookie 和 CSRF
4. 自动写入 `~/.claude/secrets/wps365.json`

## 方式三：手动兜底

1. 浏览器打开 AirPage 编辑页
2. F12 打开 DevTools
3. 在 Network 中找一个发往 `365.kdocs.cn` 的请求，复制 Request Headers 里的完整 `cookie`
4. 在 Console 中执行：

```js
window.__WPSENV__?.csrf_token
```

5. 手动保存：

```bash
node scripts/cli.js auth --set-cookie "<完整cookie>" --set-csrf "<csrf>"
```

## 什么时候必须刷新

- `node scripts/cli.js auth` 明确提示缺失或过期
- 凭据超过 8 小时
- API 返回 401 / 403 / SessionDeleted / 凭据缺失相关错误
- 用户切换了账号或浏览器会话
