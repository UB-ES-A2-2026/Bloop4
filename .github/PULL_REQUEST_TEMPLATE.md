## Descripció
<!-- Quin problema resol aquest PR i per què. Una o dues frases. -->

Closes #<!-- nº de la tasca -->
Part of #<!-- nº de la història d'usuari -->

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
- [ ] La branca segueix la convenció `<tipus>/<nº-issue>-<descripcio>` i surt de `main` actualitzat
- [ ] Els commits segueixen Conventional Commits
- [ ] El PR només inclou canvis del seu issue
- [ ] `npm test` passa a `api/` i a `bloop4-frontend/` (si es toquen)
- [ ] `docker compose up -d --build` aixeca el stack sense errors (si es toca codi o infraestructura)
- [ ] No es pugen secrets, `.env`, `node_modules/` ni `dist/`
- [ ] Documentació actualitzada si canvia el comportament, l'API o el model de dades
- [ ] He assignat revisor/a i he enllaçat l'issue al tauler
