module.exports = {
  baseBranch: 'main',
  specsDir: './tests/specs',
  generatedDir: './tests/generated',
  plugins: {
    testGenerator: '@visual-uat/stub-generator',
    targetRunner: '@visual-uat/playwright-runner',
    differ: '@visual-uat/pixelmatch-differ',
    evaluator: '@visual-uat/claude-evaluator'
  },
  evaluator: {
    autoPassThreshold: 0.95,
    autoFailThreshold: 0.3
  }
};
