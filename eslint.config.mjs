import js from '@eslint/js';
import typescript from 'typescript-eslint';

export default [
  js.configs.recommended,
  ...typescript.configs.recommended,
  {
    files: ['src/**/*.ts'],
    languageOptions: {
      parser: typescript.parser,
      parserOptions: {
        project: './tsconfig.json'
      }
    },
    rules: {
      'no-unused-vars': 'warn',
      '@typescript-eslint/no-explicit-any': 'warn'
    }
  }
];