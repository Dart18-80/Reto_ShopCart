# Estado del backend (Fase 1)

Revisión completa sobre `1be3c26` (2026-11-02), al cierre de la Fase 1: E0 a E9 están **Hecha** en el tablero (`docs/03-backlog.md` §5) salvo E9-H04 (revisión manual de pagos), **En revisión**. Cada cifra se recalculó sobre ese commit, con scripts sobre el código, el router real, los reportes JSON de Vitest y el reporte de cobertura; nada se copió de una revisión anterior, salvo la medición de rendimiento de §7, que dice de cuándo es.

| § | Contenido |
|---|---|
| 0 | Resumen y verificación |
| 1 | Inventario por módulo, con la cobertura combinada |
| 2 | Matriz de criterios y pruebas |
| 3 | Coherencia entre documentos y código |
| 4 | Todo lo diferido |
| 5 | Puntos calientes de calidad |
| 6 | Seguridad |
| 7 | Rendimiento |
| 8 | Riesgos |

## 0. Resumen y verificación

- **Alcance:** 15 módulos, 98 rutas (96 en `/api/v1` y 2 de Swagger), 130 stored procedures, 9 vistas, 15 funciones de tabla, 12 triggers y 41 tablas (3 de ellas ledger append-only).
- **Pruebas:** 551 unitarias de la API, 779 de integración (incluidas 5 de telemetría), 258 unitarias y 11 de integración del migrador, 2 de concurrencia (RNF-3), 28 de entorno y 2 de humo de la imagen.
- **Cobertura combinada** (unitarias e integración en una sola corrida, `pnpm test:cobertura`): **líneas 94.68 %, ramas 86.93 %, funciones 95.03 %, sentencias 93.49 %** (en la verificación final; entre corridas varía una o dos líneas, porque un reintento depende del tiempo).
- **Coherencia:** el router y 01 coinciden en las 98 rutas; los objetos de base y los 71 códigos de error coinciden con 02; los 60 IDs citados en el código existen en `docs/` (§3).
- **Riesgos abiertos:** ningún CRÍTICO ni ALTO. La revisión manual de pagos (E9-H04) ya resuelve los intentos `EnRevision`; queda una decisión del PO para el caso de un pedido ya despachado cuyo pago resulta sin cobro (§8).

**Verificación desde cero** en un clon nuevo con `core.autocrlf=true` y el entorno de Docker levantado desde cero, sin el perfil de observabilidad y con él, más `pnpm ledger:verificar` y `pnpm test:cobertura` (1,330 pruebas en una sola corrida). Dos corridas: sobre `9b2a7a6` (entorno en 106 s, construyendo las imágenes) falló una vez `cache.api.test.ts` › "una devolución se ve en el reporte": medía el total de devoluciones de hoy, que otros archivos cambian en paralelo; se corrigió en `9c1d9a9` midiendo en un día propio. Sobre `9c1d9a9` (22 s, con las imágenes ya construidas) todo quedó en verde salvo `defensa.test.ts`: esa corrección movió una línea que cita la guía; se reubicó en el commit siguiente, solo de documentación, con la prueba de citas y las 551 unitarias en verde.

| Suite | Sin el perfil `observabilidad` | Con el perfil |
|---|---|---|
| `pnpm lint` y `pnpm typecheck` | verde | — |
| API unitarias | 551 | — |
| Migrador | 258 unitarias + 11 de integración | — |
| API integración (incluida la telemetría) | 779 | 779 |
| Concurrencia (RNF-3) | 2 | 2 |
| Entorno | 26 (2 omitidas: las del perfil) | 27 (1 omitida: la de sin perfil) |
| Humo de la imagen | 2 | — |

El guion de demo (`docs/defensa/guion-demo.md`) se ensayó literal: sus bloques de Bash se extrajeron del archivo y se ejecutaron, y el paso 7 encontró en Tempo la traza del pago por su `requestId`.

## 1. Inventario por módulo

Pruebas: casos (archivos), del reporte JSON de Vitest. Las de integración se asignan por carpeta; las de `secuencial/` por su tema (configuración y envíos, exportaciones, garantía del carrito, último Admin, paginación de la bitácora); las de `esquema/`, `seguridad/`, `adaptadores/`, `shared/`, `semillas/`, `telemetria/`, la paginación general y las tareas periódicas van en la fila transversal. Cobertura: `pnpm test:cobertura`, líneas · ramas de `apps/api/src/modules/<módulo>`.

| Módulo | Endpoints | SPs | Tablas | Vistas | Funciones | Triggers | Unitarias | Integración | Cobertura combinada |
|---|---|---|---|---|---|---|---|---|---|
| auth | 4 | 5 | RefreshToken | — | — | — | 15 (1) | 37 (3) | 100 % · 94 % |
| usuarios | 8 | 7 | Usuario, Rol | — | — | TR_Usuarios_Bitacora | 9 (1) | 57 (3) | 100 % · 83 % |
| direcciones | 7 | 6 | Direccion, Departamento, Municipio | — | — | — | 3 (1) | 48 (2) | 100 % · 96 % |
| catalogo | 26 | 24 | Categoria, Producto, ImagenProducto, Atributo, ValorAtributo, Variante, VarianteValorAtributo, PrecioVariante | VW_Catalogo_ProductosTienda | FU_Catalogo_CombinacionVariante, FU_Catalogo_HistorialVariante, FU_Catalogo_PatronBusqueda, FU_Catalogo_PrecioVigente | TR_Catalogo_CategoriaBitacora, TR_Catalogo_ProductoBitacora, TR_Catalogo_VarianteBitacora, TR_Catalogo_PrecioVarianteBitacora | 15 (1) | 89 (7) | 100 % · 90 % |
| inventario | 6 | 9 | MovimientoKardex, TipoMovimiento | VW_Inventario_Conciliacion, VW_Inventario_ExistenciaBodega | FU_Inventario_Disponible, FU_Inventario_Movimientos | — | 3 (1) | 38 (4) | 100 % · 94 % |
| carrito | 7 | 11 | Carrito, LineaCarrito | VW_Carrito_Abandonados | FU_Carrito_Activo, FU_Carrito_Disponible, FU_Carrito_Lineas | — | 14 (1) | 116 (8) | 98 % · 86 % |
| cupones | 6 | 8 | Cupon, UsoCupon | VW_Cupones_Admin | FU_Cupones_CalculoDescuento, FU_Cupones_RestriccionViolada, FU_Cupones_Validar | TR_Cupones_Bitacora | 3 (1) | 34 (1) | 100 % · 94 % |
| envios | 2 | 2 | MetodoEnvio | — | FU_Envios_Costos, FU_Envios_EnvioGratis | TR_Envios_Bitacora | 2 (1) | 0 (0)¹ | 98 % · 87 % |
| configuracion | 2 | 2 | ParametroSistema | — | — | TR_Configuracion_Bitacora | 0 (0) | 12 (1) | 100 % · 96 % |
| checkout | 4 | 11 + 4 `SP_Pasarela_*` | SesionCheckout, LineaSesionCheckout, Reserva, IntentoPago, PasarelaAutorizacion, PasarelaReembolso | — | — | — | 51 (4) | 65 (4) | 95 % · 89 % |
| pedidos | 12 | 19 | Pedido, DetallePedido, Devolucion, DetalleDevolucion, Reembolso, HistorialEstadoPedido, EstadoPedido, TransicionEstadoPedido | VW_Pedidos_Historial | — | TR_Pedidos_Bitacora, TR_Pedidos_PagoBitacora, TR_Pedidos_ReembolsoBitacora, TR_Pedidos_ValidarTransicion | 34 (3) | 63 (5) | 95 % · 82 % |
| reportes | 6 | 5 (`SP_Dashboard_*`) | — (lee vistas) | VW_Dashboard_HechosVenta, VW_Dashboard_VentasPorCategoria | — | — | 32 (2) | 18 (3) | 99 % · 85 % |
| bitacora | 1 | 1 | Bitacora | — | — | — | 1 (1) | 5 (2) | 100 % · 100 % |
| exportaciones | 4 | 10 | SolicitudExportacion, EstadoExportacion | VW_Exportaciones_Solicitudes | — | — | 40 (4) | 16 (1) | 94 % · 81 % |
| sistema | 1 | 5 | SolicitudIdempotente | — | FU_Sistema_FechaLocal | — | 8 (1) | 1 (1) | 98 % · 81 % |
| shared, app y transversales | 2 (Swagger) | 1 (`SP_Semilla_GenerarDatosDemo`) | HistorialMigracion (migrador) | — | — | — | 321 (35) | 180 (21) | 88 % · 87 % |
| **Total API** | **98** | **130** | **41** | **9** | **15** | **12** | **551 (58)** | **779 (66)** | **94.68 % · 86.93 %** |
| Migrador (`database/migrator`) | — | — | — | — | — | — | 258 (7) | 11 (2) | — |

¹ Los casos de envíos viven en `test/integracion/carrito/envios.api.test.ts` y `secuencial/configuracion-envios.api.test.ts` (contados en carrito y configuración).

Además: 2 pruebas de concurrencia (`test/concurrencia`), 28 de entorno en 6 archivos (`test/entorno`: seguridad HTTP, contenedores sin root, RNF-2, apagado ordenado, observabilidad y tiempo real) y 2 de humo de la imagen (`test/humo`). Los 88 SPs y 3 triggers de prueba de `database/test/` solo existen en `shopcart_test` y no se cuentan.

**Cobertura por pieza compartida** (líneas · ramas): `shared/adapters` 97 % · 85 %, `shared/db` 97 % · 91 %, `shared/errors` 100 % · 94 %, `shared/http` 99 % · 97 %, `shared/jobs` 100 % · 93 %, `shared/observability` 73 % · 50 %, `shared/config` y `shared/dinero` 100 % · 100 %. Lo más bajo es el arranque (`server.ts`, `telemetria.ts`, `apagado.ts`: 56 % · 50 %) y la telemetría: la prueba de seguridad de trazas levanta la API compilada en otro proceso, que v8 no mide; el apagado se prueba aparte (`unit/apagado.test.ts`, `entorno/apagado.test.ts`).

## 2. Matriz de criterios y pruebas

Rutas relativas a `apps/api/test/`, salvo las que empiezan con `database/`. Los criterios de RF-01 a RF-09 están en `docs/enunciado-shopcart.md` §04; los RNF, en `docs/00-vision-y-contexto.md`. Cada nombre entre comillas se verificó contra los archivos de prueba.

| Requisito | Criterio | Prueba (archivo › caso) | Tipo |
|---|---|---|---|
| RF-01 | Cambiar el ID de un pedido, carrito o dirección no expone ni modifica datos de otro cliente | `integracion/seguridad/aislamiento.api.test.ts` › "%s: el recurso de otro cliente responde 404, igual que uno inexistente" (cada ruta de cliente con ID), "cada ruta de cliente que recibe un ID tiene su caso de aislamiento, y ningún caso sobra", "los intentos del otro cliente no cambiaron nada del dueño", "ninguna ruta de cliente acepta idUsuario en su entrada y todos sus cuerpos son estrictos", "toda ruta declara sus roles o es una de las públicas conocidas" | integración |
| RF-01 | Ídem, por recurso | `integracion/pedidos/consulta.api.test.ts` › "el pedido de otro cliente responde 404, igual que uno inexistente"; `integracion/carrito/carrito.api.test.ts` › "la línea de otro cliente responde 404 en PATCH y DELETE, y no cambia"; `integracion/direcciones/direcciones.api.test.ts` › "RF-01: un cliente que usa el ID de una dirección de otro recibe 404 al leerla, editarla o borrarla" y "A-02: el SP rechaza editar o borrar una dirección ajena aunque el servicio no la haya filtrado"; `integracion/checkout/iniciar-sesion.api.test.ts` › "carrito vacío → 422; dirección ajena o método inexistente → 404"; `integracion/checkout/pagar.api.test.ts` › "la llave de otro cliente responde 422 (sin revelar de quién es)" | integración |
| RF-01 | El actor sale del contexto, nunca del llamador | `unit/shared/db/ejecutar-sp.test.ts` › "RF-01: rechaza que el llamador envíe un parámetro estándar" y "A-18: con peticiones concurrentes, cada SP recibe el actor de su propia petición"; `unit/shared/http/contexto.test.ts` › "RF-01: entrega el contexto en solo lectura; solo establecerUsuario cambia el usuario" | unitaria |
| RF-01 | Token expirado → 401; recurso no permitido → 403 | `unit/shared/http/autenticar.test.ts` › "un token vencido responde 401"; `integracion/catalogo/productos.api.test.ts` › "un Cliente o un Operador recibe 403 en cada ruta de administración, y sin token 401"; `integracion/pedidos/consulta.api.test.ts` › "un Cliente no entra a la gestión (403)" | unitaria + integración |
| RF-02 | Un cambio de precio no altera los pedidos ya realizados | `integracion/pedidos/consulta.api.test.ts` › "un cambio de precio posterior no altera el monto de un pedido ya realizado"; `integracion/checkout/iniciar-sesion.api.test.ts` › "un cambio de precio posterior no afecta la sesión" | integración |
| RF-03 | La existencia coincide con la suma del kardex | `integracion/inventario/inventario.api.test.ts` › "CA: tras movimientos simultáneos, el saldo cuadra con el kardex y la conciliación no muestra la variante"; `integracion/semillas/datos-demo.test.ts` › "kardex, pedidos e historial coinciden en el tiempo y la conciliación de inventario queda vacía"; `concurrencia/checkout.concurrencia.test.ts` › escenario 1 (exige la conciliación vacía) | integración + concurrencia |
| RF-03 | Un ajuste exige motivo y no deja la existencia en negativo | `integracion/inventario/inventario.api.test.ts` › "CA: un ajuste %s responde 400 MOTIVO_REQUERIDO, igual que una entrada", "CA: un ajuste que deja la existencia negativa responde 422 AJUSTE_DEJA_NEGATIVO", "dos ajustes negativos a la vez que juntos bajan de cero: uno pasa y el otro 422 AJUSTE_DEJA_NEGATIVO" | integración |
| RF-04 | No se agrega más que lo disponible; las unidades que el cliente reservó al pagar siguen siendo suyas | `integracion/carrito/carrito.api.test.ts` › "no se puede agregar más de lo disponible y un invitado nuevo no deja un carrito vacío", "PATCH cambia la cantidad; por encima de lo disponible responde 409 y no cambia", "cinco sumas simultáneas de 2 unidades con 5 disponibles nunca pasan de 5"; `integracion/checkout/iniciar-sesion.api.test.ts` › "con su pago en curso, el cliente puede cambiar la cantidad de una línea que él mismo reservó" | integración |
| RF-04 | El total no tiene errores de redondeo | `integracion/carrito/carrito.api.test.ts` › "cuadran al centavo con DECIMAL y viajan como texto"; `integracion/carrito/cupon.api.test.ts` › "Q10.00 entre tres líneas iguales: el centavo sobrante va a la primera (desempate por IDLinea)"; `unit/shared/dinero/monto.test.ts` › "redondea a 2 decimales un promedio periódico (1.666… → 1.67)" | integración + unitaria |
| RF-05 | Cupón vencido, agotado o bajo el mínimo → mensaje específico | `integracion/carrito/cupon.api.test.ts` › "%s responde %s (422) con su mensaje", "agotado responde CUPON_AGOTADO", "el mínimo no alcanzado indica cuánto falta"; `integracion/semillas/datos-demo.test.ts` › "hay un cupón para demostrar cada mensaje de rechazo de RF-05" | integración |
| RF-05 | El límite total se respeta con clientes simultáneos | `concurrencia/checkout.concurrencia.test.ts` › "escenario 2: 20 clientes por el último uso de un cupón → 1 pedido con cupón y 19 × 422 CUPON_AGOTADO"; `integracion/checkout/iniciar-sesion.api.test.ts` › "el cupón con un solo uso y cinco clientes simultáneos: uno lo reserva y cuatro reciben 422 CUPON_AGOTADO"; `integracion/carrito/cupon-reservas.api.test.ts` › "la reserva de este mismo carrito que ya venció pero aún no se libera tampoco cuenta: el cupón sigue" | concurrencia + integración |
| RF-05 | El total nunca queda bajo cero | `integracion/carrito/cupon.api.test.ts` › "un monto fijo mayor que el subtotal deja el total en cero, nunca negativo" | integración |
| RF-06 | Última unidad: compra uno, el otro recibe un mensaje claro, nunca hay sobreventa | `concurrencia/checkout.concurrencia.test.ts` › "escenario 1: 20 clientes por la última unidad → 1 pedido y 19 × 409 STOCK_INSUFICIENTE"; `integracion/checkout/iniciar-sesion.api.test.ts` › "todo o nada: si una línea no alcanza, 409 con el disponible y ninguna reserva ni uso del cupón" | concurrencia + integración |
| RF-06 | Repetir el pago no genera dos pedidos ni dos cobros | `integracion/checkout/pagar.api.test.ts` › "doble clic con la misma llave: un solo pedido y un solo cobro; el reintento recibe el mismo pedido", "4000…0119: 504 PAGO_SIN_CONFIRMAR con el arrendamiento liberado; el reintento completa con un solo cobro", "dos retomas simultáneas del mismo intento: solo una avanza"; `integracion/checkout/vigencia-del-pago.api.test.ts` › "con un token que otro proceso ya reemplazó, ni se actualiza, ni se libera, ni se renueva el intento" | integración |
| RF-06 | La creación del pedido es atómica | `integracion/checkout/pago-fallas.api.test.ts` › "si el pedido falla dentro del SP no queda pedido, detalle, kardex ni cupón confirmado, y se anula la autorización", "se revierten la salida del kardex, la existencia, las reservas, el cupón, la sesión y el carrito" | integración |
| RF-07 | Transición no permitida rechazada en el backend y en la base | `integracion/pedidos/estados.api.test.ts` › "primera capa (backend): saltar un estado responde 409 TRANSICION_INVALIDA sin tocar la base", "segunda capa (SP): …", "tercera defensa (trigger): un UPDATE directo con una transición inválida se revierte", "cada (origen, destino, rol) del mapa está en la tabla y viceversa" | integración |
| RF-07 | Cancelar o devolver reintegra la existencia y se ve en los reportes | `integracion/pedidos/cancelacion.api.test.ts` › "desde Pagado: Cancelado, reingreso al kardex, cupón revertido y reembolso del total con envío"; `integracion/pedidos/devoluciones.api.test.ts` › "parcial: DevueltoParcial, reingreso al inventario y reembolso del precio pagado de esa línea"; `integracion/reportes/cache.api.test.ts` › "cancelar un pedido se ve en el reporte", "una devolución se ve en el reporte" | integración |
| RF-07 | Una reserva vencida libera la existencia sola | `integracion/secuencial/tareas-periodicas.test.ts` › "una sesión vencida pasa a Expirada y libera sus reservas y el uso del cupón" | integración |
| RF-07 | No se devuelve más de lo vendido | `integracion/pedidos/devoluciones.api.test.ts` › "no se devuelve más de lo vendido: 422 DEVOLUCION_EXCEDE_VENDIDO con lo que queda por línea" | integración |
| RF-07 | Cada cambio de estado registra quién, cuándo, de qué a qué | `integracion/pedidos/estados.api.test.ts` › "recorre Pagado → EnPreparacion → Despachado → Entregado y registra quién, cuándo, de qué a qué y por qué" | integración |
| N-09 (E9-H04) | El Admin resuelve un pago `EnRevision` con la evidencia de la pasarela; dos resoluciones a la vez: una pasa | `integracion/pedidos/revision-manual.api.test.ts` › "CobroVerificado con la captura en la pasarela: el intento queda Capturado, el pedido avanza y queda en la bitácora", "CobroVerificado sin captura en la pasarela se rechaza y no cambia nada", "SinCobro cancela el pedido por el flujo de siempre, sin reembolso, con el motivo del Admin", "Reembolsar un cobro sin pedido: reembolso por el monto del intento, devuelto en la pasarela", "dos resoluciones simultáneas del mismo intento: una pasa y la otra recibe 409", "el SP, bajo bloqueo, rechaza la segunda resolución del mismo intento con 50707", "Operador y Cliente reciben 403 al resolver un pago"; `unit/modules/pedidos/pedidos.revision.test.ts` | integración + unitaria |
| N-09 (E9-H04) | Un pedido con el pago `EnRevision` no se cancela; un reembolso `Fallido` se resuelve a mano | `integracion/pedidos/cancelacion.api.test.ts` › "el cliente recibe 409 PAGO_EN_REVISION con un mensaje claro y nada cambia", "la gestión tampoco lo cancela: SinCobro es la única vía"; `integracion/pedidos/revision-manual.api.test.ts` › "pasa a ResueltoManual con motivo, referencia, quién y cuándo, y queda en la bitácora", "el reintento del Admin ya no lo toca y resolverlo otra vez responde 409" | integración |
| RF-08 | Paginación y filtros en el servidor | `integracion/pedidos/consulta.api.test.ts` › "filtra por cliente y por estado, con el cliente de cada pedido", "el rango de fechas usa FechaPagoLocal (días de Guatemala), con los extremos incluidos"; `integracion/secuencial/paginacion.api.test.ts` (5 listados y kardex); `integracion/secuencial/bitacora-paginacion.api.test.ts` | integración |
| RF-08 | Reportes sin cancelados y con devoluciones descontadas | `integracion/reportes/dashboard.api.test.ts` › "el resumen cuenta pedidos no cancelados en su día de pago: …", "las devoluciones se restan en su propio día de Guatemala (05:59 UTC → día anterior; 06:00 → mismo día)", "ventas por categoría y top productos del periodo" | integración |
| RF-09 | La bitácora no se modifica ni se elimina, y se puede demostrar | `integracion/esquema/ledger.test.ts` › "%s rechaza %s" (Bitacora, MovimientoKardex e HistorialEstadoPedido × Modificar/Eliminar, error 37359); `database/migrator/test/integracion/ledger.test.ts` › "genera el digest, lo guarda fuera de la base y verifica el ledger contra todos los guardados", "si un digest guardado no corresponde a la base, la verificación falla" | integración |
| RF-09 | Cada registro guarda usuario, fecha, entidad, acción y valores anterior y nuevo | `integracion/esquema/bitacora.test.ts` › "un cambio de precio registra usuario, fecha, entidad, acción, precio anterior y nuevo", "la creación de un usuario nunca registra su HashContrasena" | integración |
| RNF-1 | Listados y reportes < 1 s con volumen alto | Medición manual con 50 000 pedidos (§7). Aserción parcial con poco volumen: `integracion/reportes/dashboard.api.test.ts` › "cada reporte responde en menos de 1 s (RNF-1)" | manual + integración |
| RNF-1 | Semilla de volumen medio | `integracion/semillas/datos-demo.test.ts` › "1,500 pedidos de ~200 clientes en los últimos 90 días, con cancelaciones, devoluciones y carritos abandonados" | integración |
| RNF-2 | API stateless con 2 réplicas; estado en SQL Server o Redis | `concurrencia/checkout.concurrencia.test.ts` (exige respuestas de `api-1` y `api-2`); `integracion/reportes/cache.api.test.ts` › "crear un pedido en una réplica se ve de inmediato en el reporte de la otra"; `integracion/reportes/tiempo-real.api.test.ts` › "un pedido creado en una réplica llega como evento a un cliente conectado a la otra"; `integracion/usuarios/usuarios.api.test.ts` › "A-07: dos réplicas ven la misma versión: …"; `integracion/adaptadores/limitador-redis.test.ts` › "el contador vive en Redis: dos réplicas comparten los intentos"; `integracion/secuencial/exportaciones.api.test.ts` › "el archivo que generó una réplica se descarga desde la otra, …", "una réplica que muere a mitad: otra la retoma al vencer el arrendamiento y queda un solo archivo" | concurrencia + integración |
| RNF-2 | Redis caído: se degrada sin vender de más | `unit/modules/sistema/health.api.test.ts` › "con Redis detenido responde 200 con redis: \"degradado\""; `integracion/adaptadores/limitador-redis.test.ts` › "con Redis caído cae al contador en memoria: …"; `integracion/reportes/cache.api.test.ts` › "con Redis caído el reporte responde igual, desde la base"; `entorno/rnf2.test.ts` › "con Redis detenido, un checkout completo vende la última unidad una sola vez y cobra una sola vez" | unitaria + integración + entorno |
| RNF-2 | Los jobs corren en una sola réplica (`sp_getapplock`) | `integracion/secuencial/tareas-periodicas.test.ts` › "si la otra réplica tiene el bloqueo, retorna sin hacer nada"; `unit/shared/jobs/planificador.test.ts` › "no superpone dos ejecuciones de la misma tarea en una réplica" | integración + unitaria |
| RNF-2 | Con `api-1` detenida todo responde desde `api-2`; un `docker stop` termina limpio | `entorno/rnf2.test.ts` › "con api-1 detenida, 20 peticiones seguidas a través de nginx responden 200 desde api-2" (el número sale de una constante); `entorno/apagado.test.ts` › "docker stop durante una petición en curso: la petición termina con 200 y la réplica sale con 0" | entorno |
| RNF-3 | 20 checkouts por la última unidad / 20 usos del último cupón → 1 éxito | `concurrencia/checkout.concurrencia.test.ts` › escenarios 1 y 2 | concurrencia |
| RNF-4 | Logs JSON sin secretos | `unit/shared/observability/logger.test.ts` › "redacta contraseñas, tarjeta, CVV, authorization y cookies, también anidados"; `integracion/auth/registro-login.api.test.ts` › "registro, login y un error de credenciales no dejan secretos en el log" | unitaria + integración |
| RNF-4 | `requestId` hasta los SPs | `integracion/shared/contexto-de-sesion.test.ts` › "deja en SESSION_CONTEXT el usuario, el rol y el RequestId de la petición" | integración |
| RNF-4 | `/health` verifica la base con un SP | `integracion/sistema/health.api.test.ts` › "responde 200 con la base en ok tras ejecutar el SP_Sistema_Health real"; `unit/modules/sistema/health.api.test.ts` › "con la base caída responde 503 para que el healthcheck de Docker marque la réplica" | integración + unitaria |
| RNF-4 | Trazas OpenTelemetry y Grafana LGTM | `telemetria/seguridad-trazas.test.ts` (nada sensible en lo exportado; la traza del pago llega a sus SPs y a la pasarela); `entorno/observabilidad.test.ts` (sin el perfil, una advertencia por señal; con el perfil, la compra en Tempo y sus logs en Loki) | telemetría + entorno |
| Enunciado §05/§08 | Seguridad HTTP | `entorno/seguridad-http.test.ts` (helmet, CORS, sin versión, 500 sin stack) | entorno |
| Enunciado §05/§08 | Sin SQL en el backend, sin concatenación, sin tipos prohibidos, imágenes fijadas | `database/migrator/test/penalizaciones.test.ts` › "ningún archivo TypeScript del backend contiene una sentencia SQL", "§08: el texto de un SQL dinámico nunca concatena valores, …", "§05: ningún FLOAT, REAL, MONEY, …", "toda imagen base de los Dockerfile tiene versión exacta y digest" | unitaria (migrador) |
| Enunciado §05 | Migración idempotente, `V###` inmutable, la app no lee tablas | `database/migrator/test/integracion/migrador.test.ts` › "ejecutarlo dos veces seguidas no aplica nada la segunda vez", "modificar un V### ya aplicado hace fallar el migrador con un mensaje claro", "ejecuta SP_Sistema_Health, pero un SELECT directo a una tabla devuelve error de permisos" | integración (migrador) |
| A-01 | Capas y fronteras | `unit/fronteras.test.ts` › "importar el repositorio de otro módulo hace fallar el lint", "%s: el lint falla" (el controlador importa el repositorio; el servicio importa Express, las rutas o el controlador; el repositorio importa el servicio) | unitaria |

## 3. Coherencia entre documentos y código

### 3.1 Endpoints de 01 vs el router

El router registra **98 rutas**: 96 bajo `/api/v1` en los 15 `*.routes.ts`, y `GET /api/docs/openapi.json` y `/api/docs` fuera de `/api/v1` (`apps/api/src/app.ts:178`, `:181`). 01 §5.2 las nombra todas: 90 con su método y ruta, y 8 abreviadas sin ambigüedad («… `/activar` y `/desactivar`» en catálogo y usuarios, y los `GET` del dashboard que comparten el método de la fila); las 3 de E9-H04 están en la fila de pedidos. **98 de 98 coinciden**; ninguna ruta del router falta en 01 y ningún endpoint de 01 falta en el router. A-24 (`POST /admin/reportes/{reporte}/exportaciones`, 01:567) y A-25 (`GET /admin/reportes/eventos`, 01:568) coinciden con `exportaciones.routes.ts:49` y `reportes.routes.ts:120`.

Sin diferencias.

### 3.2 Objetos de 02 vs database/

Cada `R__*.sql` crea un solo objeto con el nombre de su archivo.

| Tipo | En `database/programmability` | En 02 | Faltan en database/ | Faltan en 02 |
|---|---|---|---|---|
| SPs | 130 | 130 (§5) | 0 | 0 |
| Vistas | 9 | 9 (§4) | 0 | 0 |
| Funciones | 15 | 15 (§4) | 0 | 0 |
| Triggers | 12 | 12, con su nombre (§3.9 y §3.10) | 0 | 0 |

La API invoca por nombre 115 SPs distintos y los 115 existen. Los 15 que no invoca: los 13 que 02 §5 marca **(interno)** (el decimotercero es `SP_Pedidos_AplicarCancelacion`, el cuerpo de la cancelación que comparten `SP_Pedidos_Cancelar` y la resolución `SinCobro`), `SP_Pedidos_ListarTransiciones` (lo usa una prueba, como dice 02 §5) y `SP_Semilla_GenerarDatosDemo` (lo ejecuta `S006__datos_demo.sql`).

Sin diferencias.

### 3.3 Códigos de 02 §8 vs catalogo.ts

**71 de 71 códigos coinciden** en nombre, número y HTTP entre 02 §8 y `apps/api/src/shared/errors/catalogo.ts`: 56 con número y 15 que nacen en la API (E9-H04 agregó 50707, 50708 y 50709, y `COBRO_SIN_CAPTURA`, `COBRO_CAPTURADO` y `PASARELA_SIN_RESPUESTA`). Los SPs lanzan 53 números distintos (47 con `THROW` literal y 6 por `THROW @NumeroError` desde `FU_Cupones_Validar`) y los 53 tienen su `numeroSql`. Los tres `numeroSql` que ningún SP lanza tienen su razón:

| Código | 02 §8 | catalogo.ts | Por qué no hay `THROW` |
|---|---|---|---|
| `PAGO_RECHAZADO` | 50604 (402) | catalogo.ts:190 | Nace en la API (`checkout.pago.ts:373`); conserva el número de su rango |
| `PAGO_SIN_CONFIRMAR` | 50606 (504) | catalogo.ts:197 | Nace en la API (`checkout.pago.ts:249`) |
| `PAGO_NO_COMPLETADO` | 50607 (409) | catalogo.ts:204 | El SP lo guarda como texto en `CodigoRespuesta` (`R__SP_Checkout_ResolverIntentoConciliado.sql:86`) y la API lo reconstruye (`checkout.repository.ts:148`) |

### 3.4 IDs citados en el código

Se citan **60 IDs distintos** en `apps/`, `packages/` y `database/` (código, SQL y pruebas): A-01 a A-25 salvo A-03 y A-17, M-01, M-03, M-04, M-07, M-08, N-01 a N-19, RF-01 a RF-09 y RNF-1 a RNF-4. Los 60 están definidos (A en 01 §13, M en 02 §10, N y RNF en 00, RF en el enunciado). Ningún archivo cita un D-xx ni una variante mal escrita.

Sin diferencias.

### 3.5 Decisiones de docs/ que no están implementadas

**61 decisiones** (D-01 a D-05, RNF-1 a RNF-4, N-01 a N-19, A-01 a A-25 y M-01 a M-08), todas ✅ en los documentos salvo N-02 ✏️ (modificada por el PO e implementada). **55 tienen evidencia completa de su parte de la Fase 1.** Las 6 de la tabla dependen del frontend de la Fase 2, de un script de F5 o de una postura diferida:

| ID | Decisión (resumen) | Estado en docs | Evidencia en el código o «no encontrada» |
|---|---|---|---|
| RNF-1 | Semilla media y diseño para volumen alto; script opcional de 50k pedidos | 02:940 «Pendiente (F5)» | Semilla: `database/seeds/S006__datos_demo.sql`; el generador acepta `@Pedidos` (02:908). **No encontrado:** `database/load/L001__carga_pesada.sql` (solo `.gitkeep`), como dice 02 §7. La medición con 50k (§7) usó el generador en una base desechable |
| A-03 | nginx balancea y sirve la SPA; un solo origen | ✅ | Backend completo (`infra/nginx/nginx.conf`, `docker-compose.yml`); la SPA es un marcador de la Fase 2 (`apps/web/public/index.html:11`) |
| A-07 | Access token en memoria del frontend, refresh rotado, versión de sesión | ✅ | Backend completo (`auth.service.ts`, `versiones-sesion-redis.ts`); guardar el token en memoria le toca al frontend |
| A-08 | Zod y OpenAPI; esquemas compartidos con el frontend | ✅ | `packages/shared` exporta `montoSchema`, `telefonoSchema` y `textoNvarchar`, que usa la API; todavía no hay frontend que los consuma |
| A-25 | Dashboard en tiempo real con SSE | ✅ | Backend completo (`reportes.routes.ts:120`, `reportes.eventos.ts`); el cliente con `fetch` y streaming es de la Fase 2 |
| D-04 | Kubernetes diferido | Diferida | Sin manifiestos, como se espera; el camino está en 01:83 y en README §4 |

## 4. Todo lo diferido

| Ítem | Estado o fase | Dónde está escrito |
|---|---|---|
| Frontend SPA (Vite + React): tienda, backoffice y dashboard con gráficas, renovación transparente del token | Fase 2 (F1–F4) | 00:53; 03-backlog §4 (:682-693); README:5, :464; `apps/web/public/index.html:11` |
| Pantalla del dashboard en tiempo real (cliente `fetch` con streaming) | Fase 2 (el backend está hecho) | 01:568 (A-25); 03-backlog:691 (F4) |
| Pantallas de revisión manual de pagos (`EnRevision`, reembolsos `Fallido`) | Fase 2. La API está completa (E9-H04): listar y resolver pagos en revisión, y reintentar o resolver a mano un reembolso | README §8; 00 (N-09); `pedidos.routes.ts` |
| Script de carga pesada (`database/load/L001`) | F5 (el generador ya acepta `@Pedidos`) | 00:157; 02:940; 03-backlog:692; README:466 |
| Índice para el filtro de carritos abandonados | F5 (15 ms con 50k, §7) | 03-backlog:692 |
| Correo (puerto `Notificador` + Mailpit): exportación terminada y recuperación de contraseña | Fuera de la Fase 1 | 00:196 (N-15); README:275, :276 |
| Pasarela real (adaptador y webhooks firmados) y captura al despachar | Mejora documentada | 00:174 (N-03); 01:581; README:269, :270 |
| Kubernetes con HPA | Diferido (D-04) | 00:151; 01:83, :583; README:277 |
| Producción: SQL Server con licencia (hoy Developer), HTTPS, secretos en un vault, alertas sobre las métricas | Mejora documentada | README:100, :278, :467; 01:583 |
| nginx punto único de falla → Ingress o ALB | Mejora de producción | 01:77 |
| Almacén de exportaciones en S3 o Azure Blob | Mejora de producción | 01:567 (A-24) |
| Tarifa por zona, límite de compra por cliente, solicitud de devolución del cliente, nueva dimensión de atributos con historial, costo del inventario, FEL | Fuera de alcance o mejora | 00:175, :177, :186, :195, :197, :199; README:267-274 |
| Full-Text Search u OpenSearch | Mejora documentada (A-10) | 01:552, :582 |
| Vistas indexadas, invalidación más fina de `carritos`, particionar kardex y bitácora, jobs en un worker, caché del catálogo | Si el sistema crece | 01:576-580 |
| F6: README final y ensayo de la demo con el frontend | Fase 2 | 03-backlog:693 |

Lo que estaba en F5 y entró en la Fase 1: la conciliación de pagos (03-backlog:485), la caché de reportes (:592), la exportación asíncrona (:603), OpenTelemetry con Grafana LGTM (E9-H01) y el dashboard en tiempo real (E9-H02). Las preguntas de defensa y el guion de demo de F6 se hicieron en E9-H03 (`docs/defensa/`).

## 5. Puntos calientes de calidad

### 5.1 Funciones más complejas (complejidad ciclomática, ESLint `complexity`)

Sobre `apps/api/src`, `packages/shared/src` y `database/migrator/src`, con la configuración del repositorio.

| # | Función | Ubicación | Complejidad |
|---|---|---|---|
| 1 | `recorrerLinea` (separa lotes por `GO`, ignora comentarios y cadenas) | database/migrator/src/scripts.ts:103 | 13 |
| 2 | `actualizar` (parámetros opcionales del cupón) | apps/api/src/modules/cupones/cupones.repository.ts:96 | 12 |
| 3 | `resolverSegunPasarela` | apps/api/src/modules/checkout/checkout.conciliacion.ts:80 | 11 |
| 4 | `pagar` | apps/api/src/modules/checkout/checkout.pago.ts:324 | 11 |
| 5 | `aRegistro` (fila del intento → dominio) | apps/api/src/modules/checkout/checkout.repository.ts:105 | 11 |
| 6 | `archivo` (descarga de una exportación) | apps/api/src/modules/exportaciones/exportaciones.service.ts:83 | 11 |
| 7 | `actualizar` (configuración) | apps/api/src/modules/configuracion/configuracion.repository.ts:47 | 10 |
| 8 | `conectar` (stream SSE del dashboard) | apps/api/src/modules/reportes/reportes.eventos.ts | 9 |
| 9 | `anular` | apps/api/src/modules/checkout/checkout.pago.ts:120 | 8 |
| 10 | `actualizarIntento` | apps/api/src/modules/checkout/checkout.repository.ts:236 | 8 |

Empatan con 8 `parametrosCambios` (direcciones.repository.ts:50) y `ejecutarSPMultiple` (ejecutar-sp.ts:49). Ninguna otra pasa de 7.

### 5.2 Funciones más largas (líneas sin vacías ni comentarios, ESLint `max-lines-per-function`)

Las más largas son fábricas que agrupan los métodos de un servicio: el largo es la suma de sus métodos.

| # | Función | Ubicación | Líneas |
|---|---|---|---|
| 1 | `crearPagoService` | apps/api/src/modules/checkout/checkout.pago.ts:54 | 262 |
| 2 | `crearReembolsosService` | apps/api/src/modules/pedidos/pedidos.reembolsos.ts:56 | 169 |
| 3 | `crearDifusorDeVersiones` (SSE) | apps/api/src/modules/reportes/reportes.eventos.ts | 147 |
| 4 | `crearProcesadorExportaciones` | apps/api/src/modules/exportaciones/exportaciones.procesador.ts:50 | 140 |
| 5 | `crearCatalogoController` | apps/api/src/modules/catalogo/catalogo.controller.ts:89 | 128 |
| 6 | `crearAuthService` | apps/api/src/modules/auth/auth.service.ts:55 | 111 |
| 7 | `crearConciliacionService` | apps/api/src/modules/checkout/checkout.conciliacion.ts:38 | 99 |
| 8 | `iniciar` (arranque y apagado) | apps/api/src/server.ts:47 | 98 |
| 9 | `crearApp` | apps/api/src/app.ts:82 | 96 |
| 10 | `crearExportacionesService` | apps/api/src/modules/exportaciones/exportaciones.service.ts:32 | 84 |

### 5.3 SPs más largos (líneas sin vacías ni comentarios; ramas = IF + WHEN + WHILE)

| # | SP | Líneas | Ramas |
|---|---|---|---|
| 1 | SP_Semilla_GenerarDatosDemo (solo semilla) | 387 | 42 |
| 2 | SP_Pedidos_RegistrarDevolucion | 138 | 18 |
| 3 | SP_Checkout_IniciarSesion | 135 | 11 |
| 4 | SP_Carrito_Fusionar | 128 | 11 |
| 5 | SP_Checkout_RegistrarIntentoPago | 127 | 24 |
| 6 | SP_Pedidos_CrearPedido | 126 | 11 |
| 7 | SP_Carrito_Obtener | 111 | 13 |
| 8 | SP_Cupones_Actualizar | 106 | 17 |
| 9 | SP_Carrito_AgregarLinea | 98 | 14 |
| 10 | SP_Checkout_ResolverIntentoConciliado | 88 | 17 |

### 5.4 Duplicación

Barrido por ventanas de 6 líneas normalizadas sobre `apps/api/src` (sin vacías ni comentarios): 41 ventanas repetidas entre archivos; 34 son listas de `import`. Lo demás:

| Duplicación | Dónde | Estado |
|---|---|---|
| Esquema OpenAPI del sobre de paginación | 8 `*.routes.ts` | **Resuelto en 2d6f6fb:** `respuestaPaginadaSchema(fila)` en `shared/openapi`, con una prueba que impide declarar otro |
| La regla «desde ≤ hasta» con el mismo mensaje | `bitacora.schemas.ts`, `pedidos.schemas.ts`, `reportes.schemas.ts` | **Resuelto en d2b786e:** `rangoDeFechasSchema` en `shared/http`, extendido con `safeExtend` |
| La lista de los 5 reportes | `exportaciones.types.ts` y `reportes.cache.ts`, además del `CHECK` de `SolicitudExportacion.Reporte` | **Resuelto en a867a56:** `REPORTES_EXPORTABLES = REPORTES`; una prueba de integración exporta cada reporte, así que el `CHECK` no puede quedar atrás (dfda798) |
| Fragmentos de `registerPath` y la lista de dependencias de `crearApp` | `cupones.routes.ts`, `usuarios.routes.ts`; `app.ts` y `server.ts` | No es lógica: la forma de declarar OpenAPI y la firma de la composición |

### 5.5 Excepciones a las reglas de CLAUDE.md vigentes

Recorrido por AST de los archivos versionados de `apps/`, `packages/` y `database/migrator/src`.

| Regla | Excepción | Dónde | Justificación escrita |
|---|---|---|---|
| Sin `any`, `@ts-ignore`, `@ts-expect-error`, `eslint-disable` | Ninguna | — | — |
| Sin `!` de no nulo | Ninguno | — | — |
| Casts `as` en producción (sin `as const` ni `import … as`): 9 | `primero as T[]` | apps/api/src/shared/db/ejecutar-sp.ts:83 | El único cast de filas del backend (A-18, skill modulo-express §3) |
| | `… as Partial<T>` | apps/api/src/shared/db/index.ts:47 | «… es el mismo cast de ejecutarSP» |
| | `codigo as CodigoError` | apps/api/src/shared/errors/catalogo.ts | `Object.entries` pierde el tipo de la llave; las llaves salen del propio catálogo |
| | `Object.create(null) as Record<…>` | apps/api/src/shared/http/cookies.ts:6 | Objeto sin prototipo contra `__proto__` |
| | `entrada as Entrada<E>` | apps/api/src/shared/http/manejar.ts:71 | Tipos derivados de los esquemas que acaban de validar |
| | `ROLES_DE_USUARIO as readonly string[]` y `rol as RolDeUsuario` | apps/api/src/shared/http/token-acceso.ts | Ensancha para `includes` y estrecha tras verificar el valor |
| | `DOMINIOS_REPORTES as readonly string[]` | apps/api/src/modules/reportes/reportes.eventos.ts | Solo ensancha para `includes`; el guard estrecha el tipo |
| | `valor as (...args: unknown[]) => unknown` | apps/api/src/shared/observability/exportador-con-estado.ts | `typeof` ya comprobó que es una función; el cast le da una firma para enlazarla |
| Casts `as` en pruebas: 57 | Matchers asimétricos `as unknown`, `JSON.parse(...)` con forma, literales vacíos tipados, `address() as AddressInfo` y dobles de prueba parciales | `apps/api/test/**` | Patrón de las pruebas; no hay `any` |
| Prohibido concatenar en SQL | `CREATE DATABASE`, `ALTER DATABASE` y `CREATE/ALTER LOGIN` con `QUOTENAME` | database/migrator/sql/preparar-servidor.sql, recrear-base.sql | Excepción documentada (skill sqlserver-sp §11): identificadores y contraseñas no aceptan parámetros; `penalizaciones.test.ts` lo vigila |
| `console.log` | Ninguno en `src/` (solo dentro de cadenas que se ejecutan en un contenedor, en dos pruebas de entorno y humo) | — | — |

## 6. Seguridad

| Punto | Estado | Evidencia |
|---|---|---|
| Login: correo inexistente vs existente con contraseña incorrecta | Mismo trabajo de argon2 (con un correo inexistente verifica contra un hash de relleno); ambos `401` con el mismo cuerpo. Medición del 2 nov (40 intentos alternados por nginx): p50 35 vs 34 ms, p95 60 vs 62 ms; el código no cambió desde entonces | apps/api/src/modules/auth/auth.contrasenas.ts:13, :25 |
| Algoritmo del JWT fijado | HS256 al firmar y `algorithms: ['HS256']` al verificar; secreto de ≥ 32 caracteres validado al arrancar y rechazado si es el de ejemplo en `production` | apps/api/src/shared/http/token-acceso.ts:9, :67, :77; apps/api/src/shared/config/index.ts:14, :110 |
| Parámetros de argon2 | argon2id, 19 MiB, 2 iteraciones, paralelismo 1 (OWASP) | apps/api/src/modules/auth/auth.contrasenas.ts:4-9 |
| Cookie `refresh` | `HttpOnly`, `Secure`, `SameSite=Strict`, `Path=/api/v1/auth`, 7 días | apps/api/src/modules/auth/auth.controller.ts:33-38 |
| Cookie `carrito_invitado` | `HttpOnly`, `Secure`, `SameSite=Lax`, `Path=/api/v1`, 365 días (el carrito vence en la base por inactividad) | apps/api/src/modules/carrito/carrito.controller.ts:72-77, :87-89 |
| CORS | Lista de `CORS_ORIGINS`, `credentials: true`, nunca `*`; un origen fuera de la lista no recibe `Access-Control-Allow-Origin` | apps/api/src/app.ts:119; entorno/seguridad-http.test.ts |
| Encabezados | helmet (CSP con `frame-ancestors 'none'`, HSTS, nosniff, COOP, CORP, Referrer-Policy), sin `X-Powered-By`; nginx con `server_tokens off`, también en sus páginas de error | apps/api/src/app.ts:100-118; infra/nginx/nginx.conf:13; entorno/seguridad-http.test.ts |
| Errores | Un 500 responde solo `codigo`, `mensaje` y `requestId`, también con `NODE_ENV=development`; el detalle va al log | apps/api/src/shared/errors/middleware.ts:50-80; entorno/seguridad-http.test.ts |
| Límites de tamaño | JSON 100 KB en la API, 1 MB en nginx; un cuerpo comprimido ilegible responde 400 | apps/api/src/app.ts:46, :120; infra/nginx/nginx.conf:35 |
| Rate limiting | Login 5/min por IP y correo; registro 3/min por IP; cambio de contraseña 5/min por usuario; carritos de invitado 20/min por IP; exportaciones 10/min por usuario; SSE: máximo 3 streams por usuario y réplica. En Redis, compartido entre réplicas; con Redis caído, un contador en memoria por réplica | apps/api/src/server.ts:39-43; shared/adapters/limitador-redis.ts; modules/reportes/reportes.eventos.ts |
| Logs sin secretos | pino redacta contraseñas, tokens, cookies, tarjeta y CVV, también anidados; las trazas no llevan parámetros de SQL, argumentos de Redis, encabezados ni cuerpos | apps/api/src/shared/observability/logger.ts; telemetria/seguridad-trazas.test.ts |
| Usuario no root | API y migrador: `USER node`; SQL Server: `mssql`; Redis: `user: redis`; nginx: maestro root y workers `nginx` (imagen oficial). Grafana LGTM (perfil opcional) corre como root, publicado solo en `127.0.0.1` | apps/api/Dockerfile; database/migrator/Dockerfile; docker-compose.yml; entorno/contenedores.test.ts |
| Imágenes fijadas | Todas con versión exacta y digest: SQL Server `2022-CU27-GDR1-ubuntu-22.04`, Redis `7.4.12-alpine3.21`, Grafana LGTM `0.36.0`, Node `24.22.2-alpine3.24` (cada `FROM`) y nginx `1.28.3-alpine3.23` | Dockerfiles y docker-compose.yml; penalizaciones.test.ts |
| `pnpm audit` | 4 moderadas, 0 altas, 0 críticas. Producción: 3 moderadas, todas transitivas de `exceljs`: `uuid <11.1.1` (GHSA-w5hq-g745-h8pq, solo con el parámetro `buf`, que exceljs no usa) y `minimatch <11.0.1` (GHSA-g3hv-75wg-m249, vía `archiver`; los globs no vienen del cliente). Desarrollo: `minimatch` vía `eslint` | `pnpm audit` y `pnpm audit --prod`, 2 nov 2026 |
| Logins de SQL | `shopcart_app`: solo `EXECUTE` en `dbo`, con `DENY SELECT, INSERT, UPDATE, DELETE` sobre el esquema y sin roles. `shopcart_migrator`: `db_owner` de `ShopCart`, sin roles de servidor. `shopcart_busqueda` (sin login): solo `SELECT` sobre `VW_Catalogo_ProductosTienda`, y solo vía `EXECUTE AS` en `SP_Catalogo_BuscarProductos` | database/migrations/V001__base.sql; database/migrator/sql/preparar-base.sql, preparar-servidor.sql; V011__usuario_busqueda.sql |
| Aislamiento entre clientes | Barrido sobre el router real: 7 rutas de cliente con ID responden 404 con el ID de otro cliente; ninguna entrada de cliente acepta `idUsuario` y todos sus cuerpos son estrictos; toda ruta declara roles o es una pública conocida | integracion/seguridad/aislamiento.api.test.ts |
| Inmutabilidad demostrable | Bitácora, kardex e historial son ledger append-only; `pnpm ledger:verificar` guarda el digest fuera de la base y verifica con `sp_verify_database_ledger` | database/migrator/src/ledger.ts; database/migrator/test/integracion/ledger.test.ts |
| Secretos en el historial | Ningún `.env` real, llave privada ni token en todo el historial; el único `.env*` versionado es `.env.example`, con valores `EJEMPLO_…`. Ningún commit tiene `Co-Authored-By` ni «Generated with» | `git log --all -S` / `-G`, 2 nov 2026 |

## 7. Rendimiento

Medición del 2 de noviembre de 2026 sobre el código previo a E9. E9 no cambió los SPs de listados ni de reportes medidos aquí. Generador `SP_Semilla_GenerarDatosDemo @Pedidos = 50000, @Dias = 90` en una base desechable (`shopcart_carga`, migrada sin S006 y borrada después): 50 000 pedidos, 200 clientes, 108 825 movimientos de kardex, 109 628 filas de bitácora, conciliación vacía; tardó 21 min. 30 peticiones secuenciales por caso, cada una con una página o un rango de fechas distinto (los reportes nunca aciertan en la caché). "Directo": la API compilada en el host; "nginx": las dos réplicas de Docker a través de `http://127.0.0.1:8080`. Tiempos en ms, del lado del cliente.

| Listado o reporte | Semilla (1 500 pedidos) directo p95 | Semilla nginx p95 | 50k directo p50 / p95 | 50k nginx p50 / p95 / máx |
|---|---|---|---|---|
| Pedidos · cliente (mis pedidos, 269 del cliente) | 10 | 14 | 16 / 28 | 17 / 21 / 22 |
| Pedidos · gestión, primeras páginas | 34 | 35 | 29 / 43 | 29 / 41 / 233 |
| Pedidos · gestión, última página (OFFSET 49 800) | 24 | 30 | 320 / 811¹ | 326 / 373 / 374 |
| Pedidos · gestión, estado + fechas | 36 | 37 | 32 / 35 | 30 / 41 / 42 |
| Catálogo · búsqueda de la tienda | 20 | 21 | 13 / 26 | 14 / 19 / 19 |
| Catálogo · tienda por precio | 17 | 16 | 14 / 15 | 15 / 19 / 20 |
| Catálogo · administración | 24 | 25 | 17 / 30 | 18 / 34 / 40 |
| Inventario · kardex de una variante (450 movimientos) | 12 | 12 | 10 / 13 | 10 / 12 / 13 |
| Inventario · existencias | 19 | 19 | 17 / 19 | 18 / 24 / 24 |
| Bitácora · sin filtros (109 628 filas) | 15 | 17 | 29 / 45 | 33 / 39 / 39 |
| Bitácora · módulo Inventario + fechas (108 825) | 19 | 18 | 32 / 37 | 32 / 39 / 40 |
| Dashboard · resumen | 41 | 49 | 368 / 393 | 370 / 451 / 477 |
| Dashboard · ventas por día | 30 | 36 | 179 / 204 | 192 / 219 / 222 |
| Dashboard · ventas por mes | 28 | 26 | 211 / 239 | 202 / 223 / 235 |
| Dashboard · ventas por categoría | 31 | 23 | 168 / 193 | 167 / 193 / 195 |
| Dashboard · top productos | 19 | 22 | 155 / 203 | 153 / 189 / 210 |
| Dashboard · carritos abandonados | 15 | 12 | 13 / 17 | 12 / 15 / 15 |
| Reembolsos · listado (4 785) | 11 | 11 | 10 / 29 | 11 / 13 / 14 |
| Dashboard con la caché llena (misma consulta, 40 veces) | — | — | — | resumen 7 / 10; ventas 7 / 9 |

¹ En la primera ronda directa hubo un pico aislado de 9.6 s en esa página; 40 repeticiones posteriores dieron p50 315 ms, p95 358 ms y máx. 456 ms. Causa probable: la actualización automática de estadísticas tras la carga masiva. La última página cuesta ~320 ms porque `SP_Pedidos_Listar` arma cada fila antes de descartar las 49 800 anteriores; la de bitácora, ~350 ms.

**Resultado:** ningún listado ni reporte pasa de 1 s con 50 000 pedidos (RNF-1). Lo más lento es el dashboard sin caché (resumen, p95 451 ms a través de nginx) y las últimas páginas de listados grandes (~370 ms).

## 8. Riesgos

Ningún riesgo CRÍTICO ni ALTO abierto. Los que quedan:

| Riesgo | Origen | Estado | Evidencia |
|---|---|---|---|
| `SinCobro` anula una autorización vigente en la pasarela antes de la transacción; si el SP rechaza después (otra resolución ganó, o el pedido ya no se cancela), la autorización queda anulada y el intento sigue `EnRevision` | Revisión de E9-H04 | Aceptado por el PO: es el lado seguro (nunca queda dinero retenido) y otra resolución vuelve a consultar la pasarela | `pedidos.revision.ts` |
| Resolver a mano un reembolso `Fallido` no consulta la pasarela: si la pasarela sí lo había devuelto, el cliente recibiría dos veces | Revisión de E9-H04 | Aceptado por diseño: el Admin lo resuelve con la referencia de la devolución que hizo (decisión del PO) y queda en la bitácora | `R__SP_Pedidos_ResolverReembolso.sql` |
| La lista de pagos en revisión muestra al Admin la marca y los últimos 4 dígitos de la tarjeta | Revisión de E9-H04 | Aceptado: es lo mismo que guarda el pedido; nunca el número completo ni el CVV | `R__SP_Pedidos_ListarPagosEnRevision.sql` |
| `V023` cambia columnas, índices y `CHECK` de `Reembolso` en varios lotes; una falla a la mitad dejaría la tabla a medio migrar | Revisión de E9-H04 | Aceptado: se aplica una vez sobre una base que el migrador prueba desde cero en cada corrida | `database/migrations/V023__revision_manual_de_pagos.sql` |
| nginx es punto único de falla | E0-H05 | Aceptado: mejora de producción (Ingress o ALB) | 01:77 |
| Filas de un SP sin validar en ejecución (`as T[]`) | Revisión de E0 | Mitigado: política aceptada; montos convertidos con `aMonto` y probados | ejecutar-sp.ts:83; integracion/shared/montos.test.ts |
| Con Redis caído, la revocación por versión de sesión espera hasta 15 min | E2 (N-15) | Mitigado: acotado a la vida del access token | integracion/adaptadores/versiones-sesion.test.ts |
| Con Redis caído, el rate limiting pasa a memoria por réplica (el límite efectivo se duplica) | E2 | Mitigado: degradación documentada en 01 §10 | integracion/adaptadores/limitador-redis.test.ts |
| El cierre de un stream SSE por token vencido o sesión revocada llega en el siguiente latido (hasta 15 s) | Revisión de E9 | Aceptado y documentado en A-25 | reportes.eventos.ts (`revisar`) |
| La última página de listados grandes cuesta ~350 ms con 50k y crece lineal con el OFFSET | Rendimiento | Mitigado: bajo 1 s; candidato a paginar las llaves antes de armar las filas en `SP_Pedidos_Listar` | §7 |
| El filtro de carritos abandonados no tiene índice | Cierre de E6/E7 | Mitigado: 15 ms con 50k; el índice sigue en F5 | §7; 03-backlog:692 |
| 3 vulnerabilidades moderadas transitivas en producción (`uuid`, `minimatch` vía `exceljs`) | Verificación de entrega | Abierto: ninguna recibe entrada del usuario | §6 |
| `SP_Semilla_GenerarDatosDemo` es ejecutable por `shopcart_app`; lo protege `@RolActor = 'Sistema'`, que es un parámetro | Revisión de seguridad (cierre) | Aceptado: el mismo modelo de confianza de todos los SPs (A-18) e idempotente | R__SP_Semilla_GenerarDatosDemo.sql |

**Resueltos y verificados hasta este cierre** (no se repiten arriba): Redis como root (380fae3); SQL Server sin fijar (fa31800) y el resto de las imágenes sin digest (859d08d); el respaldo de `filter-branch` con `Co-Authored-By` (solo local, borrado); la documentación desalineada (3c09179, a2a841e, c365608, 047aa14); el sobre de paginación duplicado (2d6f6fb); los `.tmp` de exportaciones huérfanos (a0af0d6); desactivar todos los métodos de envío (d25ba49); el apagado con el mismo plazo que `docker stop` (029c3b6); el orden de capas sin lint (250d796); N-15 por acción, confirmado por el PO (0ea1585); la verificación criptográfica del ledger (5569ca7); el cliente que no podía cambiar lo que él mismo reservó y el cupón retirado por una reserva vencida propia (2502250, ab3a5b1); los hallazgos de la revisión de E9 (20b8356, 8c42bb5); la revisión manual de pagos `EnRevision` y de reembolsos `Fallido`, con la bitácora de `IntentoPago` y `Reembolso` (d2dda66); el cobro capturado sin reembolso posible si se cancelaba un pedido con el pago `EnRevision`, ahora prohibido por decisión del PO (ec10d1c); las contraseñas de ejemplo en el migrador (f18b635); la regla de rango de fechas y la lista de reportes duplicadas (d2b786e, a867a56).
