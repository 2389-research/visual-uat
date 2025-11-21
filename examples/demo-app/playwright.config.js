// ABOUTME: Playwright configuration for visual-uat demo-app
// ABOUTME: Minimal config to enable test execution with BASE_URL from env

module.exports = {
  use: {
    baseURL: process.env.BASE_URL || 'http://localhost:3000',
  },
};
