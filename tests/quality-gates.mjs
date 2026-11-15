// Llindars de qualitat que comprova la CI. Són una mica per sota del valor que teníem en
// posar-los (15/11/2026): frenen una baixada sense obligar a perseguir el 100 %.
// Si algun s'ha de tocar, s'acorda amb l'equip i es canvia aquí (no als workflows).
export const coverageThresholds = {
  // node:test amb PostgreSQL; els fitxers que cap test carrega (server.js) compten com a 0 %.
  // Llavors: 94,1 % de línies, 89,7 % de branques i 92,8 % de funcions (94,4 · 89,2 · 91,0 amb el Sprint 2).
  api: { lines: 90, branches: 85, functions: 85 },
  // Vitest + v8, tots els fitxers de src/ encara que cap test els importi.
  // Llavors: 83,8 % de línies, 87,3 % de branques i 73,5 % de funcions (82,8 · 88,4 · 75,3 amb el Sprint 2).
  frontend: { lines: 80, branches: 80, functions: 70 },
};
