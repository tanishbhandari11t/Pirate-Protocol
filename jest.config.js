/** @type {import('jest').Config} */
const smoke = process.env.SMOKE === '1';

module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['<rootDir>/src/**/*.spec.ts'],
  testPathIgnorePatterns: smoke ? ['/node_modules/'] : ['/node_modules/', '\\.smoke\\.spec\\.ts$'],
  clearMocks: true,
};
