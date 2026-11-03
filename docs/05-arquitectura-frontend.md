# ShopCart — Arquitectura del frontend

> Fase 2. Se basa en [`00-vision-y-contexto.md`](./00-vision-y-contexto.md), [`01-arquitectura.md`](./01-arquitectura.md) (A-xx) y el contrato real de la API de la Fase 1.
> Las decisiones `FE-xx` fueron **confirmadas por el PO el 3 nov**, cada una analizada con sus alternativas (sección 14).
> Cómo se aplican en el código: skill `modulo-react` (`.claude/skills/modulo-react/`).

---

## 1. Resumen

El frontend es una **SPA con React 19, TypeScript `strict` y Vite**, servida por el mismo nginx que balancea la API (A-03): **un solo origen**, así que las cookies `refresh` y `carrito_invitado` funcionan sin trucos de CORS. Su código se organiza **por los mismos módulos que el backend** y se construye módulo por módulo: cada uno trae su capa de datos, sus pantallas y su prueba E2E contra el backend real.

Tres principios atraviesan todas las decisiones:

1. **El backend es la autoridad.** El frontend no decide reglas de negocio, no calcula montos que se muestran y no asume que una operación funcionó antes de que el backend lo confirme. Si una pantalla necesita un dato que la API no envía, es un faltante del backend, no un cálculo del frontend.
2. **Cada estado tiene un solo dueño** (§6): lo del servidor en TanStack Query, lo navegable en la URL, lo que se escribe en el formulario, la sesión en su módulo.
3. **Una sola fuente para cada contrato:** los esquemas de entrada se comparten con la API (`packages/shared`) y los tipos de salida se generan del OpenAPI (`packages/contrato`).

---

## 2. Requisitos del enunciado y dónde se cumplen

| Requisito (enunciado §05 Frontend y RNF) | Dónde |
|---|---|
| Rutas protegidas y menús según el rol | §4 (FE-04) |
| Formularios con validación y mensajes de error claros | §7 (FE-03) |
| Tablas con paginación, ordenamiento y filtros del lado del servidor | §8 (FE-06) |
| Gráficas en el dashboard | §10 (FE-07) |
| Estados visibles de carga, vacío y error en todas las vistas | §8, §10 y `EstadoVista` (§3) |
| Renovación transparente del token con el refresh token | §5 (FE-05) |
| Interfaz responsive | §8, §11 (FE-01) |
| Sin lógica de negocio en componentes visuales (RNF Mantenibilidad) | §3 (FE-09) |
| Criterio de evaluación: usabilidad, manejo de estado, control por rol, estados, componentes reutilizables, estándar de código | Todo el documento; la skill `modulo-react` lo concreta |

---

## 3. Estructura del código (FE-09)

```
apps/web/
  src/
    app/                     # router con roles (FE-04), proveedores, layouts por área
    shared/
      api/                   # cliente `api` (openapi-fetch), ErrorApi, módulo de sesión (FE-05, FE-13)
      ui/                    # primitivas de shadcn/ui (código propio de bajo nivel)
      componentes/           # TablaServidor, EstadoVista, CampoFormulario, Paginacion, Monto, Fecha…
      hooks/                 # useParametrosUrl, useFormularioApi, useSesion
      formato/               # formatearMonto, formatearFechaHora, formatearFechaCalendario (FE-10)
    modules/<modulo>/        # los mismos nombres que apps/api/src/modules (sin `sistema`)
      <modulo>.api.ts        # funciones que llaman al cliente `api`; sin React
      <modulo>.keys.ts       # fábrica de llaves de TanStack Query (FE-02)
      hooks/                 # useQuery / useMutation del módulo
      componentes/           # piezas visuales del módulo
      paginas/               # pantallas: solo componen componentes y hooks
      index.ts               # API pública del módulo
  e2e/<modulo>.spec.ts       # Playwright contra el backend real (FE-12)
packages/
  shared/                    # esquemas Zod de entrada compartidos con la API (FE-03)
  contrato/                  # openapi.json versionado y tipos generados (FE-13)
```

**Por qué por módulo del backend y no por área de la interfaz:** la capa de datos de un dominio es una sola. Un cambio de precio en el backoffice invalida las mismas llaves que usa la tienda; con carpetas por área habría dos `catalogo` con llaves que mantener sincronizadas. Las áreas (tienda, cuenta, backoffice) existen, pero en el router (§4).

**Reglas, verificadas con lint (mismo mecanismo que A-01):**
- **Dependencias en una dirección:** `paginas → componentes → hooks → <modulo>.api.ts → shared/api`. Un componente nunca importa el cliente `api`.
- **Entre módulos, solo por `index.ts`.** Excepción explícita: `app/` importa las `paginas` directamente con `lazy()`. Si las importara por `index.ts`, todo el módulo entraría en el mismo paquete y se rompería la carga diferida.
- **Sin lógica de negocio en componentes.** Lo poco que se deriva en el frontend (por ejemplo, si un aviso de garantía sigue vigente) va en funciones puras con su prueba, usadas desde los hooks.
- **Las primitivas de `shared/ui` se extienden componiendo** en `shared/componentes`, no editándolas para un caso particular.

**Nombres** (misma regla del backend: dominio en español, términos del framework como son): componentes `PascalCase.tsx` (`TarjetaProducto.tsx`), hooks con el prefijo `use` (`useCarrito.ts`), datos `<modulo>.<capa>.ts`, pruebas junto a lo que prueban (`*.test.ts(x)`).

---

## 4. Rutas, áreas y control por rol (FE-04)

**React Router 7 en modo *data*** (`createBrowserRouter`).

- **Una sola definición de rutas con sus roles**, de la que salen el guardián y los menús. Es imposible que el menú muestre un enlace que el guardián bloquea, o al revés.
- **Tres áreas con carga diferida y su propio `errorElement`:**

| Área | Quién | Contenido |
|---|---|---|
| Tienda | Público, invitado y Cliente | Catálogo, detalle, carrito, checkout, mis pedidos |
| Cuenta | Cualquier usuario con sesión | Perfil, contraseña, direcciones (Cliente) |
| Backoffice | Operador y Admin (los menús cambian por rol) | Catálogo, precios, inventario, pedidos, devoluciones, revisión de pagos, cupones, envíos, configuración, usuarios, bitácora, dashboard, exportaciones |

  Un Cliente nunca descarga el código del backoffice, y si una pantalla falla solo cae su área.
- **El guardián es experiencia de usuario; la autoridad es el backend (RF-01).**
  - Sin sesión → login, y al entrar regresa a la URL que pedía.
  - Con sesión pero sin el rol → página "Sin permiso" (el equivalente de un 403), no una redirección silenciosa.
  - Mientras se rehidrata la sesión (§5) → estado de carga, para que un usuario con sesión no vea el login por un instante.
- **Los `loader` no cargan datos.** TanStack Query es la única dueña del estado del servidor (§6); dos mecanismos serían dos cachés.
- **Parámetros de búsqueda tipados con `useParametrosUrl(esquemaZod)`:** valida la URL con un esquema Zod y escribe los cambios de vuelta. Es lo que TanStack Router ofrecía de forma nativa, en un hook propio y explicable.

---

## 5. Sesión y renovación del token (FE-05)

Contrato del backend (A-07, `01-arquitectura.md` §5.3): access JWT de 15 minutos; refresh opaco en cookie `httpOnly`, `SameSite=Strict`, `Path=/api/v1/auth`; **reusar un refresh ya rotado revoca toda la familia** (`401 REFRESH_REUTILIZADO`), sin ventana de gracia.

**El riesgo que obliga al diseño:** tres situaciones normales envían el mismo refresh dos veces y cerrarían la sesión sin que el usuario haga nada: varias peticiones en paralelo que reciben 401, **dos pestañas** que renuevan casi al mismo tiempo, y `StrictMode`, que en desarrollo ejecuta dos veces los efectos.

**Diseño:**
- **El access token vive en una variable del módulo `shared/api/sesion`**, nunca en `localStorage` ni `sessionStorage` (A-07). React lo observa con `useSyncExternalStore` (§6); no es su dueño.
- **Single-flight por pestaña:** una sola promesa de renovación a la vez; las peticiones que reciben 401 esperan esa misma promesa y se reintentan **una sola vez**.
- **Entre pestañas:** la renovación ocurre dentro de `navigator.locks.request('shopcart-refresh', …)`. La pestaña que la hace publica el resultado por `BroadcastChannel('shopcart-sesion')`. La que esperaba el lock ve que ya hay un token nuevo y no renueva. El mismo canal propaga el cierre de sesión a todas las pestañas.
- **Rehidratación al cargar:** un `POST /auth/refresh` **antes de montar React** (en `main.tsx`), así `StrictMode` no lo duplica. La respuesta trae el usuario y su rol; no se decodifica el JWT.
- **Renovación reactiva**, al recibir un 401, no por temporizador. El stream SSE (§10) se cierra cuando vence el token y al reconectar pasa por el mismo camino.
- **Qué hace cada 401:** en cualquier ruta fuera de `/auth` → renovar y reintentar. Si el refresh falla (`REFRESH_REUTILIZADO`, `USUARIO_INACTIVO` o sin cookie) → se cierra la sesión local: en una ruta protegida va al login con la URL de regreso; en la tienda sigue como invitado.
- **Al iniciar o cerrar sesión, `queryClient.clear()`:** el siguiente usuario de ese navegador no ve datos en caché del anterior. Al iniciar sesión se recarga el carrito y se muestran los `avisosCarrito` de la fusión (N-05).
- **Desarrollo:** el proxy de Vite apunta `/api` a `http://localhost:8080`, así la SPA y la API comparten origen igual que con nginx y las cookies se comportan igual.

**Residual aceptado:** si la respuesta de un refresh se pierde en la red después de que el servidor rotó el token, el navegador conserva la cookie vieja y el siguiente refresh es un reúso: se cierra la sesión. Es raro y queda del lado seguro.

---

## 6. Estado (FE-02, FE-08)

**Dónde vive cada estado:**

| Tipo de estado | Dueño | Ejemplos |
|---|---|---|
| Lo que viene del backend | **TanStack Query** | Carrito, pedidos, catálogo, reportes, sesión de checkout |
| Lo que se puede compartir o navegar | **La URL** | Filtros, página, orden, paso del checkout |
| Lo que se está escribiendo | **React Hook Form** | Formularios |
| Lo visual de un componente | `useState` local | Un diálogo abierto, una pestaña |
| Lo transversal que se usa fuera de React | Módulo externo + `useSyncExternalStore` | Solo la sesión (`useSesion()`) |

- **El carrito y el checkout no son estado del cliente.** Viven en el backend (N-01, N-02, N-05) y aquí solo se consultan. Cada paso del checkout es una ruta (`/checkout/direccion`, `/checkout/envio`, `/checkout/pago`); al recargar, `GET /checkout/sesion` dice dónde iba el usuario.
- **Sin librería de estado global.** Zustand haría lo mismo que `useSyncExternalStore` para un solo valor (KISS).
- **Tema y avisos:** el `ThemeProvider` de shadcn para Vite (la preferencia visual se guarda en `localStorage`) y `sonner` para notificaciones.

**Reglas de TanStack Query:**
1. **Una fábrica de llaves por módulo** (`carritoKeys.todo()`, `pedidosKeys.detalle(id)`). Nunca se escribe una llave a mano; la invalidación es uniforme.
2. **Sin actualizaciones optimistas** en nada que tenga reglas de negocio (carrito, cupones, checkout, estados de pedido, inventario). El SP es la autoridad (A-02): se espera la respuesta y se muestra el estado de carga.
3. **Sin reintentos automáticos en 4xx**, que son errores de negocio; solo en errores de red y 5xx. **Las mutaciones nunca se reintentan solas**: el pago tiene su propia idempotencia (RF-06) y el resto no la necesita repetida.

---

## 7. Formularios y errores (FE-03)

- **React Hook Form + `zodResolver`**, con el componente `Form` de shadcn.
- **Los esquemas de entrada se comparten con la API.** En la historia de datos de cada módulo, los esquemas de cuerpo y *query* que usan sus formularios y tablas se mueven de `apps/api/src/modules/<modulo>/<modulo>.schemas.ts` a `packages/shared`. La API los registra en OpenAPI con `registroOpenApi.register()` en lugar de `.openapi()`, para que `shared` no dependa de `zod-to-openapi`. **Criterio de aceptación de cada mudanza:** `packages/contrato/openapi.json` queda idéntico (FE-13). Solo se mueven esquemas de entrada; los tipos de salida salen de FE-13.
- **`useFormularioApi`** une el formulario con su mutación y traduce cada error del backend (`ErrorApi`, §9) a un solo comportamiento:

| Respuesta | Qué se muestra |
|---|---|
| `400` de validación | Cada `detalles[].campo` (`body.nombreRecibe` → `nombreRecibe`) en su campo, con `setError` |
| `409` o `422` | El `mensaje` del backend en un aviso arriba del formulario: esos mensajes ya son específicos (por ejemplo, el faltante de un cupón) |
| `401` | Lo maneja el cliente `api` (§5); el formulario no lo ve |
| `5xx` o red | Aviso genérico con el `requestId` y la opción de reintentar |

---

## 8. Tablas del servidor (FE-06)

Convención de la API (`01-arquitectura.md` §5.1): `?pagina=1&tamano=20&orden=fecha&direccion=desc`, `tamano` máximo 100, `orden` contra una lista blanca, respuesta `{ datos, paginacion: { pagina, tamano, total, totalPaginas } }`.

**Componente propio `TablaServidor<T>`, sin TanStack Table:** con todo del lado del servidor, una librería de tablas solo guardaría un estado que aquí vive en la URL. La tabla recibe definiciones de columnas tipadas y el resultado de la consulta.

- **El estado vive en la URL** (`useParametrosUrl`), validado con **el mismo esquema de *query* del backend** movido a `shared`: la tabla solo ofrece ordenar por las columnas que acepta la lista blanca, y el tipado lo garantiza.
- Cambiar un filtro regresa a la página 1; el texto libre espera 300 ms; una página fuera de rango salta a la última que existe.
- **Estados:** carga inicial con filas esqueleto; cambio de página u orden conservando los datos anteriores (`placeholderData: keepPreviousData`) con un indicador discreto; vacío que distingue "todavía no hay registros" de "ningún resultado con estos filtros" (con botón para limpiarlos); error con el mensaje, reintentar y el `requestId`.
- **Responsive:** tabla en pantallas anchas; bajo el punto `md`, cada fila se muestra como tarjeta con las mismas definiciones de columnas, que declaran su `prioridad`.
- Encabezados con `aria-sort` y controles con etiqueta accesible.
- La paginación y `useParametrosUrl` son piezas aparte: el catálogo de la tienda (una cuadrícula) usa las mismas.

---

## 9. Contrato y cliente HTTP (FE-13)

- **Foto del contrato versionada:** `pnpm openapi:exportar` llama a `generarDocumentoOpenApi()` sin levantar la API ni la base y escribe `packages/contrato/openapi.json`. `openapi-typescript` genera de ahí los tipos que usa la web. Las dos cosas se versionan. **`pnpm openapi:verificar`, dentro de `pnpm lint`, falla si la foto no coincide con lo que genera el código.** Todo cambio de contrato queda visible como diff en el commit.
- **Un solo cliente `api`** (`openapi-fetch`) en `shared/api`, con dos *middlewares*: agregar `Authorization` con el token de la sesión, y ante un 401 fuera de `/auth`, esperar la renovación (§5) y reintentar **una vez** con una copia de la petición guardada antes de enviarla (el cuerpo de una petición solo se lee una vez).
- **`ErrorApi`:** toda respuesta de error se convierte en una clase tipada con `codigo`, `mensaje`, `detalles`, `requestId` y `status`, con el formato de A-06. Es lo único que conocen `useFormularioApi` y `EstadoVista`.
- **Matriz de cobertura automática:** cada llamada escribe su ruta como texto tipado (`api.GET('/api/v1/pedidos/{id}')`). `pnpm contrato:cobertura` cruza las rutas de la foto con las usadas en los `*.api.ts` y con una lista corta de exclusiones justificadas (`/health`, Swagger). Al cerrar cada módulo, sus rutas quedan cubiertas; al cerrar F6, **cero rutas sin consumir ni justificar**.

---

## 10. Montos y fechas (FE-10)

**Montos** (llegan como texto: `"149.90"`, o `"-12.00"` en ventas netas, A-21):
- **El frontend nunca calcula un monto que se muestra.**
- `formatearMonto()` usa `Intl.NumberFormat('es-GT', { style: 'currency', currency: 'GTQ' })`, que acepta el texto y lo trata como decimal exacto: el monto nunca pasa por `number`.
- Los campos de monto son `type="text"` con `inputMode="decimal"`, validados con `montoSchema` de `shared`, y viajan como texto. Nunca `type="number"` (cambia con la rueda del ratón, acepta `1e5`, depende del idioma del navegador).
- **Única excepción:** la geometría de las gráficas (§11), que convierte a número para dibujar y nunca muestra ese número.

**Fechas** (UTC en la base; reportes agrupados por día de Guatemala, A-12):
- **Toda fecha con hora se muestra en `America/Guatemala`, fija**, no en la zona del navegador: la hora de un pedido y "ventas de hoy" coinciden con la base desde cualquier computadora.
- **Las fechas sin hora (`"2026-11-03"`) nunca pasan por `new Date()`:** sería la medianoche UTC, que en Guatemala es el día anterior. `formatearFechaCalendario()` las formatea sin convertirlas a instante, y los filtros de rango envían `AAAA-MM-DD` tal cual.
- Las funciones de formato se prueban con el reloj fijado en horas límite (por ejemplo, 23:00 en Guatemala).

---

## 11. Dashboard: gráficas y tiempo real (FE-07, FE-11)

**Gráficas:** Recharts, a través del componente `Chart` de shadcn (colores del tema, tooltips, modo oscuro).

| Reporte | Forma | Por qué |
|---|---|---|
| Resumen | Tarjetas de KPI | Cifras sueltas |
| Ventas por día, semana o mes | Columnas, con selector entre quetzales y número de pedidos | Totales por periodo. **Sin doble eje:** escalas distintas sugieren relaciones que no existen |
| Ventas por categoría | Barras horizontales de mayor a menor | Comparar largos es más preciso que ángulos |
| Top 10 productos | Barras horizontales ordenadas | Nombres largos legibles |
| Carritos abandonados | `TablaServidor` | Listado paginado para actuar |

- **Negativos:** las ventas netas pueden ser negativas (N-11). El eje siempre incluye el cero y la barra negativa lleva su propio tono y la etiqueta "neto con devoluciones".
- **Cada gráfica tiene "ver como tabla"** con los mismos datos, y sus propios estados de carga, vacío y error: una que falla no tumba el resto.
- La información nunca depende solo del color.

**Tiempo real** (contrato A-25: `GET /admin/reportes/eventos`, token en `Authorization`, por eso `fetch` con streaming y no `EventSource`):
- `eventsource-parser` parsea el protocolo; el bucle de conexión es propio para integrarse con la sesión (§5).
- **Un aviso invalida solo su dominio** (`ventas` → resumen, ventas, categorías y top 10; `carritos` → abandonados y el conteo del resumen), con el mapa en `reportes.keys.ts`. Se conservan los datos anteriores mientras llegan los nuevos. Una versión menor o igual a la conocida se ignora; `recargar: true` invalida todo `reportes`.
- **El cierre por token vencido es normal:** se reconecta por el camino de §5. Un 401 al conectar renueva una vez; si la renovación falla, se cierra la sesión.
- Reconexión con espera creciente y aleatoria (1 s a 30 s), que vuelve a 1 s tras una conexión exitosa; siempre con `Last-Event-ID`.
- **Vigilante del latido:** más de 35 s sin recibir nada (dos latidos de 15 s más margen) → la conexión se da por muerta y se reabre.
- **Pausa con la pestaña oculta** (`visibilitychange`); al volver, reconecta con `Last-Event-ID`.
- **`429 CONEXIONES_MAXIMAS`:** "Tiempo real en pausa" y reintento con espera larga; el dashboard sigue funcionando con consultas normales.
- **Indicador visible:** "En vivo", "Reconectando…" o "En pausa".

---

## 12. Interfaz (FE-01)

- **Tailwind CSS + shadcn/ui.** Los componentes de shadcn se copian al repositorio (`shared/ui`), son accesibles (Radix) y se pueden explicar y modificar en vivo en la defensa.
- **Componentes reutilizables propios** en `shared/componentes`, que son la evidencia del criterio "componentes reutilizables": `TablaServidor`, `EstadoVista` (carga, vacío, error), `CampoFormulario`, `Paginacion`, `Monto`, `FechaHora`, `IndicadorTiempoReal`, entre otros.
- Diseño *mobile first*; todas las vistas se revisan en anchos de teléfono y de escritorio.

---

## 13. Pruebas y cierre de cada módulo (FE-12)

| Nivel | Herramientas | Qué prueba | Contra qué |
|---|---|---|---|
| Unitarias | Vitest | Funciones puras: formato de montos y fechas, `useParametrosUrl`, mapeo de errores, single-flight y lock de la sesión, bucle del SSE con un stream simulado | Nada externo |
| Componentes y hooks | Vitest + Testing Library + MSW (jsdom) | Estados de carga, vacío y error de cada pantalla; formularios con errores 400/409/422; guardián y menús por rol | API simulada con MSW, tipada con el contrato (§9) |
| E2E por módulo | Playwright | El flujo principal del módulo en un navegador real | **El backend real** (`docker compose`, a través de nginx) |

- **Cada criterio de aceptación tiene su prueba (TDD).** No hay meta de porcentaje de cobertura; no hay pruebas de *snapshot*.
- **Los datos de cada E2E se preparan por la API pública** (fixture con el token de Admin y nombres únicos por corrida), igual que las pruebas de concurrencia de la Fase 1. Ninguna prueba depende de la semilla demo ni de otra prueba.
- **E2E de decisiones que se defienden:** dos pestañas renovando a la vez no cierran la sesión (§5); doble clic en "Pagar" produce un pedido y un cobro (RF-06); un Cliente que entra por URL al backoffice ve "Sin permiso" y uno que cambia el ID de un pedido ajeno ve "No encontrado" (RF-01); con `api-1` detenida la compra y el dashboard en vivo siguen funcionando (F6).
- **Comandos:** `pnpm --filter @shopcart/web test` (unitarias y componentes) y `pnpm test:e2e` (requiere el entorno levantado).

**Un módulo está cerrado cuando:** sus historias cumplen sus criterios, su E2E pasa contra el backend real y `pnpm contrato:cobertura` muestra sus rutas cubiertas o justificadas.

---

## 14. Decisiones del frontend

Estado: 🟡 Propuesta · 🔍 En análisis · ✅ Confirmada · ✏️ Modificada

| ID | Decisión | Alternativas descartadas y por qué | Estado |
|---|---|---|---|
| FE-01 | Tailwind CSS + shadcn/ui; componentes reutilizables propios en `shared/componentes` (§12) | MUI: aspecto genérico salvo mucho trabajo de tema, CSS-in-JS pesado, se defiende la configuración y no el código. Mantine: su manejo de formularios choca con FE-03. Ant Design: estética de backoffice poco natural para la tienda | ✅ |
| FE-02 | TanStack Query como dueño del estado del servidor; fábrica de llaves por módulo, sin optimismo en nada con reglas de negocio, sin reintentos en 4xx ni en mutaciones (§6) | RTK Query: obliga a Redux. SWR: mutaciones débiles. `fetch` + `useEffect`: carreras y estados repetidos en cada vista | ✅ |
| FE-03 | React Hook Form + `zodResolver`; esquemas de entrada movidos a `packages/shared` módulo por módulo, con el OpenAPI idéntico como criterio; `useFormularioApi` para los errores del backend (§7) | TanStack Form: joven. Acciones de React 19: pensadas para Server Actions. Esquemas propios del frontend: reglas duplicadas que se desalinean. Generarlos del OpenAPI: se pierden los `refine` y los mensajes | ✅ |
| FE-04 | React Router 7 en modo *data*; una definición de rutas con roles para el guardián y los menús; página "Sin permiso"; tres áreas con carga diferida y `errorElement`; `loader` sin datos; `useParametrosUrl` (§4) | TanStack Router: su ventaja (búsqueda tipada) se cubre con un hook propio; más magia que explicar | ✅ |
| FE-05 | Token en memoria; single-flight por pestaña; Web Locks + BroadcastChannel entre pestañas; rehidratación antes de montar React; renovación reactiva; `queryClient.clear()` al cambiar de sesión; proxy de Vite (§5) | Ventana de gracia en el backend: debilita una regla de seguridad ya probada. Aceptar el riesgo: sesiones que se cierran solas, visible en la demo | ✅ |
| FE-06 | `TablaServidor<T>` propio sin TanStack Table; estado en la URL con el esquema de *query* del backend; estados completos; tarjetas en móvil (§8) | TanStack Table: en modo manual solo duplica un estado que vive en la URL | ✅ |
| FE-07 | Recharts mediante el `Chart` de shadcn; forma por reporte, sin doble eje; negativos visibles; "ver como tabla"; estados por gráfica (§11) | Chart.js: imperativo y sin integración con el tema. ECharts: pesado y configuración opaca | ✅ |
| FE-08 | Sin librería de estado global; la sesión con `useSyncExternalStore`; regla de dueño por tipo de estado (§6) | Zustand: dependencia para un solo valor. Context: no se lee fuera de React y re-renderiza todo el árbol | ✅ |
| FE-09 | Código por módulo del backend; dependencias `paginas → componentes → hooks → api` con lint; excepción del router para la carga diferida (§3) | Por área de la interfaz: duplica la capa de datos de cada dominio | ✅ |
| FE-10 | Montos como texto formateados con `Intl` sin pasar por `number`; ningún cálculo de montos; fechas con hora en `America/Guatemala`; fechas sin hora sin `new Date()` (§10) | Convertir a `number` o calcular en el navegador: errores de redondeo y cifras que no coinciden con el SP | ✅ |
| FE-11 | Tiempo real con `fetch` + `eventsource-parser` y bucle propio; invalidación por dominio; vigilante del latido; pausa con la pestaña oculta; indicador visible (§11) | `EventSource`: no envía `Authorization` (A-25). Parser propio: errores sutiles del protocolo. `@microsoft/fetch-event-source`: sin mantenimiento y con reintentos que pelean con FE-05 | ✅ |
| FE-12 | Vitest, Testing Library + MSW y Playwright; cada módulo se cierra con su E2E contra el backend real; datos por la API pública (§13) | Solo pruebas con MSW: los errores de contrato llegan tarde. Meta de cobertura en páginas: pruebas que no prueban. *Snapshots*: frágiles y mudos | ✅ |
| FE-13 | Foto `openapi.json` versionada y verificada en `lint`; tipos con `openapi-typescript`; cliente `openapi-fetch` con *middlewares* de token y renovación; `ErrorApi`; matriz de cobertura automática (§9) | Mover también las respuestas a `shared`: el doble de mudanza sin ganancia. Orval: hooks generados que se saltan FE-02. Tipos a mano: 96 contratos que se desalinean | ✅ |
| FE-14 | Librerías del frontend aprobadas (§15) | Cualquier otra se pide y se justifica antes de instalarla, igual que A-16 | ✅ |

---

## 15. Librerías del frontend (FE-14)

Versión estable al instalar; la exacta queda en `pnpm-lock.yaml` y cada una se justifica en una línea en el README.

| Para | Librerías |
|---|---|
| Base | `react`, `react-dom` (19), `vite`, `@vitejs/plugin-react`, TypeScript `strict` |
| Rutas | `react-router` (7) |
| Estado del servidor | `@tanstack/react-query` (y sus devtools solo en desarrollo) |
| Formularios | `react-hook-form`, `@hookform/resolvers`, `zod` (la misma versión que `shared`) |
| Interfaz | `tailwindcss`, las dependencias que instala shadcn/ui (`radix-ui`, `class-variance-authority`, `clsx`, `tailwind-merge`, `lucide-react`, `tw-animate-css`), `sonner` |
| Gráficas | `recharts` |
| Contrato | `openapi-fetch`; `openapi-typescript` (solo desarrollo) |
| Tiempo real | `eventsource-parser` |
| Pruebas (solo desarrollo) | `vitest`, `jsdom`, `@testing-library/react`, `@testing-library/user-event`, `@testing-library/jest-dom`, `msw`, `@playwright/test` |

---

## 16. Construcción por módulos

Orden de construcción (las historias están en `03-backlog.md` §6):

| # | Módulo | Rutas que conecta |
|---|---|---|
| F1 | Base: shell, cliente `api`, sesión, rutas por rol, componentes base, contrato y matriz | `auth` (sesión y refresh) |
| 1 | Cuenta | `auth`, `usuarios` (perfil y contraseña) |
| 2 | Catálogo de la tienda | `catalogo` (público) |
| 3 | Carrito | `carrito`, `cupones` (aplicar), `envios` (métodos) |
| 4 | Checkout y pago | `direcciones`, `checkout` |
| 5 | Mis pedidos | `pedidos` (Cliente) |
| 6 | Backoffice de catálogo | `catalogo` (Admin) |
| 7 | Inventario | `inventario` |
| 8 | Gestión de pedidos | `pedidos` (gestión, devoluciones, reembolsos, pagos en revisión) |
| 9 | Cupones, envíos y configuración | `cupones`, `envios`, `configuracion` (Admin) |
| 10 | Usuarios y bitácora | `usuarios` (Admin), `bitacora` |
| 11 | Dashboard | `reportes`, `exportaciones` |
| F6 | Cierre | README final, ensayo de la demo, matriz completa |

Desde el módulo 5 se puede demostrar una compra completa de punta a punta.
