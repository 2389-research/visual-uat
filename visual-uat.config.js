// ABOUTME: Root-level visual-uat configuration for dogfooding HTML report tests
// ABOUTME: Configures web-runner to serve generated reports from demo-app
module.exports = {
  baseBranch: 'main',
  specsDir: './tests/specs',
  generatedDir: './tests/generated',
  plugins: {
    testGenerator: '@visual-uat/stub-generator',
    targetRunner: '@visual-uat/web-runner',
    differ: '@visual-uat/pixelmatch-differ',
    evaluator: '@visual-uat/claude-evaluator'
  },
  targetRunner: {
    startCommand: 'npx serve -l $PORT examples/demo-app/.visual-uat/reports'
  },
  evaluator: {
    autoPassThreshold: 0.95,
    autoFailThreshold: 0.3
  }
};
