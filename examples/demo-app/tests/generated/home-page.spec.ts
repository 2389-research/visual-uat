import { test, expect, Page } from '@playwright/test';
import { screenshotCheckpoint } from 'visual-uat/playwright';

test('# Home Page Visual Test', async ({ page }) => {
  // Navigate to base URL (from config)
  await page.goto(process.env.BASE_URL || 'http://localhost:3000');

  // Checkpoint 1: home-initial
  await screenshotCheckpoint(page, 'home-initial');

  // Checkpoint 2: header-loaded
  await screenshotCheckpoint(page, 'header-loaded');

  // Checkpoint 3: feature-cards-visible
  await screenshotCheckpoint(page, 'feature-cards-visible');

});
