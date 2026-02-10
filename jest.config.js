module.exports = {
  // Configuração para testar tanto o backend (Node.js) quanto o frontend (navegador)
  projects: [
    {
      displayName: 'backend',
      testEnvironment: 'node',
      testMatch: ['<rootDir>/functions/**/*.test.js'],
      collectCoverageFrom: [
        'functions/**/*.js',
        '!functions/node_modules/**',
      ],
    },
    {
      displayName: 'frontend',
      testEnvironment: 'jsdom',
      testMatch: ['<rootDir>/public/**/*.test.js'],
      collectCoverageFrom: [
        'public/**/*.js',
        '!public/data/**',
        '!public/**/*.test.js',
      ],
      setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
    },
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
};
