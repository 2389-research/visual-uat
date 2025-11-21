# visual-uat

Visual acceptance testing with LLM-powered test generation.

## Target Runner Examples

Visual-uat works with any web server. Configure the `targetRunner` in your `visual-uat.config.js`:

### Node.js (npm)
```javascript
targetRunner: {
  startCommand: 'npm start'
}
```

### Static Files (npx serve)
```javascript
targetRunner: {
  startCommand: 'npx serve -l $PORT tests/fixtures'
}
```

### Python (http.server)
```javascript
targetRunner: {
  startCommand: 'cd tests/fixtures && python -m http.server $PORT'
}
```

### Go
```javascript
targetRunner: {
  startCommand: 'go run main.go'
}
```

### Elixir Phoenix
```javascript
targetRunner: {
  startCommand: 'mix phx.server'
}
```

For more examples, see [docs/examples/target-runners.md](docs/examples/target-runners.md)

## Dogfooding: Testing the HTML Reporter

Visual-uat tests its own HTML report structure to catch visual regressions.

### Generate Fixture Report
```bash
npm run setup:dogfood
```

This runs visual-uat on the demo-app, generating an HTML report at `examples/demo-app/.visual-uat/reports/latest.html`.

### Test Report Structure
```bash
npm run test:dogfood
```

This serves the generated reports and captures screenshots to verify the HTML structure hasn't broken.

### Use Case
When modifying `src/plugins/html-reporter.ts`, run both commands to see visual diffs of your changes.
