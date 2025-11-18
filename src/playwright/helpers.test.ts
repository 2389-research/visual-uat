// ABOUTME: Unit tests for Playwright helper functions.
// ABOUTME: Tests screenshotCheckpoint behavior with mock page objects.

import { screenshotCheckpoint } from './helpers';
import * as path from 'path';
import * as fs from 'fs';

// Mock Playwright types
interface MockPage {
  screenshot: jest.Mock;
}

describe('screenshotCheckpoint', () => {
  let mockPage: MockPage;
  const originalEnv = process.env.SCREENSHOT_DIR;

  beforeEach(() => {
    mockPage = {
      screenshot: jest.fn()
    };
  });

  afterEach(() => {
    if (originalEnv !== undefined) {
      process.env.SCREENSHOT_DIR = originalEnv;
    } else {
      delete process.env.SCREENSHOT_DIR;
    }
  });

  it('should call page.screenshot with correct path', async () => {
    process.env.SCREENSHOT_DIR = '/tmp/screenshots';

    await screenshotCheckpoint(mockPage as any, 'initial');

    expect(mockPage.screenshot).toHaveBeenCalledWith({
      path: '/tmp/screenshots/initial.png',
      fullPage: true
    });
  });

  it('should throw if SCREENSHOT_DIR not set', async () => {
    delete process.env.SCREENSHOT_DIR;

    await expect(
      screenshotCheckpoint(mockPage as any, 'test')
    ).rejects.toThrow('SCREENSHOT_DIR environment variable not set');
  });

  it('should handle checkpoint names with spaces', async () => {
    process.env.SCREENSHOT_DIR = '/tmp/screenshots';

    await screenshotCheckpoint(mockPage as any, 'after login');

    expect(mockPage.screenshot).toHaveBeenCalledWith({
      path: '/tmp/screenshots/after login.png',
      fullPage: true
    });
  });
});
