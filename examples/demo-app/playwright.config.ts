// ABOUTME: Playwright configuration for visual-uat demo-app
// ABOUTME: Minimal config to enable TypeScript test execution

import { defineConfig } from '@playwright/test';

export default defineConfig({
  use: {
    baseURL: process.env.BASE_URL || 'http://localhost:3000',
  },
});
