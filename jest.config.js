/* eslint-disable no-undef */
'use strict';

/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  collectCoverage: false,
  coverageReporters: [],
  verbose: true,
  testMatch: [
    "**/test/**/*.test.ts"
  ],
  transform: {
    "^.+\\.tsx?$": "ts-jest"
  }
}; 