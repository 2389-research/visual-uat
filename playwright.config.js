// ABOUTME: Playwright configuration for visual-uat dogfooding tests
// ABOUTME: Minimal config to enable test execution with BASE_URL from env

module.exports = {
  testDir: './tests/generated',
  use: {
    baseURL: process.env.BASE_URL || 'http://localhost:3000',
  },
};
