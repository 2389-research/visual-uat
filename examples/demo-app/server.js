// ABOUTME: Simple Express server for visual-uat demo app
// ABOUTME: Serves static files and provides basic API endpoints for testing

const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Serve static files
app.use(express.static('public'));
app.use(express.json());

// API endpoint for form submission
app.post('/api/submit', (req, res) => {
  const { name, email } = req.body;
  res.json({
    success: true,
    message: `Thank you, ${name}! We'll contact you at ${email}.`
  });
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});

app.listen(PORT, () => {
  console.log(`Demo app running at http://localhost:${PORT}`);
});
