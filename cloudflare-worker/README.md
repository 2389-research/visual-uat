# Visual UAT Reports - Cloudflare Worker

This Worker provides secure, token-based hosting for visual-uat test reports.

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Create KV namespaces

```bash
wrangler kv:namespace create REPORTS
wrangler kv:namespace create TOKENS
```

Copy the IDs into `wrangler.toml`.

### 3. Deploy

```bash
npm run deploy
```

## API

### Upload Report

**Endpoint:** `POST /upload`

**Form Data:**
- `org` (string) - GitHub organization
- `repo` (string) - Repository name
- `pr` (number) - Pull request number
- `github_token` (string) - GitHub token for verification
- `files` (files) - Report files to upload

**Response:**
```json
{
  "success": true,
  "url": "https://visual-uat-reports.pages.dev/{org}/{repo}/pr-{pr}/{token}/latest.html",
  "token": "abc123...",
  "expiresAt": "2024-12-12T..."
}
```

### View Report

**Endpoint:** `GET /{org}/{repo}/pr-{pr}/{token}/{file}`

Returns the requested file if token is valid and not expired.

## Security

- Tokens are 32-character random hex strings
- Tokens expire after 7 days
- Rate limit: 10 uploads per hour per repo
- Max report size: 50MB
- GitHub token verification ensures uploads are from real PRs
