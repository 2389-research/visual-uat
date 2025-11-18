// ABOUTME: Helper functions for generated Playwright tests.
// ABOUTME: Provides screenshotCheckpoint() for capturing screenshots at specific test points.

import * as path from 'path';
import type { Page } from 'playwright';

/**
 * Capture a screenshot at a named checkpoint during test execution.
 * The SCREENSHOT_DIR environment variable must be set by the orchestrator.
 *
 * @param page - Playwright Page object
 * @param name - Checkpoint name (becomes filename)
 */
export async function screenshotCheckpoint(
  page: Page,
  name: string
): Promise<void> {
  const screenshotDir = process.env.SCREENSHOT_DIR;
  if (!screenshotDir) {
    throw new Error('SCREENSHOT_DIR environment variable not set');
  }

  const screenshotPath = path.join(screenshotDir, `${name}.png`);

  await page.screenshot({
    path: screenshotPath,
    fullPage: true
  });
}
