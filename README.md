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
