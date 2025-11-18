// ABOUTME: Tests for CLI argument parsing and command structure
// ABOUTME: Validates command availability and help text

import { Command } from 'commander';
import { createCLI } from './cli';

describe('CLI', () => {
  it('should create CLI with commands', () => {
    const program = createCLI();
    expect(program).toBeDefined();
    expect(program.commands.length).toBeGreaterThan(0);
  });

  it('should have run command', () => {
    const program = createCLI();
    const runCmd = program.commands.find((cmd: Command) => cmd.name() === 'run');
    expect(runCmd).toBeDefined();
  });

  it('should have generate command', () => {
    const program = createCLI();
    const genCmd = program.commands.find((cmd: Command) => cmd.name() === 'generate');
    expect(genCmd).toBeDefined();
  });

  it('should have report command', () => {
    const program = createCLI();
    const reportCmd = program.commands.find((cmd: Command) => cmd.name() === 'report');
    expect(reportCmd).toBeDefined();
  });
});

describe('CLI - Orchestrator Integration', () => {
  it('should wire up generate command to GenerateCommandHandler', () => {
    const program = createCLI();
    const generateCommand = program.commands.find(cmd => cmd.name() === 'generate');

    expect(generateCommand).toBeDefined();
    expect(generateCommand?.description()).toContain('Generate test scripts');
  });

  it('should wire up run command to RunCommandHandler', () => {
    const program = createCLI();
    const runCommand = program.commands.find(cmd => cmd.name() === 'run');

    expect(runCommand).toBeDefined();
    const options = runCommand?.options || [];
    const optionFlags = options.map((opt: any) => opt.flags);

    expect(optionFlags).toContain('--all');
    expect(optionFlags).toContain('--base <branch>');
    expect(optionFlags).toContain('--fail-fast');
  });

  it('should wire up report command to ReportCommandHandler', () => {
    const program = createCLI();
    const reportCommand = program.commands.find(cmd => cmd.name() === 'report');

    expect(reportCommand).toBeDefined();
    const options = reportCommand?.options || [];
    const optionFlags = options.map((opt: any) => opt.flags);

    expect(optionFlags).toContain('--latest');
  });
});

describe('CLI run command with keepWorktrees', () => {
  it('should have --keep-worktrees flag', () => {
    const program = createCLI();
    const runCommand = program.commands.find(cmd => cmd.name() === 'run');

    expect(runCommand).toBeDefined();
    const options = runCommand?.options || [];
    const optionFlags = options.map((opt: any) => opt.flags);

    expect(optionFlags).toContain('--keep-worktrees');
  });
});
