#!/usr/bin/env node
// ABOUTME: CLI entry point for visual-uat tool
// ABOUTME: Defines commands for test generation, execution, and reporting

import { Command } from 'commander';
import { version } from './index';
import { loadConfig } from './config/loader';
import { PluginRegistry } from './orchestrator/services/plugin-registry';
import { ResultStore } from './orchestrator/services/result-store';
import { GenerateCommandHandler } from './orchestrator/handlers/generate-command';
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
    .description('Generate test scripts from specifications')
    .action(async () => {
      try {
        const projectRoot = process.cwd();
        const config = await loadConfig(projectRoot);
        const registry = new PluginRegistry(config);
        const plugins = registry.loadAll();

        const handler = new GenerateCommandHandler(config, projectRoot);
        const exitCode = await handler.execute(plugins.testGenerator);
        process.exit(exitCode);
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
          failFast: options.failFast
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
