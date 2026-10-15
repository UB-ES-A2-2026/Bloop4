# Cómo contribuir a Bloop4

## Flujo de trabajo (GitHub Flow)

1. Coge un issue de la columna **Sprint Backlog** del tablero, asígnatelo y muévelo a **In progress**.
2. Crea tu rama desde `main` actualizado: `git switch main && git pull && git switch -c <tipo>/<nº-issue>-<descripcion>`.
3. Haz commits pequeños con [Conventional Commits](https://www.conventionalcommits.org/es/v1.0.0/).
4. Antes de abrir el PR: `git fetch && git rebase origin/main` y comprueba que los tests pasan.
5. Abre el PR (la plantilla se carga sola), enlaza el issue con `Closes #N` y pide revisión a otra persona.
6. Con 1 aprobación y la CI en verde, merge con **Squash and merge** y borra la rama.

`main` está protegida: no se puede hacer push directo.

## Ramas

`<tipo>/<nº-issue>-<descripcion-corta>`, en minúsculas y con guiones. Ejemplo: `feat/6-catalogo-frontend`.

| Tipo | Para qué |
|---|---|
| `feat/` | Funcionalidad nueva |
| `fix/` | Corrección de un error |
| `test/` | Tests y configuración de testing |
| `ci/` | Workflows de GitHub Actions |
| `build/` | Docker, Compose, Nginx, dependencias |
| `docs/` | Documentación |
| `chore/` | Configuración del repositorio y procesos |
| `refactor/` | Cambios internos sin cambio de comportamiento |

## Commits

`tipo(ámbito): descripción en imperativo y minúsculas`

- Ámbitos: `api`, `db`, `frontend`, `docker`, `ci`, `repo`.
- Ejemplos: `feat(api): añade filtro por categoría a GET /api/products` · `fix(frontend): evita doble petición al cambiar de filtro`.

## Revisión de código

- Quien revisa comprueba: que hace lo que dice el issue, que hay tests, legibilidad y que no se suben secretos.
- Comentarios con prefijo: **bloqueante**, **sugerencia** o **pregunta**.
- Objetivo: primera revisión en menos de 24 h laborables.

## Definición de hecho (DoD)

- [ ] Cumple los criterios de aceptación del issue.
- [ ] Tests nuevos o actualizados; la CI pasa.
- [ ] Revisado y aprobado por al menos 1 persona.
- [ ] `docker compose up -d --build` funciona tras el merge.
- [ ] Documentación actualizada si cambia la API, el modelo de datos o la forma de arrancar.

## Tablero (GitHub Projects)

Columnas: **Product Backlog → Sprint Backlog → In progress → In review → Done**.

- El Product Owner prioriza el Product Backlog y escribe los criterios de aceptación.
- El Scrum Master actualiza el tablero cada semana y elimina bloqueos.
- Automatizaciones activadas en el proyecto (Workflows integrados): *Item added to project → Product Backlog*, *Item closed → Done*, *Pull request merged → Done*. Pasar a **In progress** e **In review** se hace a mano (quien abre la rama o el PR).

## Arrancar el proyecto

```bash
cp .env.example .env
docker compose up -d --build   # http://localhost:8080
```

Más detalle en el [README](README.md).
