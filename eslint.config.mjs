import typescriptEslint from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';

export default [{
    files: [
        '**/*.ts',
    ],
}, {
    plugins: {
        '@typescript-eslint': typescriptEslint,
    },
    languageOptions: {
        parser: tsParser,
        ecmaVersion: 2022,
        sourceType: 'module',
    },
    rules: {
        '@typescript-eslint/naming-convention': ['warn', {
            selector: 'import',
            format: [
                'camelCase',
                'PascalCase',
            ],
        }],
        indent: ['error', 4, {SwitchCase: 1, ArrayExpression: 1, ObjectExpression: 1}],
        'no-tabs': [0, {allowIndentationTabs: true}],
        'no-console': 'off',
        'max-len': ['warn', 120],
        'array-bracket-spacing': ['error', 'never'],
        'array-callback-return': 'error',
        'arrow-parens': ['error', 'always'],
        'arrow-spacing': ['error', {before: true, after: true}],
        'brace-style': ['error', '1tbs'],
        'comma-dangle': ['error', 'always-multiline'],
        'comma-spacing': ['error', {before: false, after: true}],
        'key-spacing': ['error', {beforeColon: false, afterColon: true}],
        'linebreak-style': 'off',
        'new-cap': 'off',
        'newline-before-return': 'error',
        'no-array-constructor': 'error',
        'no-const-assign': 'error',
        'no-duplicate-imports': 'error',
        'no-multi-assign': 'error',
        'no-multiple-empty-lines': 'error',
        'no-new-object': 'error',
        'no-unreachable': 'error',
        'no-unneeded-ternary': 'error',
        'no-useless-constructor': 'off',
        'object-curly-spacing': ['error', 'never'],
        'object-shorthand': 'error',
        'one-var': ['error', 'never'],
        'operator-linebreak': ['error', 'before', {overrides: {'&&': 'after'}}],
        'padded-blocks': ['error', 'never'],
        'prefer-const': 'error',
        'prefer-destructuring': ['error', {object: true, array: true}],
        'prefer-promise-reject-errors': 'off',
        'prefer-template': 'error',
        'quote-props': ['error', 'as-needed'],
        quotes: ['error', 'single'],
        'require-jsdoc': 'off',
        semi: ['error', 'always'],
        'space-before-blocks': ['error', 'always'],
        'space-in-parens': ['error', 'never'],
        'template-curly-spacing': ['error', 'never'],
        'space-before-function-paren': ['error', {named: 'never', anonymous: 'always', asyncArrow: 'always'}],
    },
}];
