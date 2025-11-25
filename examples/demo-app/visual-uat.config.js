module.exports = {
  baseBranch: 'main',
  specsDir: './tests/specs',
  generatedDir: './tests/generated',
  plugins: {
    testGenerator: '@visual-uat/stub-generator',
    targetRunner: '@visual-uat/web-runner',
    differ: '@visual-uat/smart-differ',
    evaluator: '@visual-uat/claude-evaluator'
  },
  targetRunner: {
    startCommand: 'npm start'
  },
  evaluator: {
    autoPassThreshold: 0.95,
    autoFailThreshold: 0.3
  }
};
