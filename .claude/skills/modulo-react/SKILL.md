---
name: modulo-react
description: Cómo construir y probar un módulo del frontend de ShopCart (React 19 + Vite + TypeScript strict) de punta a punta — estructura por módulo del backend, cliente api tipado con el contrato, sesión, llaves y hooks de TanStack Query, páginas con estados de carga, vacío y error, formularios con los esquemas compartidos, TablaServidor, rutas por rol, montos y fechas, tiempo real y pruebas con Vitest, MSW y Playwright. Úsala siempre que crees o modifiques código en apps/web/, packages/shared o packages/contrato.
---

# Módulos del frontend de ShopCart

Esta skill concreta `docs/05-arquitectura-frontend.md` (FE-01 a FE-14). Si algo aquí contradice los documentos, **mandan los documentos** y debes avisar a Diego. Para mover esquemas de la API a `packages/shared`, usa también la skill `modulo-express`.

**Tres principios que deciden los casos que esta skill no cubre:**
1. **El backend es la autoridad.** El frontend no decide reglas, no calcula montos que se muestran y no asume que algo funcionó antes de la respuesta. Si una pantalla necesita un dato que la API no envía, **detente y pregunta**: es un faltante del backend.
2. **Cada estado tiene un solo dueño** (§4).
3. **Una sola fuente por contrato:** entradas en `packages/shared`, salidas generadas en `packages/contrato`.

## 1. Estructura de un módulo (FE-09)

```
apps/web/src/modules/pedidos/
  pedidos.api.ts          # funciones que llaman al cliente `api`; sin React
  pedidos.keys.ts         # fábrica de llaves de TanStack Query
  hooks/
    usePedidos.ts         # useQuery del listado
    useCancelarPedido.ts  # useMutation con su invalidación
  componentes/
    TarjetaPedido.tsx
    HistorialEstados.tsx
  paginas/
    MisPedidosPagina.tsx  # solo compone componentes y hooks
    DetallePedidoPagina.tsx
  index.ts                # API pública: lo único que otros módulos importan
```

- Los nombres de módulo son **los mismos que `apps/api/src/modules`** (sin `sistema`).
- **Dependencias:** `paginas → componentes → hooks → <modulo>.api.ts → shared/api`. Un componente nunca importa `api`, un hook nunca importa un componente. El lint lo verifica.
- **Entre módulos solo por `index.ts`.** La única excepción es `app/`, que importa las `paginas` con `lazy()` para la carga diferida.
- **Nombres:** dominio en español, términos del framework como son. Componentes `PascalCase.tsx` con un componente exportado por archivo; hooks `useAlgo.ts`; datos `<modulo>.<capa>.ts`; pruebas junto a lo que prueban (`*.test.ts(x)`); E2E en `apps/web/e2e/<modulo>.spec.ts`.
- **Lo compartido vive en `shared/`:** `api/` (cliente, `ErrorApi`, sesión), `ui/` (primitivas de shadcn), `componentes/` (`TablaServidor`, `EstadoVista`, `CampoFormulario`, `Paginacion`, `Monto`, `FechaHora`…), `hooks/` (`useParametrosUrl`, `useFormularioApi`, `useSesion`) y `formato/`. **Antes de crear un componente, busca en `shared/componentes`**; si algo se repite en dos módulos, va a `shared/`.

## 2. Contrato y capa de datos (FE-13)

```ts
// pedidos.api.ts — firma de referencia
import { api, type Cuerpo, type Respuesta } from '../../shared/api';
import type { ConsultaPedidos } from '@shopcart/shared';

export type Pedido = Respuesta<'/api/v1/pedidos/{id}', 'get'>['datos'];

export async function listarPedidos(consulta: ConsultaPedidos) {
  const { data } = await api.GET('/api/v1/pedidos', { params: { query: consulta } });
  return data; // el middleware ya convirtió cualquier error en ErrorApi
}

export async function cancelarPedido(id: number, cuerpo: Cuerpo<'/api/v1/pedidos/{id}/cancelar', 'post'>) {
  const { data } = await api.POST('/api/v1/pedidos/{id}/cancelar', {
    params: { path: { id } },
    body: cuerpo,
  });
  return data;
}
```

- **Toda llamada pasa por el cliente `api`** con la ruta escrita como texto literal: así la tipan los tipos generados y `pnpm contrato:cobertura` la encuentra. Nunca `fetch` directo (salvo el stream de §9, que vive en `reportes`).
- **Los tipos de salida salen de `packages/contrato`**, nunca se escriben a mano. Los de entrada salen de `packages/shared` (`z.infer`).
- **Si el backend cambia el contrato:** `pnpm openapi:exportar` regenera `packages/contrato/openapi.json` y sus tipos. El diff de `openapi.json` va en el mismo commit. `pnpm lint` falla si la foto no coincide con el código.
- **Mover un esquema de entrada a `shared`** (en la historia de datos de cada módulo): solo esquemas de cuerpo y *query*; la API los registra con `registroOpenApi.register()` en lugar de `.openapi()`, y **`openapi.json` debe quedar idéntico**. Si cambia, algo se alteró: corrígelo antes de seguir.

## 3. Llaves y hooks (FE-02)

```ts
// pedidos.keys.ts
export const pedidosKeys = {
  todo: ['pedidos'] as const,
  listas: () => [...pedidosKeys.todo, 'lista'] as const,
  lista: (consulta: ConsultaPedidos) => [...pedidosKeys.listas(), consulta] as const,
  detalle: (id: number) => [...pedidosKeys.todo, 'detalle', id] as const,
};

// hooks/usePedidos.ts
export function usePedidos(consulta: ConsultaPedidos) {
  return useQuery({
    queryKey: pedidosKeys.lista(consulta),
    queryFn: () => listarPedidos(consulta),
    placeholderData: keepPreviousData,
  });
}

// hooks/useCancelarPedido.ts
export function useCancelarPedido(id: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (cuerpo: CancelarPedido) => cancelarPedido(id, cuerpo),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: pedidosKeys.todo }),
  });
}
```

- **Nunca escribas una llave a mano** fuera de `<modulo>.keys.ts`.
- **Sin actualizaciones optimistas** en nada con reglas de negocio (carrito, cupones, checkout, pedidos, inventario, precios). Espera la respuesta y muestra el estado de carga: el SP es la autoridad (A-02).
- **Reintentos:** la configuración global del `QueryClient` no reintenta en 4xx (`ErrorApi` con `status < 500`) y nunca reintenta mutaciones. No la cambies en un hook.
- **Invalida lo que la operación cambia, ni más ni menos.** Si una mutación afecta a otro módulo (agregar al carrito cambia los métodos de envío), usa las llaves que ese módulo exporta en su `index.ts`.
- `onSuccess` invalida y, si corresponde, avisa con `toast` de `sonner`. La navegación posterior la decide la página, no el hook.

## 4. Dónde vive cada estado (FE-08)

| Tipo de estado | Dueño |
|---|---|
| Lo que viene del backend | TanStack Query |
| Lo que se puede compartir o navegar (filtros, página, orden, paso del checkout) | La URL, con `useParametrosUrl` |
| Lo que se está escribiendo | React Hook Form |
| Lo visual de un componente | `useState` local |
| La sesión | `shared/api/sesion` + `useSesion()` |

- **No copies datos del servidor en `useState`** ni en un contexto. Si necesitas un dato derivado, calcúlalo al renderizar o con `select` en la consulta.
- **El carrito y la sesión de checkout son del backend.** Nada de guardarlos en el navegador.
- **No agregues librerías de estado global ni contextos nuevos** sin preguntar.

## 5. Páginas y estados (enunciado: carga, vacío y error en todas las vistas)

```tsx
export function MisPedidosPagina() {
  const parametros = useParametrosUrl(consultaPedidosSchema);
  const pedidos = usePedidos(parametros.valores);

  return (
    <EstadoVista
      consulta={pedidos}
      vacio={{ titulo: 'Todavía no tienes pedidos', accion: <EnlaceCatalogo /> }}
    >
      {(datos) => (
        <>
          <ListaPedidos pedidos={datos.datos} />
          <Paginacion
            paginacion={datos.paginacion}
            onPagina={(pagina) => parametros.cambiar({ pagina })}
          />
        </>
      )}
    </EstadoVista>
  );
}
```

- **`useParametrosUrl(esquema)` devuelve un objeto:** `valores` (la URL validada; un campo inválido cae a su valor por defecto), `cambiar(cambios, { historial })`, `hayFiltros` y `limpiarFiltros()`. Todo cambio que no sea de `pagina` vuelve a la página 1. En la URL solo queda lo que difiere del valor por defecto.
- **Historial:** ordenar, paginar y los filtros de selección **agregan** una entrada (`historial: 'agregar'`, el valor por defecto); el texto libre usa `historial: 'texto'` (lo hace `FiltroTexto`): la primera edición agrega una entrada y las siguientes la reemplazan, así «atrás» vuelve a la vista anterior a la búsqueda. Las correcciones (página fuera de rango) usan `'reemplazar'`.
- **`EstadoVista`** recibe `consulta`, `vacio` (`{ titulo, descripcion?, accion? }`), `esVacio?` (por defecto, `datos` vacío), `esqueleto?` y `children(datos)`. Si una consulta que ya tenía datos falla al recargar, los datos se quedan con el aviso del error arriba.

- **Toda consulta se muestra a través de `EstadoVista`** (o de `TablaServidor`, que lo usa por dentro): carga con esqueleto, vacío con un mensaje útil y error con el mensaje del backend, reintentar y el `requestId`.
- **Las páginas solo componen.** Sin `if` de negocio, sin formatear montos a mano, sin llamar a `api`.
- Una página con varias consultas independientes (el dashboard) da a cada una su propio `EstadoVista`: una que falla no tumba las demás.
- Cada página pone su título (`document.title`) y un encabezado `h1`.

## 6. Formularios (FE-03)

```tsx
const formulario = useFormularioApi({
  esquema: crearDireccionSchema,          // de @shopcart/shared, el mismo que valida la API
  mutacion: useCrearDireccion(),
  valoresIniciales: { esPredeterminada: false },
  alTerminar: () => navigate(…),
});

<Form {...formulario.form}>
  <form onSubmit={formulario.enviar}>
    <AvisoFormulario error={formulario.errorGeneral} />
    <CampoFormulario nombre="nombreRecibe" etiqueta="Quién recibe" />
    …
    <Button type="submit" disabled={formulario.enviando}>Guardar</Button>
  </form>
</Form>
```

- **El esquema siempre sale de `@shopcart/shared`.** Si el esquema que necesitas todavía está en la API, moverlo es parte de la historia de datos del módulo (§2). Nunca escribas un esquema paralelo en la web.
- **`useFormularioApi` es el único lugar que traduce errores del backend:** `400` → cada campo de los detalles a su campo (`body.x` → `x`; el 400 de `manejar` trae `detalles: { errores: [{ campo, mensaje }] }`); `409`/`422` → `errorGeneral` con el mensaje del backend; `5xx`/red → aviso genérico con el `requestId`. No hagas `try/catch` en los formularios.
- **Un 409 o 422 que es de un campo** (`CORREO_EN_USO`) va a ese campo con `campoPorCodigo: { CORREO_EN_USO: 'correo' }`; los demás códigos siguen yendo al aviso. Un `401` de credenciales nunca va a un campo (N-15).
- **Un campo `.optional()` del esquema** lleva `vacio="ausente"` en `CampoFormulario`: vacío se envía como ausente, no como `''`, que el esquema rechazaría. Un `.nullable()` que se borra (el teléfono del perfil) lleva `vacio="nulo"`.
- **El botón de enviar se deshabilita mientras la mutación está en curso.** En el pago, además, la `Idempotency-Key` se genera **una vez por intento de pago** y se reutiliza en cada reintento de ese intento (RF-06).
- Mensajes de validación en español y junto al campo; etiquetas visibles, no solo `placeholder`.

## 7. Tablas y listados (FE-06)

```tsx
// Las opciones de orden salen del esquema de query del backend, movido a @shopcart/shared.
type OrdenPedidos = ConsultaPedidosGestion['orden'];

const columnas: ColumnaTabla<FilaPedido, OrdenPedidos>[] = [
  { id: 'pedido', etiqueta: 'Pedido', celda: (p) => `#${p.idPedido}`, prioridad: 1 },
  { id: 'fecha', etiqueta: 'Fecha', celda: (p) => <FechaHora valor={p.fechaPago} />, ordenable: 'fecha', prioridad: 2 },
  { id: 'cliente', etiqueta: 'Cliente', celda: (p) => p.cliente.nombre, prioridad: 2 },
  { id: 'estado', etiqueta: 'Estado', celda: (p) => <EstadoDePedido estado={p.estado} />, prioridad: 1 },
  { id: 'total', etiqueta: 'Total', celda: (p) => <Monto valor={p.total} />, ordenable: 'total', prioridad: 1, alineacion: 'fin' },
];

export function GestionPedidosPagina() {
  const parametros = useParametrosUrl(consultaPedidosGestionSchema);
  return (
    <TablaServidor
      titulo="Pedidos"
      columnas={columnas}
      consulta={usePedidosGestion(parametros.valores)}
      parametros={parametros}
      claveFila={(p) => p.idPedido}
      vacio={{ titulo: 'Todavía no hay pedidos pagados' }}
      filtros={
        <>
          <FiltroTexto parametros={parametros} campo="texto" etiqueta="Cliente" placeholder="Nombre o correo" />
          <SelectorEstado
            valor={parametros.valores.estado}
            onCambiar={(estado) => parametros.cambiar({ estado })}
          />
        </>
      }
    />
  );
}
```

- **Toda tabla de datos del servidor usa `TablaServidor`.** El estado (página, tamaño, orden, dirección y filtros) vive en la URL, validado con **el esquema de *query* del backend** movido a `shared`. El hook de la consulta usa `placeholderData: keepPreviousData`.
- `ordenable` solo acepta valores del `enum` de `orden` de ese esquema: si la lista blanca del backend no lo tiene, no compila. El encabezado ordenable es un `<button>` dentro del `<th>`, que lleva el `aria-sort`.
- Cada columna declara su `prioridad`: bajo el punto `md` (lo decide `usePantallaAncha`, que monta solo una de las dos vistas), las filas se muestran como tarjetas con las columnas de prioridad 1. Los montos van con `alineacion: 'fin'`.
- **La tabla ya resuelve:** página fuera de rango → la última (con total 0, la 1); «Actualizando…» en una región `aria-live="polite"` y `aria-busy` mientras llega la página nueva; el vacío con filtros («Ningún resultado con estos filtros» y *Limpiar filtros*) distinto del `vacio` de la vista; el error con *Reintentar* y el `requestId`.
- Los filtros escriben con `parametros.cambiar(...)`; el texto libre, con `FiltroTexto` (300 ms de espera y una sola entrada del historial por búsqueda).
- Las cuadrículas (el catálogo de la tienda) usan las mismas piezas: `useParametrosUrl`, `Paginacion`, `FiltroTexto` y `EstadoVista`, más `usePaginaEnRango` (la página fuera de rango salta a la última) y `Actualizando` (el aviso mientras llega la página nueva), que también usa `TablaServidor`.

## 8. Rutas y control por rol (FE-04)

```ts
// app/rutas.ts — una sola definición para el guardián y los menús
{ ruta: '/backoffice/inventario', roles: ['Operador', 'Administrador'], menu: { area: 'backoffice', etiqueta: 'Inventario', icono: Boxes },
  pagina: lazy(() => import('../modules/inventario/paginas/InventarioPagina')) }
```

- **Toda ruta nueva se agrega a la definición con sus roles.** Nunca escribas un enlace de menú ni una verificación de rol aparte.
- **Ocultar un botón por rol es experiencia de usuario; la protección real está en el backend.** Usa `useSesion().tieneRol(...)` solo para mostrar u ocultar, nunca como única protección de algo.
- Los `loader` de React Router **no cargan datos**: eso es de TanStack Query.
- Los IDs que vienen en la URL (`/pedidos/:id`) se validan con Zod. Si el backend responde `404` (inexistente o ajeno, RF-01), la página muestra "No encontrado", nunca un error genérico.

## 9. Sesión y tiempo real (FE-05, FE-11)

- **Nunca guardes el token** fuera de `shared/api/sesion`: ni `localStorage`, ni `sessionStorage`, ni estado de React, ni la URL.
- **Ningún módulo maneja 401 ni renueva el token:** lo hace el cliente `api`. Si necesitas saber quién está conectado, usa `useSesion()`.
- No toques el single-flight, el lock (`navigator.locks`) ni el `BroadcastChannel` de la sesión sin una historia que lo pida: es la parte más delicada del frontend y tiene sus pruebas.
- **Tiempo real:** solo `reportes` abre el stream (`useTiempoRealReportes`). Un aviso invalida las llaves de su dominio según el mapa de `reportes.keys.ts`; nunca recarga la página ni muestra datos que vengan en el evento.

## 10. Montos y fechas (FE-10)

- **Nunca conviertas un monto a `number` para mostrarlo ni lo calcules** (ni subtotales, ni descuentos, ni "te faltan Q…"). Muéstralo con `<Monto valor={…} />` o `formatearMonto()`, que formatean el texto sin convertirlo.
- **Campos de monto:** `type="text"` con `inputMode="decimal"`, validados con `montoSchema`; viajan como texto. Nunca `type="number"`.
- **Gráficas:** se convierte a número **solo** para la geometría (`Number(fila.ventas)` en el `dataKey`); etiquetas, ejes y tooltips usan `formatearMonto(fila.ventas)`.
- **Fechas con hora:** `<FechaHora>` o `formatearFechaHora()`, siempre en `America/Guatemala`.
- **Fechas sin hora (`"2026-11-03"`): nunca `new Date(valor)`.** Usa `formatearFechaCalendario()`. Los filtros de rango envían `AAAA-MM-DD` tal cual.

## 11. Interfaz (FE-01)

- **Primero shadcn/ui y los componentes de `shared/componentes`.** Agrega una primitiva de shadcn con su CLI (`pnpm dlx shadcn@latest add <componente>`) a `shared/ui`; extiéndela componiendo, no editándola para un caso particular.
- **Trampa de `shadcn add` (revísalo en cada `add`):** con el alias `utils` de este proyecto (`@/shared/ui/cn`), el CLI escribe `import { cn } from "cn"` e **instala el paquete npm `cn`**, que no está en FE-14. Después de cada `add`: `pnpm --filter @shopcart/web remove cn`, cambia el import a `./cn` (y cualquier `@/shared/ui/...` a una ruta relativa), restaura el lockfile de HEAD y corre `pnpm install` para que solo agregue las dependencias de la primitiva (quitar y agregar deja cambios ajenos en el lockfile). Si pregunta si sobrescribe un archivo existente (`button.tsx`), responde que no. Pasa el lint estricto sobre la primitiva y corrige lo que marque sin cambiar su comportamiento.
- **Primitiva sin el CLI (desde el registro):** copia el `content` de `https://ui.shadcn.com/r/styles/new-york-v4/<componente>.json` con solo los ajustes que tiene `sheet.tsx`: sin `'use client'`, `cn` desde `./cn`, los `@/registry/...` como rutas relativas y el texto para lectores de pantalla en español («Cerrar»). Así están `dialog.tsx` y `radio-group.tsx`; compruébalo con un `diff` contra el registro pasado por prettier. Lo propio de un uso (alto máximo con desplazamiento, tipografía del título) va en el `className` de quien la usa, nunca en la primitiva.
- **Solo clases de Tailwind y las variables del tema** (`bg-background`, `text-muted-foreground`, `text-destructive`). Nada de colores sueltos (`#3b82f6`, `bg-blue-500`), estilos en línea ni CSS por componente. Así el modo oscuro funciona solo.
- Combina clases con `cn()`. Variantes de un componente con `cva`, no con condicionales de texto.
- ***Mobile first*:** escribe primero la vista de teléfono y agrega `md:`/`lg:`. Revisa cada pantalla en 375 px y en 1280 px.
- **Accesibilidad:** botones para acciones y enlaces para navegar; todo control con etiqueta visible o `aria-label`; foco visible; la información nunca depende solo del color (estados de pedido con texto, no solo con un punto de color).
- Íconos de `lucide-react`. Textos de la interfaz en español, con el tono de la tienda.

## 12. Pruebas (FE-12)

Cada criterio de aceptación se convierte en una prueba **antes** de escribir el código (TDD).

| Tipo | Dónde | Qué prueba | Cómo |
|---|---|---|---|
| Unitaria | junto al archivo, `*.test.ts` | Funciones puras, formato, mapeo de errores, hooks sin interfaz | Vitest |
| Componente | junto al archivo, `*.test.tsx` | Estados de carga, vacío y error; formularios; control por rol | Vitest + Testing Library + MSW (jsdom) |
| E2E | `apps/web/e2e/<modulo>.spec.ts` | El flujo principal del módulo | Playwright contra `docker compose` (a través de nginx) |

**Componentes:**
- Consulta como lo haría una persona: `getByRole` con su `name`, después `getByLabelText`, después `getByText`. `getByTestId` solo si no hay otra forma, con un comentario.
- Interactúa con `userEvent`, no con `fireEvent`. Espera con `findBy…` o `waitFor`, nunca con tiempos fijos.
- **MSW con respuestas tipadas con el contrato** (`Respuesta<…>`): si el backend cambia la forma, la prueba no compila. Un *handler* por defecto para el caso feliz en `test/handlers/<modulo>.ts` y `server.use(...)` por prueba para errores.
- Cada página se prueba en sus tres estados; cada formulario, con un `400` (error en el campo) y un `409` o `422` (aviso general).
- Renderiza con el ayudante `renderizar()` de `test/`, que monta `QueryClient` nuevo (sin reintentos), el router en memoria y la sesión con el rol indicado.
- Sin pruebas de *snapshot* ni de detalles de implementación (clases CSS, estado interno).

**E2E:**
- **Los datos se preparan por la API pública** con el fixture `apiAdmin` (token de Admin) y nombres únicos por corrida (`e2e-<corrida>-…`). Nunca dependas de la semilla demo ni del orden de las pruebas.
- Localiza como en Testing Library (`getByRole`). Sin esperas fijas (`waitForTimeout`).
- Si el módulo tiene datos de otro cliente, incluye el caso de aislamiento: el cliente B entra por URL a un recurso del cliente A y ve "No encontrado" (RF-01).

## 13. Checklist antes de terminar

- [ ] La estructura del módulo está completa y otros módulos solo usan su `index.ts`.
- [ ] Toda llamada pasa por el cliente `api` con la ruta literal; ningún componente importa `api`.
- [ ] Los esquemas de entrada salen de `@shopcart/shared`; si se movió alguno, `openapi.json` quedó idéntico.
- [ ] Las llaves salen de `<modulo>.keys.ts`; sin actualizaciones optimistas; las mutaciones invalidan lo que cambian.
- [ ] Toda consulta pasa por `EstadoVista` o `TablaServidor`: carga, vacío y error visibles.
- [ ] Los formularios usan `useFormularioApi`; el botón de enviar se deshabilita mientras envía.
- [ ] Las rutas nuevas están en la definición con sus roles; los menús salen de ahí.
- [ ] Ningún monto se convierte a `number` (salvo la geometría de una gráfica) ni se calcula; ninguna fecha sin hora pasa por `new Date()`.
- [ ] El token no aparece fuera de `shared/api/sesion`.
- [ ] La pantalla se revisó en 375 px y en 1280 px, en modo claro y oscuro.
- [ ] Hay pruebas para cada criterio de aceptación; el E2E del módulo pasa contra el backend real.
- [ ] `pnpm contrato:cobertura` muestra las rutas del módulo cubiertas o justificadas.
- [ ] `pnpm lint`, `pnpm typecheck` y las pruebas pasan, y se muestra su salida real.
- [ ] Cumple la subsección SOLID y clean code de `CLAUDE.md`, sin abstracciones que ninguna historia necesite.
