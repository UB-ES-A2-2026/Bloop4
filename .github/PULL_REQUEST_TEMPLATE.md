## Descripción
<!-- Qué problema resuelve este PR y por qué. Una o dos frases. -->

Closes #<!-- nº de issue -->

## Qué se ha cambiado
<!-- Lista de cambios concretos: ficheros, endpoints, tablas, componentes. -->
-

## Tipo de cambio
- [ ] `feat` · Funcionalidad nueva
- [ ] `fix` · Corrección de un error
- [ ] `test` · Tests o configuración de testing
- [ ] `build` / `ci` · Docker, dependencias o pipelines
- [ ] `docs` · Documentación
- [ ] `chore` / `refactor` · Configuración o cambios internos sin cambio de comportamiento

## Cómo probarlo
<!-- Pasos exactos para que quien revisa compruebe el cambio. -->
1.
2.

**Resultado esperado:**

## Capturas (si cambia la interfaz)
<!-- Antes / después. Bórralo si no aplica. -->

## Checklist
- [ ] La rama sigue la convención `<tipo>/<nº-issue>-<descripcion>` y parte de `main` actualizado
- [ ] Los commits siguen Conventional Commits
- [ ] El PR solo incluye cambios de su issue
- [ ] `npm test` pasa en `api/` y en `bloop4-frontend/` (si se tocan)
- [ ] `docker compose up -d --build` levanta el stack sin errores (si se toca código o infraestructura)
- [ ] No se suben secretos, `.env`, `node_modules/` ni `dist/`
- [ ] Documentación actualizada si cambia el comportamiento, la API o el modelo de datos
- [ ] He asignado revisor/a y he enlazado el issue en el tablero
