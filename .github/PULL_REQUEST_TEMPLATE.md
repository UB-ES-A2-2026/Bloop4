## Descripció
<!-- Quin problema resol aquest PR i per què. Una o dues frases. -->

<!-- Una línia per la història i una per cada tasca: GitHub les tanca quan el PR entra a dev. -->
Closes #<!-- nº de la història d'usuari -->
Closes #<!-- nº de cada tasca -->

## Què s'ha canviat
<!-- Llista de canvis concrets: fitxers, endpoints, taules, components. -->
-

## Tipus de canvi
- [ ] `feat` · Funcionalitat nova
- [ ] `fix` · Correcció d'un error
- [ ] `test` · Tests o configuració de testing
- [ ] `build` / `ci` · Docker, dependències o pipelines
- [ ] `docs` · Documentació
- [ ] `chore` / `refactor` · Configuració o canvis interns sense canvi de comportament

## Com provar-ho
<!-- Passos exactes perquè qui revisa pugui comprovar el canvi. -->
1.
2.

**Resultat esperat:**

## Captures (si canvia la interfície)
<!-- Abans / després. Esborra aquesta secció si no s'aplica. -->

## Checklist
- [ ] És la branca de la història (`<tipus>/<nº-història>-<descripcio>`), està rebasada sobre `dev` i el PR va cap a `dev`
- [ ] Totes les tasques de la història hi són, amb com a mínim 2 commits
- [ ] Els commits segueixen Conventional Commits
- [ ] El PR només inclou canvis de la seva història
- [ ] `npm test` passa a `api/` i a `bloop4-frontend/` (si es toquen)
- [ ] `docker compose up -d --build` aixeca el stack sense errors (si es toca codi o infraestructura)
- [ ] No es pugen secrets, `.env`, `node_modules/` ni `dist/`
- [ ] Documentació actualitzada si canvia el comportament, l'API o el model de dades
- [ ] He assignat un revisor que no ha fet cap commit de la història i he enllaçat els issues al tauler
