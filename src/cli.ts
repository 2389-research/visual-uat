#!/usr/bin/env node
// ABOUTME: CLI entry point for visual-uat tool
// ABOUTME: Defines commands for test generation, execution, and reporting

import { Command } from 'commander';
import { version } from './index';

export function createCLI(): Command {
  const program = new Command();

  program
    .name('visual-uat')
    .description('Visual acceptance testing with LLM-powered test generation')
    .version(version);

  program
    .command('run')
    .description('Generate tests (if needed) and run visual comparison')
    .option('--all', 'Force run all tests (ignore caching)')
    .option('--base <branch>', 'Base branch to compare against (default from config)')
    .action(async (options) => {
      console.log('Running visual tests...');
      console.log('Options:', options);
      // Implementation will be added in orchestrator task
      throw new Error('Not yet implemented');
    });

  program
    .command('generate')
    .description('Force regenerate all test scripts from specs')
    .action(async () => {
      console.log('Generating test scripts...');
      // Implementation will be added in generator task
      throw new Error('Not yet implemented');
    });

  program
    .command('report')
    .description('Open HTML report viewer')
    .option('--latest', 'Open most recent report')
    .action(async (options) => {
      console.log('Opening report...');
      console.log('Options:', options);
      // Implementation will be added in reporter task
      throw new Error('Not yet implemented');
    });

  return program;
}

// Run CLI if executed directly
if (require.main === module) {
  const program = createCLI();
  program.parse(process.argv);
}
