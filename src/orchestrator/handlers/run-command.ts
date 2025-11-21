// ABOUTME: Handles the 'run' command, orchestrating the full test execution workflow.
// ABOUTME: Coordinates generation, execution in worktrees, screenshot comparison, and LLM evaluation.

import { Config } from '../../types/config';
import { LoadedPlugins } from '../services/plugin-registry';
import { ChangeDetector, RunOptions } from '../services/change-detector';
import { SpecManifest } from '../../specs/manifest';
import { TestSpec, CodebaseContext, ReporterOptions } from '../../types/plugins';
import { ExecutionState, ExecutionContext, ExecutionScope, RawTestResult } from './execution-states';
import { WorktreeManager } from '../services/worktree-manager';
import { TestRunner } from '../services/test-runner';
import { ResultStore } from '../services/result-store';
import { generateRunId } from '../services/run-id-generator';
import { ServerManager, ServerInfo } from '../services/server-manager';
import { execSync } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';

export interface GenerationResult {
  success: string[];
  failed: Array<{ spec: string; error: string }>;
}

export class RunCommandHandler {
  private changeDetector: ChangeDetector;
  private resultStore: ResultStore;
  private runOptions?: RunOptions;

  constructor(
    private config: Config,
    private plugins: LoadedPlugins,
    private projectRoot: string
  ) {
    const manifest = new SpecManifest(projectRoot);
    this.changeDetector = new ChangeDetector(config, manifest, projectRoot);
    this.resultStore = new ResultStore(projectRoot);
  }

  async determineScope(options: RunOptions): Promise<ExecutionScope> {
    const scopeType = this.changeDetector.determineScope(options);
    const baseBranch = options.baseBranch || this.config.baseBranch;
    const specsToGenerate = this.changeDetector.getSpecsToGenerate(scopeType);

    return {
      type: scopeType,
      baseBranch,
      specsToGenerate
    };
  }

  async generateTests(
    scope: ExecutionScope,
    options: { failFast?: boolean } = {}
  ): Promise<GenerationResult> {
    const specsToGenerate = scope.specsToGenerate;
    const results: GenerationResult = { success: [], failed: [] };
    const manifest = new SpecManifest(this.projectRoot);

    // Ensure generated directory exists
    if (!fs.existsSync(this.config.generatedDir)) {
      fs.mkdirSync(this.config.generatedDir, { recursive: true });
    }

    for (const specPath of specsToGenerate) {
      try {
        const generatedPath = await this.generateSingleTest(specPath);
        manifest.updateSpec(specPath, generatedPath);
        results.success.push(specPath);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        results.failed.push({ spec: specPath, error: errorMessage });

        if (options.failFast) {
          throw error;
        }
      }
    }

    manifest.save();
    return results;
  }

  private async generateSingleTest(specPath: string): Promise<string> {
    const content = fs.readFileSync(specPath, 'utf-8');
    const spec: TestSpec = {
      path: specPath,
      content,
      intent: content
    };

    const context: CodebaseContext = {
      files: [],
      structure: ''
    };

    const generated = await this.plugins.testGenerator.generate(spec, context);

    const baseName = path.basename(specPath, '.md');
    const outputPath = path.join(this.config.generatedDir, `${baseName}.spec.ts`);

    fs.writeFileSync(outputPath, generated.code);
    return outputPath;
  }

  private async handleSetup(
    context: ExecutionContext,
    options: RunOptions
  ): Promise<ExecutionState> {
    try {
      // Determine scope
      context.scope = await this.determineScope(options);

      if (context.scope.type === 'skip') {
        console.log('No changes detected, skipping tests');
        return 'COMPLETE';
      }

      // Generate tests
      await this.generateTests(context.scope);

      // Get current branch
      const currentBranch = execSync('git branch --show-current', {
        cwd: this.projectRoot,
        encoding: 'utf-8'
      }).trim();

      // Create worktrees
      const worktreeManager = new WorktreeManager(this.projectRoot);
      context.worktrees = await worktreeManager.createWorktrees(
        context.scope.baseBranch
      );

      // Start servers
      const basePort = options.basePort || 34567;
      const currentPort = options.currentPort || 34568;

      if (basePort === currentPort) {
        throw new Error(
          `Base port and current port cannot be the same (both are ${basePort}). ` +
          `Please specify different ports using --base-port and --current-port options.`
        );
      }

      await context.serverManager.startServer(context.worktrees.base, basePort);
      await context.serverManager.startServer(context.worktrees.current, currentPort);

      return 'EXECUTE_BASE';
    } catch (error) {
      console.error('Setup failed:', error);
      return 'FAILED';
    }
  }

  private async handleExecuteBase(
    context: ExecutionContext
  ): Promise<ExecutionState> {
    try {
      const screenshotDir = path.join(
        this.projectRoot,
        '.visual-uat/screenshots/base'
      );
      // Run tests from project root, not from worktree
      const runner = new TestRunner(this.projectRoot, screenshotDir, context.baseUrl);

      // Get list of generated tests
      const specsToRun = context.scope!.specsToGenerate;

      for (const specPath of specsToRun) {
        const baseName = path.basename(specPath, '.md');
        const testPath = path.resolve(
          this.projectRoot,
          this.config.generatedDir,
          `${baseName}.spec.ts`
        );

        console.log(`Running base test: ${baseName}`);
        const result = runner.runTest(testPath);

        context.baseResults.set(specPath, result);

        if (result.status === 'errored') {
          console.warn(`Base test errored: ${baseName} - ${result.error}`);
          console.warn('Will continue but flag as no baseline available');
        }
      }

      return 'EXECUTE_CURRENT';
    } catch (error) {
      console.error('Base execution failed:', error);
      return 'FAILED';
    }
  }

  private async handleExecuteCurrent(
    context: ExecutionContext
  ): Promise<ExecutionState> {
    try {
      const screenshotDir = path.join(
        this.projectRoot,
        '.visual-uat/screenshots/current'
      );
      const runner = new TestRunner(context.worktrees!.current, screenshotDir, context.currentUrl);

      const specsToRun = context.scope!.specsToGenerate;

      for (const specPath of specsToRun) {
        const baseName = path.basename(specPath, '.md');
        const testPath = path.resolve(
          this.projectRoot,
          this.config.generatedDir,
          `${baseName}.spec.ts`
        );

        console.log(`Running current test: ${baseName}`);
        const result = runner.runTest(testPath);

        context.currentResults.set(specPath, result);

        if (result.status === 'errored') {
          console.warn(`Current test errored: ${baseName} - ${result.error}`);
        }
      }

      return 'COMPARE_AND_EVALUATE';
    } catch (error) {
      console.error('Current execution failed:', error);
      return 'FAILED';
    }
  }

  private async handleCompareAndEvaluate(
    context: ExecutionContext
  ): Promise<ExecutionState> {
    try {
      const tests: import('../types/results').TestResult[] = [];

      for (const specPath of context.scope!.specsToGenerate) {
        const baseResult = context.baseResults.get(specPath);
        const currentResult = context.currentResults.get(specPath);

        if (!baseResult || !currentResult) {
          continue;
        }

        const baseName = path.basename(specPath, '.md');
        const generatedPath = path.join(
          this.config.generatedDir,
          `${baseName}.spec.ts`
        );

        // If base errored, mark as no baseline
        if (baseResult.status === 'errored') {
          tests.push({
            specPath,
            generatedPath,
            status: 'errored',
            checkpoints: [],
            duration: currentResult.duration,
            error: `No baseline available: ${baseResult.error}`,
            baselineAvailable: false
          });
          continue;
        }

        // If current errored, mark as errored
        if (currentResult.status === 'errored') {
          tests.push({
            specPath,
            generatedPath,
            status: 'errored',
            checkpoints: [],
            duration: currentResult.duration,
            error: currentResult.error,
            baselineAvailable: true
          });
          continue;
        }

        // Compare screenshots for each checkpoint
        const checkpoints: import('../types/results').CheckpointResult[] = [];
        const specContent = fs.readFileSync(specPath, 'utf-8');

        for (let i = 0; i < baseResult.screenshots.length; i++) {
          const checkpointName = baseResult.screenshots[i];
          const baseImagePath = path.join(
            this.projectRoot,
            '.visual-uat/screenshots/base',
            checkpointName
          );
          const currentImagePath = path.join(
            this.projectRoot,
            '.visual-uat/screenshots/current',
            checkpointName
          );

          // Load images as Screenshot objects
          const baseImageData = fs.readFileSync(baseImagePath);
          const currentImageData = fs.readFileSync(currentImagePath);

          const baseScreenshot: import('../../types/plugins').Screenshot = {
            data: baseImageData,
            width: 0,
            height: 0,
            checkpoint: path.basename(checkpointName, '.png')
          };

          const currentScreenshot: import('../../types/plugins').Screenshot = {
            data: currentImageData,
            width: 0,
            height: 0,
            checkpoint: path.basename(checkpointName, '.png')
          };

          const diffResult = await this.plugins.differ.compare(
            baseScreenshot,
            currentScreenshot
          );

          let evaluation;

          // Only evaluate if there are differences
          if (diffResult.pixelDiffPercent > 0) {
            evaluation = await this.plugins.evaluator.evaluate({
              intent: specContent,
              checkpoint: path.basename(checkpointName, '.png'),
              diffResult: diffResult,
              baselineImage: baseImageData,
              currentImage: currentImageData
            });
          } else {
            // No differences, auto-pass
            evaluation = {
              pass: true,
              confidence: 1.0,
              reason: 'No visual differences detected',
              needsReview: false
            };
          }

          // Save diff image to disk
          const diffImagePath = path.join(
            this.projectRoot,
            '.visual-uat/diffs',
            checkpointName
          );
          const diffDir = path.dirname(diffImagePath);
          if (!fs.existsSync(diffDir)) {
            fs.mkdirSync(diffDir, { recursive: true });
          }
          fs.writeFileSync(diffImagePath, diffResult.diffImage);

          checkpoints.push({
            name: path.basename(checkpointName, '.png'),
            baselineImage: baseImagePath,
            currentImage: currentImagePath,
            diffImage: diffImagePath,
            diffMetrics: {
              pixelDiffPercent: diffResult.pixelDiffPercent,
              changedRegions: diffResult.changedRegions
            },
            evaluation: evaluation
          });
        }

        // Determine overall test status
        let status: import('../types/results').TestResult['status'] = 'passed';
        if (checkpoints.some(c => c.evaluation?.needsReview)) {
          status = 'needs-review';
        } else if (checkpoints.some(c => !c.evaluation?.pass)) {
          status = 'failed';
        }

        tests.push({
          specPath,
          generatedPath,
          status,
          checkpoints,
          duration: currentResult.duration,
          baselineAvailable: true
        });
      }

      // Build RunResult
      const currentBranch = execSync('git branch --show-current', {
        cwd: this.projectRoot,
        encoding: 'utf-8'
      }).trim();

      context.runResult = {
        runId: '', // Will be generated in handleStoreResults
        timestamp: Date.now(),
        baseBranch: context.scope!.baseBranch,
        currentBranch: currentBranch,
        config: this.config,
        tests: tests,
        summary: {
          total: tests.length,
          passed: tests.filter(t => t.status === 'passed').length,
          failed: tests.filter(t => t.status === 'failed').length,
          errored: tests.filter(t => t.status === 'errored').length,
          needsReview: tests.filter(t => t.status === 'needs-review').length
        }
      };

      return 'STORE_RESULTS';
    } catch (error) {
      console.error('Comparison and evaluation failed:', error);
      return 'FAILED';
    }
  }

  private getVerbosity(): 'quiet' | 'normal' | 'verbose' {
    // CLI flags take precedence over config
    if (this.runOptions) {
      // Warn if both quiet and verbose are specified (conflicting flags)
      if (this.runOptions.quiet && this.runOptions.verbose) {
        console.warn('Warning: Both --quiet and --verbose flags specified. Using --quiet.');
      }
      if (this.runOptions.quiet) {
        return 'quiet';
      }
      if (this.runOptions.verbose) {
        return 'verbose';
      }
    }

    // Use config default verbosity if specified
    if (this.config.reporters?.terminal?.defaultVerbosity) {
      return this.config.reporters.terminal.defaultVerbosity;
    }

    // Default to normal
    return 'normal';
  }

  private async handleStoreResults(
    context: ExecutionContext
  ): Promise<ExecutionState> {
    try {
      // Generate runId if not already set
      if (!context.runResult!.runId) {
        context.runResult!.runId = generateRunId();
      }

      await this.resultStore.saveRunResult(context.runResult!);
      console.log('Results saved');

      // Generate reports
      const reporterOptions: ReporterOptions = {
        verbosity: this.getVerbosity(),
        outputDir: path.join(this.projectRoot, '.visual-uat/reports'),
        autoOpen: this.runOptions?.open || false
      };

      // Call terminal reporter first for immediate feedback (unless disabled in config)
      const terminalEnabled = this.config.reporters?.terminal?.enabled !== false;
      if (terminalEnabled) {
        try {
          await this.plugins.terminalReporter.generate(context.runResult!, reporterOptions);
        } catch (error) {
          console.error('Terminal reporter failed:', error);
        }
      }

      // Call HTML reporter second (unless --no-html flag is set or disabled in config)
      const htmlEnabled = this.config.reporters?.html?.enabled !== false;
      if (!this.runOptions?.noHtml && htmlEnabled) {
        try {
          await this.plugins.htmlReporter.generate(context.runResult!, reporterOptions);
        } catch (error) {
          console.error('HTML reporter failed:', error);
        }
      }

      return 'CLEANUP';
    } catch (error) {
      console.error('Failed to store results:', error);
      return 'FAILED';
    }
  }

  private async handleCleanup(
    context: ExecutionContext
  ): Promise<ExecutionState> {
    try {
      // Clean up servers first
      context.serverManager.cleanup();

      if (!context.keepWorktrees) {
        const worktreeManager = new WorktreeManager(this.projectRoot);
        worktreeManager.cleanup();
        console.log('Worktrees cleaned up');
      } else {
        console.log('Keeping worktrees for debugging');
      }
      return 'COMPLETE';
    } catch (error) {
      console.warn('Cleanup failed:', error);
      // Don't fail the whole run if cleanup fails
      return 'COMPLETE';
    }
  }

  async execute(options: RunOptions): Promise<number> {
    // Store runOptions for access by helper methods
    this.runOptions = options;

    const basePort = options.basePort || 34567;
    const currentPort = options.currentPort || 34568;

    let state: ExecutionState = 'SETUP';
    const context: ExecutionContext = {
      scope: null,
      worktrees: null,
      serverManager: new ServerManager(),
      baseUrl: `http://localhost:${basePort}`,
      currentUrl: `http://localhost:${currentPort}`,
      baseResults: new Map<string, RawTestResult>(),
      currentResults: new Map<string, RawTestResult>(),
      runResult: null,
      keepWorktrees: options.keepWorktrees || false
    };

    try {
      while (state !== 'COMPLETE' && state !== 'FAILED') {
        switch (state) {
          case 'SETUP':
            state = await this.handleSetup(context, options);
            break;
          case 'EXECUTE_BASE':
            state = await this.handleExecuteBase(context);
            break;
          case 'EXECUTE_CURRENT':
            state = await this.handleExecuteCurrent(context);
            break;
          case 'COMPARE_AND_EVALUATE':
            state = await this.handleCompareAndEvaluate(context);
            break;
          case 'STORE_RESULTS':
            state = await this.handleStoreResults(context);
            break;
          case 'CLEANUP':
            state = await this.handleCleanup(context);
            break;
        }
      }

      // Ensure cleanup runs even when handlers return 'FAILED'
      if (state === 'FAILED') {
        try {
          context.serverManager.cleanup();
        } catch (serverCleanupError) {
          console.error('Server cleanup error:', serverCleanupError);
        }
        if (!context.keepWorktrees && context.worktrees) {
          try {
            const worktreeManager = new WorktreeManager(this.projectRoot);
            worktreeManager.cleanup();
          } catch (cleanupError) {
            console.error('Cleanup error:', cleanupError);
          }
        }
      }

      return state === 'COMPLETE' ? 0 : 1;
    } catch (error) {
      console.error('Execution error:', error);

      // Attempt cleanup before failing
      try {
        context.serverManager.cleanup();
      } catch (serverCleanupError) {
        console.error('Server cleanup error:', serverCleanupError);
      }

      if (!context.keepWorktrees && context.worktrees) {
        try {
          const worktreeManager = new WorktreeManager(this.projectRoot);
          worktreeManager.cleanup();
        } catch (cleanupError) {
          console.error('Cleanup error:', cleanupError);
        }
      }

      return 1;
    }
  }
}
