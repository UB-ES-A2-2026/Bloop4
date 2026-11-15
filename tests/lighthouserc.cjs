// Lighthouse CI sobre les pantalles públiques del stack de proves (npm run lighthouse).
// Les puntuacions de rendiment als runners compartits varien d'una execució a l'altra: per això
// es fan 3 passades (es pren la mediana) i només l'accessibilitat fa fallar; la resta són avisos.
const BASE_URL = process.env.E2E_BASE_URL ?? 'http://localhost:8180';

module.exports = {
  ci: {
    collect: {
      url: [`${BASE_URL}/`, `${BASE_URL}/productos/d0000000-0000-4000-8000-000000000014`, `${BASE_URL}/iniciar-sesion`],
      numberOfRuns: 3,
      settings: {
        preset: 'desktop',
        // L'aplicació només és en castellà: així també ho veu Lighthouse.
        locale: 'es',
        chromeFlags: '--headless=new --no-sandbox',
      },
    },
    assert: {
      assertions: {
        'categories:accessibility': ['error', { minScore: 0.9, aggregationMethod: 'median-run' }],
        'categories:performance': ['warn', { minScore: 0.8, aggregationMethod: 'median-run' }],
        'categories:best-practices': ['warn', { minScore: 0.9, aggregationMethod: 'median-run' }],
        'categories:seo': ['warn', { minScore: 0.8, aggregationMethod: 'median-run' }],
      },
    },
    upload: { target: 'filesystem', outputDir: './reports/lighthouse' },
  },
};
