---
description: Validación a fondo de lo construido (criterios con evidencia, casos borde, TDD, calidad, cobertura y reporte)
argument-hint: <alcance, por ejemplo "E1" o "E0 y lo hecho de E1">
---

# /validar $ARGUMENTS

Valida a fondo todo lo construido en el alcance **$ARGUMENTS**. No es una historia: **no cambies el tablero**.
`docs/` y `CLAUDE.md` mandan sobre cualquier skill o agente.

## Paso 1 · Criterios de aceptación con evidencia

Para cada historia del alcance, recorre cada criterio de aceptación de `docs/03-backlog.md` e indica la prueba
automatizada que lo demuestra (archivo y nombre). Si un criterio no tiene prueba, escríbela. Si una prueba
existente no verifica realmente el criterio (por ejemplo, solo revisa el código HTTP y no el efecto en la
base), refuérzala.

## Paso 2 · Casos borde, componente por componente

Para cada pieza, enumera los casos que pueden romperla y verifica cada uno con una prueba. Como mínimo:

- **Entradas:** vacías, null/undefined, solo espacios, longitudes en el límite exacto y uno más, Unicode y
  tildes, números en 0, negativos, decimales y fuera de rango, tipos equivocados (string por número, arreglo
  por objeto), campos extra, claves peligrosas (`__proto__`, `constructor`), cuerpos enormes y
  Content-Type equivocado.
- **Base de datos:** constraints probados con datos inválidos en el límite; triggers con UPDATE o INSERT de
  VARIAS filas a la vez (error típico: suponer una sola fila en `inserted`/`deleted`); NULL en columnas
  opcionales; fechas cerca de la medianoche UTC (`FechaLocal` de Guatemala).
- **Migrador:** carpetas vacías, BOM y CRLF, la palabra GO dentro de un comentario o de una cadena, un script
  que falla a la mitad, dos migradores a la vez, base que tarda en aceptar conexiones, variables de entorno
  faltantes o inválidas, numeración repetida o con huecos, dependencias `-- depende-de:` inexistentes o en
  ciclo.
- **ejecutarSP:** error de negocio con mensaje de texto y con JSON, JSON mal formado en el mensaje, error de
  SQL que no es de negocio, deadlock que se agota tras los reintentos, conexión perdida, parámetros null, y
  aislamiento del contexto entre peticiones concurrentes (AsyncLocalStorage).
- **HTTP:** rutas inexistentes, métodos no permitidos, health con la base caída, con Redis caído y con ambos.
- **Proceso:** errores no capturados y promesas rechazadas sin manejar (deben registrarse y cerrar
  ordenadamente), apagado con peticiones en curso, timeouts en las llamadas a la base y a Redis.
- **Infraestructura:** `docker compose down -v` y `up -d` desde cero; una réplica detenida; Redis con
  contraseña incorrecta.

## Paso 3 · Corregir con TDD

Por cada fallo encontrado: primero una prueba que lo reproduzca (debe fallar), después la corrección mínima y
finalmente la prueba en verde. Si una corrección requiere cambiar una decisión documentada (N-xx, A-xx,
M-xx), no la hagas: detente y explica el caso y las opciones.

## Paso 4 · Calidad

Verifica el código contra la subsección "SOLID y clean code" de `CLAUDE.md` y las skills `sqlserver-sp` y
`modulo-express`. Ejecuta `revisor-shopcart`, `typescript-reviewer` y los agentes `silent-failure-hunter` y
`pr-test-analyzer` de `pr-review-toolkit`. Corrige todo lo CRÍTICO y lo ALTO.

## Paso 5 · Cobertura

Genera el reporte de cobertura (`@vitest/coverage-v8`). No persigas un porcentaje: revisa las ramas sin
cubrir del código crítico (`ejecutarSP`, `manejar`, el manejo de errores, el migrador) y cúbrelas si
representan un caso real.

## Paso 6 · Verificación final

Con la salida real a la vista: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm test:integracion`, y
`docker compose down -v && docker compose up -d` seguido de los chequeos de health y de la alternancia de
`X-Instancia`.

## Paso 7 · Reporte

Entrega:

- Una tabla por componente: casos verificados · pruebas nuevas · fallos encontrados y corregidos.
- Los fallos reales encontrados, explicados en una línea cada uno (material para la defensa).
- Los riesgos que quedan abiertos y por qué no se corrigieron.

Commits separados y sin líneas de atribución: `test: casos borde de <componente>` para las pruebas nuevas y
`fix(<módulo>): <qué>` para cada corrección.
