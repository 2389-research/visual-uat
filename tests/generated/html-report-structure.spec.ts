import { test, expect, Page } from '@playwright/test';
import { screenshotCheckpoint } from 'visual-uat/playwright';

test('# HTML Report Structure', async ({ page }) => {
  // Navigate to base URL (from config)
  await page.goto(process.env.BASE_URL || 'http://localhost:3000');

  // Checkpoint 1: default
  await screenshotCheckpoint(page, 'default');

});
