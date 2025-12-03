#!/usr/bin/env node
// ABOUTME: CLI entry point for visual-uat tool
// ABOUTME: Defines commands for test generation, execution, and reporting

import { spawnSync } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';

// When running from a worktree, copy .env.local from main checkout
// This ensures environment variables (like ANTHROPIC_API_KEY) are available
const gitCommonDirResult = spawnSync('git', ['rev-parse', '--git-common-dir'], {
  encoding: 'utf-8',
  stdio: 'pipe'
});

if (gitCommonDirResult.status === 0) {
  const gitCommonDir = gitCommonDirResult.stdout.trim();
  const mainCheckout = path.dirname(gitCommonDir);
  const envSource = path.join(mainCheckout, '.env.local');
  const envLocal = path.join(process.cwd(), '.env.local');

  // Copy .env.local if it exists in main checkout but not in current directory
  if (fs.existsSync(envSource) && !fs.existsSync(envLocal) && envSource !== envLocal) {
    fs.copyFileSync(envSource, envLocal);
  }
}

// Load environment variables from .env.local (for ANTHROPIC_API_KEY, etc.)
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { Command } from 'commander';
import { version } from './index';
import { loadConfig } from './config/loader';
import { PluginRegistry } from './orchestrator/services/plugin-registry';
import { ResultStore } from './orchestrator/services/result-store';
import { RunCommandHandler } from './orchestrator/handlers/run-command';
import { ReportCommandHandler } from './orchestrator/handlers/report-command';

export function createCLI(): Command {
  const program = new Command();

  program
    .name('visual-uat')
    .description('Visual acceptance testing with LLM-powered test generation')
    .version(version);

  program
    .command('generate')
    .description('Generate test scripts from stories or specifications')
    .option('--force', 'Regenerate all tests (ignore cache)')
    .action(async (options) => {
      try {
        const projectRoot = process.cwd();
        const config = await loadConfig(projectRoot);

        const { GeneratePipeline } = await import('./pipeline/generate-pipeline');
        const pipeline = new GeneratePipeline(projectRoot, {
          storiesDir: config.storiesDir || './tests/stories',
          runner: config.runner || 'playwright',
          force: options.force
        });

        console.log('Checking stories...');

        const result = await pipeline.run({
          onProgress: (storyPath: string, status: 'skipped' | 'generating') => {
            const icon = status === 'skipped' ? '✓' : '↻';
            const message = status === 'skipped' ? '(unchanged, skipping)' : '(changed, regenerating)';
            const fileName = path.basename(storyPath);
            console.log(`  ${icon} ${fileName} ${message}`);
          }
        });

        console.log(`\nGenerated: ${result.generated} spec${result.generated === 1 ? '' : 's'}, ${result.generated} test${result.generated === 1 ? '' : 's'}`);
        console.log(`Skipped: ${result.skipped} (unchanged)`);
        if (result.errors.length > 0) {
          console.log(`Errors: ${result.errors.length}`);
          result.errors.forEach(e => console.log(`  - ${e.story}: ${e.error}`));
          process.exit(1);
        }
        process.exit(0);
      } catch (error) {
        console.error('Error:', error instanceof Error ? error.message : error);
        process.exit(2);
      }
    });

  program
    .command('run')
    .description('Run visual acceptance tests')
    .option('--all', 'Force run all tests (ignore change detection)')
    .option('--base <branch>', 'Base branch to compare against')
    .option('--fail-fast', 'Stop on first error')
    .option('--keep-worktrees', 'Keep worktrees after execution for debugging')
    .option('--quiet, -q', 'Terminal reporter quiet mode (minimal output, overrides verbose)')
    .option('--verbose, -v', 'Terminal reporter verbose mode (detailed output)')
    .option('--no-html', 'Skip HTML report generation')
    .option('--open, -o', 'Auto-open HTML report in browser after generation')
    .option(
      '--base-port <port>',
      'Port for baseline server (auto-detected if not specified)',
      (value) => parseInt(value, 10)
    )
    .option(
      '--current-port <port>',
      'Port for current server (auto-detected if not specified)',
      (value) => parseInt(value, 10)
    )
    .action(async (options) => {
      try {
        const projectRoot = process.cwd();
        const config = await loadConfig(projectRoot);
        const registry = new PluginRegistry(config);
        const plugins = registry.loadAll();

        const handler = new RunCommandHandler(config, plugins, projectRoot);
        const exitCode = await handler.execute({
          all: options.all,
          baseBranch: options.base,
          failFast: options.failFast,
          keepWorktrees: options.keepWorktrees,
          quiet: options.quiet,
          verbose: options.verbose,
          // Commander negates --no-html to options.html = false
          noHtml: options.html === false,
          open: options.open,
          basePort: options.basePort,
          currentPort: options.currentPort
        });
        process.exit(exitCode);
      } catch (error) {
        console.error('Error:', error instanceof Error ? error.message : error);
        process.exit(2);
      }
    });

  program
    .command('report')
    .description('View test results')
    .option('--latest', 'Show latest run (default)')
    .argument('[runId]', 'Specific run ID to view')
    .action(async (runId, options) => {
      try {
        const projectRoot = process.cwd();
        const resultStore = new ResultStore(projectRoot);

        const handler = new ReportCommandHandler(resultStore);
        const exitCode = await handler.execute(runId ? parseInt(runId) : undefined);
        process.exit(exitCode);
      } catch (error) {
        console.error('Error:', error instanceof Error ? error.message : error);
        process.exit(2);
      }
    });

  return program;
}

// Run CLI if executed directly
if (require.main === module) {
  const program = createCLI();
  program.parse(process.argv);
}
