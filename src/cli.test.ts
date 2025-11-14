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
