# Target Runner Examples

The WebRunner plugin supports any web server. It spawns your command, waits for the server to respond, and manages its lifecycle.

## Environment Variables

The runner passes these environment variables to your command:
- `PORT` - Auto-allocated port number
- `BASE_URL` - Full URL (e.g., http://localhost:3000)
- `BRANCH` - Git branch being tested

## Examples by Language/Framework

### Node.js

**Express/Koa/Fastify (npm):**
```javascript
targetRunner: {
  startCommand: 'npm start'
}
```

**Custom port handling:**
```javascript
targetRunner: {
  startCommand: 'node server.js',
  baseUrl: 'http://localhost'
}
```

### Static Content

**npx serve:**
```javascript
targetRunner: {
  startCommand: 'npx serve -l $PORT ./public'
}
```

**Python http.server:**
```javascript
targetRunner: {
  startCommand: 'cd ./public && python -m http.server $PORT'
}
```

**Go's built-in server:**
```javascript
targetRunner: {
  startCommand: 'go run cmd/static-server/main.go -port=$PORT'
}
```

### Go

**Standard http package:**
```javascript
targetRunner: {
  startCommand: 'go run main.go'
}
```

**Gin framework:**
```javascript
targetRunner: {
  startCommand: 'GIN_MODE=release go run main.go'
}
```

### Python

**Flask:**
```javascript
targetRunner: {
  startCommand: 'flask run --port $PORT'
}
```

**Django:**
```javascript
targetRunner: {
  startCommand: 'python manage.py runserver $PORT'
}
```

**FastAPI:**
```javascript
targetRunner: {
  startCommand: 'uvicorn main:app --port $PORT'
}
```

### Ruby

**Rails:**
```javascript
targetRunner: {
  startCommand: 'rails server -p $PORT'
}
```

**Sinatra:**
```javascript
targetRunner: {
  startCommand: 'ruby app.rb -p $PORT'
}
```

### Elixir

**Phoenix:**
```javascript
targetRunner: {
  startCommand: 'mix phx.server',
  baseUrl: 'http://localhost:4000'
}
```

### Rust

**Actix-web:**
```javascript
targetRunner: {
  startCommand: 'cargo run --release'
}
```

## Testing HTML Reports (Self-Testing)

To test visual-uat's own HTML reports:

```javascript
// visual-uat.config.js
module.exports = {
  plugins: {
    targetRunner: '@visual-uat/web-runner',
    // ...
  },
  targetRunner: {
    startCommand: 'npx serve -l $PORT tests/fixtures'
  }
};
```

```typescript
// tests/generated/html-report.spec.ts
test('HTML Report UI', async ({ page }) => {
  await page.goto(process.env.BASE_URL + '/sample-report.html');
  await screenshotCheckpoint(page, 'full-report');
});
```

## Custom Server Setup

If your server needs special setup:

```javascript
targetRunner: {
  startCommand: 'npm run db:seed && npm start',
  baseUrl: 'http://localhost:3000'
}
```

## Timeout Configuration

The runner waits 30 seconds for your server to respond. If your app needs longer:

```javascript
targetRunner: {
  startCommand: 'npm start',
  // Note: Timeout configuration not yet implemented
  // File an issue if you need this feature
}
```
