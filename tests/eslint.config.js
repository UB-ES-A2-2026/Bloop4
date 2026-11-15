// Configuració d'ESLint de tot el repositori (api/, bloop4-frontend/ i tests/).
// Viu a tests/ perquè les eines de QA tenen el seu propi package.json: així no es toquen les
// dependències de l'API ni del frontend. S'executa des de l'arrel amb `npm run lint` (a tests/).
//
// Errors: el que segur que és un error (variables no definides, regles dels hooks...). Bloquegen la CI.
// Avisos: qualitat i accessibilitat. Surten a l'informe del PR però no bloquegen.
import js from '@eslint/js';
import globals from 'globals';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import jsxA11y from 'eslint-plugin-jsx-a11y';

/** Mida i complexitat de les funcions: avisos per detectar el codi difícil de provar. */
const quality = {
  complexity: ['warn', 10],
  'max-depth': ['warn', 4],
  'max-params': ['warn', 5],
  'max-lines-per-function': ['warn', { max: 80, skipBlankLines: true, skipComments: true }],
};

/** Ni el paràmetre `next` dels gestors d'errors d'Express ni la desestructuració per treure camps. */
const noUnusedVars = ['error', { args: 'after-used', argsIgnorePattern: '^_|^next$', ignoreRestSiblings: true, caughtErrors: 'none' }];

/**
 * Accessibilitat: les regles recomanades de jsx-a11y (amb les seves opcions), però com a avís
 * durant el Sprint 2: corregir-les vol dir tocar components que els pegats del sprint també toquen.
 */
const a11yAsWarnings = Object.fromEntries(
  Object.entries(jsxA11y.flatConfigs.recommended.rules)
    .filter(([, setting]) => (Array.isArray(setting) ? setting[0] : setting) !== 'off')
    .map(([rule, setting]) => [rule, Array.isArray(setting) ? ['warn', ...setting.slice(1)] : 'warn']),
);

export default [
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/coverage/**',
      '**/.stryker-tmp/**',
      'tests/reports/**',
      'tests/playwright-report/**',
      'tests/test-results/**',
      'tests/.lighthouseci/**',
    ],
  },
  {
    files: ['**/*.{js,mjs,cjs,jsx}'],
    languageOptions: { ecmaVersion: 'latest', sourceType: 'module' },
    linterOptions: { reportUnusedDisableDirectives: 'warn' },
    rules: { ...js.configs.recommended.rules, 'no-unused-vars': noUnusedVars, ...quality },
  },
  { files: ['**/*.cjs'], languageOptions: { sourceType: 'commonjs' } },
  {
    // Codi que s'executa amb Node: l'API, les eines de QA i els fitxers de configuració.
    files: ['api/**/*.js', 'tests/**/*.{js,mjs,cjs}', 'bloop4-frontend/*.config.js'],
    languageOptions: { globals: globals.node },
  },
  {
    files: ['bloop4-frontend/src/**/*.{js,jsx}'],
    plugins: { react, 'react-hooks': reactHooks, 'jsx-a11y': jsxA11y },
    languageOptions: { globals: globals.browser, parserOptions: { ecmaFeatures: { jsx: true } } },
    settings: { react: { version: '18.3' } },
    rules: {
      ...react.configs.recommended.rules,
      ...react.configs['jsx-runtime'].rules,
      ...reactHooks.configs.recommended.rules,
      ...a11yAsWarnings,
      // Les props no es validen amb PropTypes (el projecte no les fa servir).
      'react/prop-types': 'off',
    },
  },
  {
    // Els tests poden ser llargs (un describe agrupa molts casos) i fan servir APIs de Node.
    files: ['**/*.test.{js,jsx}', 'bloop4-frontend/src/test/**', 'tests/e2e/**'],
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
    rules: { 'max-lines-per-function': 'off' },
  },
];
