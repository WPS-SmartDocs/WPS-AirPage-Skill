# 鉴权详细流程

## 凭据文件结构

```json
// ~/.claude/secrets/wps365.json
{
  "cookie": "wps_sid=V02S4...AQAA; _WpsOauthToken=...",
  "csrf": "abc123def456",
  "updated_at": "2026-03-11T10:00:00Z"
}
```

## 提取步骤（Chrome DevTools MCP）

### 前置条件
用户需在浏览器中：
1. 打开 `https://365.kdocs.cn` 并已登录
2. 打开任意 AirPage 文档（以确保 `window.__WPSENV__` 已注入 CSRF）

### Step 1: 获取当前页面列表
```
mcp__chrome-devtools__list_pages
```
选择包含 `365.kdocs.cn` 的标签页，记录其 pageId。

### Step 2: 提取 Cookie
```
mcp__chrome-devtools__evaluate_script
  pageId: <pageId>
  script: "document.cookie"
```
结果为完整 cookie 字符串。

### Step 3: 提取 CSRF Token
```
mcp__chrome-devtools__evaluate_script
  pageId: <pageId>
  script: "window.__WPSENV__ && window.__WPSENV__.csrf_token"
```
结果为 csrf token 字符串。

### Step 4: 写入缓存
```bash
mkdir -p ~/.claude/secrets
cat > ~/.claude/secrets/wps365.json << EOF
{
  "cookie": "<提取的cookie>",
  "csrf": "<提取的csrf>",
  "updated_at": "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
}
EOF
```

## 凭据有效性判断

- 文件不存在 → 触发获取流程
- 文件存在但 `updated_at` 超过 8 小时 → 提示用户是否刷新
- API 返回 401/403 → 自动触发重新获取

## 两种 Header 组合

**搜索文件**（仅 cookie）:
```bash
curl -H "Cookie: $COOKIE" \
  "https://365.kdocs.cn/3rd/drive/api/v6/search/files?..."
```

**块操作**（cookie + csrf）:
```bash
curl -X POST \
  -H "Cookie: $COOKIE" \
  -H "x-csrf-rand: $CSRF" \
  -H "Content-Type: application/json" \
  -d '{...}' \
  "https://365.kdocs.cn/api/v3/office/file/{file_id}/core/execute"
```
