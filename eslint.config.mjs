/**
 * ESLint flat config for Lexia.
 *
 * eslint-config-next 16.x ships as native flat config; import the two
 * sub-configs directly without using FlatCompat (which was for legacy
 * configs and breaks with newer Next.js).
 */
import nextCoreWebVitals from 'eslint-config-next/core-web-vitals'
import nextTypescript from 'eslint-config-next/typescript'

const eslintConfig = [
  ...nextCoreWebVitals,
  ...nextTypescript,
  {
    ignores: [
      '.next/**',
      'node_modules/**',
      'public/**',
      'scripts/*.sql',
      'scripts/*.mjs',
      'docs/**',
    ],
  },
  {
    rules: {
      // Codebase interops with external SDKs and DB rows that are legitimately `any`.
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      'react/no-unescaped-entities': 'off',
      // React Compiler rules are advisory (hints for automatic memoization) and
      // can surface many false positives on existing code. Downgrade to warn
      // so lint does not block on them; address them gradually.
      'react-hooks/exhaustive-deps': 'warn',
      'react-hooks/preserve-manual-memoization': 'warn',
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/purity': 'warn',
      'react-hooks/immutability': 'warn',
      'react-hooks/static-components': 'warn',
    },
  },
]

export default eslintConfig
