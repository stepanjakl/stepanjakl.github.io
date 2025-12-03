import globals from 'globals';
import pluginJs from '@eslint/js';
import pluginJsonc from 'eslint-plugin-jsonc';
import parserJsonc from 'jsonc-eslint-parser';

export default [
	{
		ignores: [
			'node_modules/',
			'dist/',
			'build/',
			'coverage/',
			'.git/',
			'.husky/',
			'.vscode/',
			'package-lock.json'
		]
	},
	{
		files: ['scripts/**/*.js'],
		languageOptions: {
			sourceType: 'script',
			globals: {
				...globals.browser,
				aria: 'readonly',
				openDialog: 'readonly',
				closeDialog: 'readonly',
				App: 'writable'
			},
			ecmaVersion: 2022
		},
		rules: {
			indent: ['error', 'tab', { SwitchCase: 1 }],
			quotes: ['error', 'single', { avoidEscape: true }],
			semi: ['error', 'always'],
			'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
			'no-console': 'off',
			'prefer-const': 'warn',
			'no-var': 'error',
			eqeqeq: ['warn', 'always', { null: 'ignore' }],
			curly: 'off',
			'brace-style': ['error', '1tbs'],
			'comma-dangle': ['error', 'never'],
			'space-before-function-paren': [
				'error',
				{ anonymous: 'always', named: 'never', asyncArrow: 'always' }
			],
			'keyword-spacing': ['error', { before: true, after: true }],
			'space-infix-ops': 'error',
			'arrow-spacing': ['error', { before: true, after: true }],
			'object-curly-spacing': ['error', 'always'],
			'array-bracket-spacing': ['error', 'never'],
			'no-multiple-empty-lines': ['error', { max: 4, maxEOF: 1 }],
			'no-trailing-spaces': 'error'
		}
	},
	pluginJs.configs.recommended,
	...pluginJsonc.configs['flat/recommended-with-jsonc'],
	{
		files: ['**/*.json'],
		languageOptions: {
			parser: parserJsonc
		},
		rules: {
			'jsonc/indent': ['error', 'tab'],
			'jsonc/key-spacing': ['error', { beforeColon: false, afterColon: true }],
			'jsonc/no-comments': 'off'
		}
	}
];
