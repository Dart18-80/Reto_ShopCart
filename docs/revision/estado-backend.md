# Estado del backend (Fase 1)

Revisión sobre `a31c5d5` (2026-11-02), actualizada tras el pulido del mismo día (§0) y tras la épica E9 (§E9). Suites en verde en un clon nuevo con `core.autocrlf=true` sobre `2d6f6fb`: API 467 unitarias y 743 de integración, migrador 248 + 9, concurrencia 2 y entorno 16.

## E9. Observabilidad, tiempo real y defensa (2026-11-02)

Encargo del PO después del push de la Fase 1. Las tres historias quedan **En revisión**. Suites en verde en clones nuevos con `core.autocrlf=true`: lint, tipos y unitarias sobre `7433caf`; integración, concurrencia y entorno sobre `ee34fc8`, después del cual solo cambió documentación (proyecto `shopcart-e8`, entorno desde cero en 103 s):

| Suite | Sin el perfil `observabilidad` | Con el perfil |
|---|---|---|
| `pnpm lint` y `pnpm typecheck` | verde | — |
| API unitarias | 516 | — |
| Migrador | 249 + 9 de integración | 9 de integración |
| API integración (incluida la telemetría) | 750 + 5 | 755 |
| Concurrencia (RNF-3) | 2 | 2 |
| Entorno | 21 (2 omitidas: las del perfil) | 22 (1 omitida: la de sin perfil) |

El guion de demo (`docs/defensa/guion-demo.md`) se ensayó literal: los bloques de Bash se extrajeron del archivo y se ejecutaron, y el paso 7 encontró en Tempo la traza del 504 por su `requestId`.

| Tema | Cambio | Commit |
|---|---|---|
| E9-H01 | OpenTelemetry (`node --import`, trazas, métricas y logs por OTLP), perfil `observabilidad` con Grafana LGTM fijado por digest, dashboard aprovisionado, prueba de seguridad de trazas con la API compilada | 08a561e, 4f34cd0, 34a2439, ee34fc8 |
| E9-H02 | `GET /admin/reportes/eventos` (SSE, A-25): avisos por Redis pub/sub, agrupación, latido, 429, cierre por token, sesión y SIGTERM, `location` de nginx sin buffering | 675922d |
| Revisión de E9 (`revisor-shopcart`: 0 CRÍTICO y 0 ALTO; `typescript-reviewer`: 1 ALTO y 4 MEDIOS) | El ALTO: con Redis caído al arrancar, la réplica no se suscribía nunca a los avisos. Los MEDIOS: una versión leída al conectar se adelantaba a su aviso y se perdía, contadores de Redis perdidos, un stream abierto durante el apagado y el latido colgado de la traza de la primera petición. Todos corregidos con su prueba | 20b8356, 8c42bb5 |
| E9-H03 | `docs/defensa/`: índice, 15 módulos, 7 transversales, 30 preguntas difíciles y guion de demo; `defensa.test.ts` verifica que cada una de sus 1,701 citas siga en su línea | 37f0629 |
| Bugs que encontró la guía | Con el pago en curso, el cliente no podía cambiar la cantidad de lo que él mismo reservó (409); una reserva vencida y aún no liberada del propio carrito retiraba el cupón como agotado | 2502250, ab3a5b1 |
| Documentación | 01 y 02 alineados con el código: el 503 del health solo lo usa Docker, bitácora como ledger, índices de la búsqueda y de la bitácora, `manejar`, `LiberarArrendamiento` | c365608 |

## 0. Cambios del pulido (2026-11-02)

| Tema | Cambio | Commit |
|---|---|---|
| Historial | Borrado `refs/original/refs/heads/main` (respaldo de `filter-branch`), reflog expirado y `gc`: `git log --all` no muestra ningún `Co-Authored-By` | — (solo local) |
| Redis sin root | `user: redis` en el servicio; prueba de entorno: ningún proceso principal corre como root y Redis escribe en `/data` | 380fae3 |
| SQL Server fijado | `2022-CU27-GDR1-ubuntu-22.04@sha256:cf8f0ab2…` (16.0.4305.5, el CU que pasó las suites), con prueba y el procedimiento para actualizarlo en el README | fa31800 |
| `SP_Inventario_ReservarExistencia` | Interno, único que inserta en `Reserva` (JSON, bloqueo por `IDVariante`, todo o nada con 50301, renueva en su fila la reserva vencida de la misma sesión); lo llaman `SP_Checkout_IniciarSesion` y `SP_Pedidos_CrearPedido`. `test:concurrencia` tres veces en verde | f66a955 |
| Funciones de tabla | Las 14 `FU_` ya eran inline TVF; prueba de convención para que siga así | 2d8d25b |
| README | Decisiones abiertas del enunciado, exclusiones y mejoras, y la justificación de cada librería con la nota de `pnpm audit` | a2a841e |
| Documentación | Alineada con el código (§3): OpenTelemetry planificado para F5, L001 pendiente, A-11 con dos versiones, barrido resuelto, exportaciones y rutas en 01, objetos y triggers en 02 | 3c09179 |
| RNF-2 en el entorno | Con `api-1` detenida, 20 peticiones por nginx responden 200 desde `api-2` y nginx la reincorpora; con Redis detenido, un checkout vende la última unidad una vez y cobra una vez | 32bfffc |
| Duplicación | `respuestaPaginadaSchema(fila)` en `shared/openapi` para los 8 sobres de paginación (componente `Paginacion` en OpenAPI) | 2d6f6fb |

| § | Contenido |
|---|---|
| 0 | Cambios del pulido |
| 1 | Inventario por módulo |
| 2 | Matriz de criterios y pruebas |
| 3 | Coherencia entre documentos y código |
| 4 | Todo lo diferido |
| 5 | Puntos calientes de calidad |
| 6 | Seguridad |
| 7 | Rendimiento |
| 8 | Riesgos abiertos |

## 1. Inventario por módulo

Pruebas: número de casos (archivos). Las de integración se asignan por carpeta; las de `esquema/`, `seguridad/`, `adaptadores/`, `shared/` y `semillas/` van en la fila transversal. Cobertura con `@vitest/coverage-v8` sobre `apps/api/src`: líneas · ramas.

| Módulo | Endpoints | SPs | Tablas | Vistas | Funciones | Triggers | Unitarias | Integración | Cobertura unitaria | Cobertura integración |
|---|---|---|---|---|---|---|---|---|---|---|
| auth | 4 | 5 | RefreshToken | — | — | — | 15 (1) | 37 (3) | 75 % · 49 % | 100 % · 94 % |
| usuarios | 8 | 7 | Usuario, Rol | — | — | TR_Usuarios_Bitacora | 9 (1) | 56 (3) | 65 % · 37 % | 100 % · 80 % |
| direcciones | 7 | 6 | Direccion, Departamento, Municipio | — | — | — | 3 (1) | 48 (2) | 58 % · 21 % | 100 % · 96 % |
| catalogo | 26 | 24 | Categoria, Producto, ImagenProducto, Atributo, ValorAtributo, Variante, VarianteValorAtributo, PrecioVariante | VW_Catalogo_ProductosTienda | FU_Catalogo_CombinacionVariante, FU_Catalogo_HistorialVariante, FU_Catalogo_PatronBusqueda, FU_Catalogo_PrecioVigente | TR_Catalogo_CategoriaBitacora, TR_Catalogo_ProductoBitacora, TR_Catalogo_VarianteBitacora, TR_Catalogo_PrecioVarianteBitacora | 15 (1) | 89 (7) | 54 % · 8 % | 100 % · 90 % |
| inventario | 6 | 9 | MovimientoKardex, TipoMovimiento | VW_Inventario_Conciliacion, VW_Inventario_ExistenciaBodega | FU_Inventario_Disponible, FU_Inventario_Movimientos | — | 3 (1) | 37 (4) | 60 % · 0 % | 100 % · 94 % |
| carrito | 7 | 11 | Carrito, LineaCarrito | VW_Carrito_Abandonados | FU_Carrito_Activo, FU_Carrito_Lineas | — | 14 (1) | 115 (8) | 53 % · 25 % | 98 % · 86 % |
| cupones | 6 | 8 | Cupon, UsoCupon | VW_Cupones_Admin | FU_Cupones_CalculoDescuento, FU_Cupones_RestriccionViolada, FU_Cupones_Validar | TR_Cupones_Bitacora | 3 (1) | 34 (1) | 64 % · 10 % | 100 % · 92 % |
| envios | 2 | 2 | MetodoEnvio | — | FU_Envios_Costos, FU_Envios_EnvioGratis | TR_Envios_Bitacora | 2 (1) | 0 (0)¹ | 60 % · 13 % | 98 % · 87 % |
| configuracion | 2 | 2 | ParametroSistema | — | — | TR_Configuracion_Bitacora | 0 (0) | 11 (1) | 61 % · 0 % | 100 % · 96 % |
| checkout | 4 | 11 + 4 `SP_Pasarela_*` | SesionCheckout, LineaSesionCheckout, Reserva, IntentoPago, PasarelaAutorizacion, PasarelaReembolso | — | — | — | 49 (3) | 73 (5) | 70 % · 49 % | 87 % · 79 % |
| pedidos | 9 | 14 | Pedido, DetallePedido, Devolucion, DetalleDevolucion, Reembolso, HistorialEstadoPedido, EstadoPedido, TransicionEstadoPedido | VW_Pedidos_Historial | — | TR_Pedidos_Bitacora, TR_Pedidos_ValidarTransicion | 19 (2) | 50 (5) | 59 % · 31 % | 92 % · 73 % |
| reportes | 5 | 5 (`SP_Dashboard_*`) | — (lee vistas) | VW_Dashboard_HechosVenta, VW_Dashboard_VentasPorCategoria | — | — | 14 (1) | 14 (2) | 83 % · 52 % | 97 % · 83 % |
| bitacora | 1 | 1 | Bitacora | — | — | — | 1 (1) | 14 (3) | 70 % · 0 % | 100 % · 100 % |
| exportaciones | 4 | 9 | SolicitudExportacion, EstadoExportacion | VW_Exportaciones_Solicitudes | — | — | 38 (4) | 10 (1) | 76 % · 60 % | 83 % · 68 % |
| sistema | 1 | 5 | SolicitudIdempotente | — | FU_Sistema_FechaLocal | — | 8 (1) | 1 (1) | 82 % · 62 % | 92 % · 50 % |
| shared, app y transversales | — | 1 (`SP_Semilla_GenerarDatosDemo`) | HistorialMigracion (migrador) | — | — | — | 271 (26) | 149 (16) | 80 % · 74 % | 73 % · 64 % |
| **Total API** | **92** | **124** | **41** | **9** | **14** | **10** | **467 (47)** | **743 (63)** | **69 % · 44 %** | **89 % · 77 %** |
| Migrador (`database/migrator`) | — | — | — | — | — | — | 248 | 9 | 70 % · 83 % | — |

¹ Los casos de envíos viven en `test/integracion/carrito/envios.api.test.ts` y `secuencial/configuracion-envios.api.test.ts` (contados en carrito y configuración).

Además: 2 pruebas de concurrencia (`test/concurrencia`, RNF-3) y 16 de entorno (`test/entorno`: seguridad HTTP, contenedores sin root y RNF-2); tras E9, 23 de entorno con observabilidad y tiempo real (§E9). Los conteos por módulo y la cobertura son de la revisión; los totales, del pulido. Los SPs de prueba `database/test/R__SP_Pruebas_*` solo existen en `shopcart_test` y no se cuentan.

## 2. Matriz de criterios y pruebas

Rutas relativas a `apps/api/test/`, salvo las que empiezan con `database/`. Los criterios de RF-01 a RF-09 están en `docs/enunciado-shopcart.md` §04; los RNF, en `docs/00-vision-y-contexto.md`.

| Requisito | Criterio | Prueba (archivo › caso) | Tipo |
|---|---|---|---|
| RF-01 | Cambiar el ID de un pedido, carrito o dirección no expone ni modifica datos de otro cliente | `integracion/seguridad/aislamiento.api.test.ts` › "%s: el recurso de otro cliente responde 404, igual que uno inexistente" (cada ruta de cliente con ID), "cada ruta de cliente que recibe un ID tiene su caso de aislamiento, y ningún caso sobra", "los intentos del otro cliente no cambiaron nada del dueño", "ninguna ruta de cliente acepta idUsuario en su entrada y todos sus cuerpos son estrictos", "toda ruta declara sus roles o es una de las públicas conocidas" | integración |
| RF-01 | Ídem, por recurso | `integracion/pedidos/consulta.api.test.ts` › "el pedido de otro cliente responde 404, igual que uno inexistente"; `integracion/carrito/carrito.api.test.ts` › "la línea de otro cliente responde 404 en PATCH y DELETE, y no cambia"; `integracion/direcciones/direcciones.api.test.ts` › "RF-01: un cliente que usa el ID de una dirección de otro recibe 404 al leerla, editarla o borrarla" y "A-02: el SP rechaza editar o borrar una dirección ajena aunque el servicio no la haya filtrado"; `integracion/checkout/iniciar-sesion.api.test.ts` › "carrito vacío → 422; dirección ajena o método inexistente → 404"; `integracion/checkout/pagar.api.test.ts` › "la llave de otro cliente responde 422 (sin revelar de quién es)" | integración |
| RF-01 | El actor sale del contexto, nunca del llamador | `unit/shared/db/ejecutar-sp.test.ts` › "RF-01: rechaza que el llamador envíe un parámetro estándar" y "A-18: con peticiones concurrentes, cada SP recibe el actor de su propia petición"; `unit/shared/http/contexto.test.ts` › "RF-01: entrega el contexto en solo lectura; solo establecerUsuario cambia el usuario" | unitaria |
| RF-01 | Token expirado → 401; recurso no permitido → 403 | `unit/shared/http/autenticar.test.ts` › "un token vencido responde 401"; `integracion/catalogo/productos.api.test.ts` › "un Cliente o un Operador recibe 403 en cada ruta de administración, y sin token 401"; `integracion/pedidos/consulta.api.test.ts` › "un Cliente no entra a la gestión (403)" | unitaria + integración |
| RF-02 | Un cambio de precio no altera los pedidos ya realizados | `integracion/pedidos/consulta.api.test.ts` › "un cambio de precio posterior no altera el monto de un pedido ya realizado"; `integracion/checkout/iniciar-sesion.api.test.ts` › "un cambio de precio posterior no afecta la sesión" | integración |
| RF-03 | La existencia coincide con la suma del kardex | `integracion/inventario/inventario.api.test.ts` › "CA: tras movimientos simultáneos, el saldo cuadra con el kardex y la conciliación no muestra la variante"; `integracion/semillas/datos-demo.test.ts` › "kardex, pedidos e historial coinciden en el tiempo y la conciliación de inventario queda vacía"; `concurrencia/checkout.concurrencia.test.ts` › escenario 1 (exige la conciliación vacía) | integración + concurrencia |
| RF-03 | Un ajuste exige motivo y no deja la existencia en negativo | `integracion/inventario/inventario.api.test.ts` › "CA: un ajuste %s responde 400 MOTIVO_REQUERIDO, igual que una entrada", "CA: un ajuste que deja la existencia negativa responde 422 AJUSTE_DEJA_NEGATIVO", "dos ajustes negativos a la vez que juntos bajan de cero: uno pasa y el otro 422 AJUSTE_DEJA_NEGATIVO" | integración |
| RF-04 | No se agrega más que lo disponible | `integracion/carrito/carrito.api.test.ts` › "no se puede agregar más de lo disponible y un invitado nuevo no deja un carrito vacío", "PATCH cambia la cantidad; por encima de lo disponible responde 409 y no cambia", "cinco sumas simultáneas de 2 unidades con 5 disponibles nunca pasan de 5" | integración |
| RF-04 | El total no tiene errores de redondeo | `integracion/carrito/carrito.api.test.ts` › "cuadran al centavo con DECIMAL y viajan como texto"; `integracion/carrito/cupon.api.test.ts` › "Q10.00 entre tres líneas iguales: el centavo sobrante va a la primera (desempate por IDLinea)"; `unit/shared/dinero/monto.test.ts` › "redondea a 2 decimales un promedio periódico (1.666… → 1.67)" | integración + unitaria |
| RF-05 | Cupón vencido, agotado o bajo el mínimo → mensaje específico | `integracion/carrito/cupon.api.test.ts` › "%s responde %s (422) con su mensaje", "agotado responde CUPON_AGOTADO", "el mínimo no alcanzado indica cuánto falta"; `integracion/semillas/datos-demo.test.ts` › "hay un cupón para demostrar cada mensaje de rechazo de RF-05" | integración |
| RF-05 | El límite total se respeta con clientes simultáneos | `concurrencia/checkout.concurrencia.test.ts` › "escenario 2: 20 clientes por el último uso de un cupón → 1 pedido con cupón y 19 × 422 CUPON_AGOTADO"; `integracion/checkout/iniciar-sesion.api.test.ts` › "el cupón con un solo uso y cinco clientes simultáneos: uno lo reserva y cuatro reciben 422 CUPON_AGOTADO" | concurrencia + integración |
| RF-05 | El total nunca queda bajo cero | `integracion/carrito/cupon.api.test.ts` › "un monto fijo mayor que el subtotal deja el total en cero, nunca negativo" | integración |
| RF-06 | Última unidad: compra uno, el otro recibe un mensaje claro, nunca hay sobreventa | `concurrencia/checkout.concurrencia.test.ts` › "escenario 1: 20 clientes por la última unidad → 1 pedido y 19 × 409 STOCK_INSUFICIENTE"; `integracion/checkout/iniciar-sesion.api.test.ts` › "todo o nada: si una línea no alcanza, 409 con el disponible y ninguna reserva ni uso del cupón" | concurrencia + integración |
| RF-06 | Repetir el pago no genera dos pedidos ni dos cobros | `integracion/checkout/pagar.api.test.ts` › "doble clic con la misma llave: un solo pedido y un solo cobro; el reintento recibe el mismo pedido", "4000…0119: 504 PAGO_SIN_CONFIRMAR con el arrendamiento liberado; el reintento completa con un solo cobro", "dos retomas simultáneas del mismo intento: solo una avanza"; `integracion/checkout/vigencia-del-pago.api.test.ts` › "con un token que otro proceso ya reemplazó, ni se actualiza, ni se libera, ni se renueva el intento" | integración |
| RF-06 | La creación del pedido es atómica | `integracion/checkout/pago-fallas.api.test.ts` › "si el pedido falla dentro del SP no queda pedido, detalle, kardex ni cupón confirmado, y se anula la autorización", "se revierten la salida del kardex, la existencia, las reservas, el cupón, la sesión y el carrito" | integración |
| RF-07 | Transición no permitida rechazada en el backend y en la base | `integracion/pedidos/estados.api.test.ts` › "primera capa (backend): saltar un estado responde 409 TRANSICION_INVALIDA sin tocar la base", "segunda capa (SP): …", "tercera defensa (trigger): un UPDATE directo con una transición inválida se revierte", "cada (origen, destino, rol) del mapa está en la tabla y viceversa" | integración |
| RF-07 | Cancelar o devolver reintegra la existencia y se ve en los reportes | `integracion/pedidos/cancelacion.api.test.ts` › "desde Pagado: Cancelado, reingreso al kardex, cupón revertido y reembolso del total con envío"; `integracion/pedidos/devoluciones.api.test.ts` › "parcial: DevueltoParcial, reingreso al inventario y reembolso del precio pagado de esa línea"; `integracion/reportes/cache.api.test.ts` › "cancelar un pedido se ve en el reporte", "una devolución se ve en el reporte" | integración |
| RF-07 | Una reserva vencida libera la existencia sola | `integracion/secuencial/tareas-periodicas.test.ts` › "una sesión vencida pasa a Expirada y libera sus reservas y el uso del cupón" | integración |
| RF-07 | No se devuelve más de lo vendido | `integracion/pedidos/devoluciones.api.test.ts` › "no se devuelve más de lo vendido: 422 DEVOLUCION_EXCEDE_VENDIDO con lo que queda por línea" | integración |
| RF-07 | Cada cambio de estado registra quién, cuándo, de qué a qué | `integracion/pedidos/estados.api.test.ts` › "recorre Pagado → EnPreparacion → Despachado → Entregado y registra quién, cuándo, de qué a qué y por qué" | integración |
| RF-08 | Paginación y filtros en el servidor | `integracion/pedidos/consulta.api.test.ts` › "filtra por cliente y por estado, con el cliente de cada pedido", "el rango de fechas usa FechaPagoLocal (días de Guatemala), con los extremos incluidos"; `integracion/secuencial/paginacion.api.test.ts` (5 listados y kardex); `integracion/secuencial/bitacora-paginacion.api.test.ts` | integración |
| RF-08 | Reportes sin cancelados y con devoluciones descontadas | `integracion/reportes/dashboard.api.test.ts` › "el resumen cuenta pedidos no cancelados en su día de pago: …", "las devoluciones se restan en su propio día de Guatemala (05:59 UTC → día anterior; 06:00 → mismo día)", "ventas por categoría y top productos del periodo" | integración |
| RF-09 | La bitácora no se modifica ni se elimina | `integracion/esquema/ledger.test.ts` › "%s rechaza %s" (Bitacora, MovimientoKardex e HistorialEstadoPedido × Modificar/Eliminar, error 37359) | integración |
| RF-09 | Cada registro guarda usuario, fecha, entidad, acción y valores anterior y nuevo | `integracion/esquema/bitacora.test.ts` › "un cambio de precio registra usuario, fecha, entidad, acción, precio anterior y nuevo", "la creación de un usuario nunca registra su HashContrasena" | integración |
| RNF-1 | Listados y reportes < 1 s con volumen alto | Medición manual con 50 000 pedidos (§7). Aserción parcial con poco volumen: `integracion/reportes/dashboard.api.test.ts` › "cada reporte responde en menos de 1 s (RNF-1)" | manual + integración |
| RNF-1 | Semilla de volumen medio | `integracion/semillas/datos-demo.test.ts` › "1,500 pedidos de ~200 clientes en los últimos 90 días, con cancelaciones, devoluciones y carritos abandonados" | integración |
| RNF-2 | API stateless con 2 réplicas; estado en SQL Server o Redis | `concurrencia/checkout.concurrencia.test.ts` (exige respuestas de `api-1` y `api-2`); `integracion/reportes/cache.api.test.ts` › "crear un pedido en una réplica se ve de inmediato en el reporte de la otra"; `integracion/usuarios/usuarios.api.test.ts` › "A-07: dos réplicas ven la misma versión: …"; `integracion/adaptadores/limitador-redis.test.ts` › "el contador vive en Redis: dos réplicas comparten los intentos"; `integracion/secuencial/exportaciones.api.test.ts` › "el archivo que generó una réplica se descarga desde la otra, …", "una réplica que muere a mitad: otra la retoma al vencer el arrendamiento y queda un solo archivo" | concurrencia + integración |
| RNF-2 | Redis caído: se degrada sin vender de más | `unit/modules/sistema/health.api.test.ts` › "con Redis detenido responde 200 con redis: \"degradado\""; `integracion/adaptadores/limitador-redis.test.ts` › "con Redis caído cae al contador en memoria: …"; `integracion/reportes/cache.api.test.ts` › "con Redis caído el reporte responde igual, desde la base"; `entorno/rnf2.test.ts` › "con Redis detenido, un checkout completo vende la última unidad una sola vez y cobra una sola vez" | unitaria + integración + entorno |
| RNF-2 | Los jobs corren en una sola réplica (`sp_getapplock`) | `integracion/secuencial/tareas-periodicas.test.ts` › "si la otra réplica tiene el bloqueo, retorna sin hacer nada"; `unit/shared/jobs/planificador.test.ts` › "no superpone dos ejecuciones de la misma tarea en una réplica" | integración + unitaria |
| RNF-2 | Con `api-1` detenida todo responde desde `api-2` | `entorno/rnf2.test.ts` › "con api-1 detenida, 20 peticiones seguidas a través de nginx responden 200 desde api-2" (y nginx la reincorpora al volver) | entorno |
| RNF-3 | 20 checkouts por la última unidad / 20 usos del último cupón → 1 éxito | `concurrencia/checkout.concurrencia.test.ts` › escenarios 1 y 2 | concurrencia |
| RNF-4 | Logs JSON sin secretos | `unit/shared/observability/logger.test.ts` › "redacta contraseñas, tarjeta, CVV, authorization y cookies, también anidados"; `integracion/auth/registro-login.api.test.ts` › "registro, login y un error de credenciales no dejan secretos en el log" | unitaria + integración |
| RNF-4 | `requestId` hasta los SPs | `integracion/shared/contexto-de-sesion.test.ts` › "deja en SESSION_CONTEXT el usuario, el rol y el RequestId de la petición" | integración |
| RNF-4 | `/health` verifica la base con un SP | `integracion/sistema/health.api.test.ts` › "responde 200 con la base en ok tras ejecutar el SP_Sistema_Health real"; `unit/modules/sistema/health.api.test.ts` › "con la base caída responde 503 para que el balanceador saque la réplica" | integración + unitaria |
| RNF-4 | Trazas OpenTelemetry y Grafana LGTM | `telemetria/seguridad-trazas.test.ts` (nada sensible en lo exportado; la traza del pago llega a sus SPs y a la pasarela); `entorno/observabilidad.test.ts` (sin el perfil, una advertencia por señal; con el perfil, la compra en Tempo y sus logs en Loki) | telemetría, entorno |
| Enunciado §05/§08 | Seguridad HTTP | `entorno/seguridad-http.test.ts` (helmet, CORS, sin versión, 500 sin stack) | entorno |
| Enunciado §05/§08 | Sin SQL en el backend, sin concatenación, sin tipos prohibidos | `database/migrator/test/penalizaciones.test.ts` › "ningún archivo TypeScript del backend contiene una sentencia SQL", "§08: el texto de un SQL dinámico nunca concatena valores, …", "§05: ningún FLOAT, REAL, MONEY, …" | unitaria (migrador) |
| Enunciado §05 | Migración idempotente, `V###` inmutable, la app no lee tablas | `database/migrator/test/integracion/migrador.test.ts` › "ejecutarlo dos veces seguidas no aplica nada la segunda vez", "modificar un V### ya aplicado hace fallar el migrador con un mensaje claro", "ejecuta SP_Sistema_Health, pero un SELECT directo a una tabla devuelve error de permisos" | integración (migrador) |

## 3. Coherencia entre documentos y código

### 3.1 Endpoints de 01 vs el router

64 de los 65 endpoints explícitos de 01 §5.2 y A-24 están en el router. El router registra 92 rutas: 64 coinciden con 01, 22 solo caben en los resúmenes «…» del catálogo y 6 no aparecen en 01.

| Endpoint | En 01 | En el router | Nota |
|---|---|---|---|
| `GET /docs` | Sí (§5.2, fila `sistema`) | Como `/api/docs` y `/api/docs/openapi.json`, fuera de `/api/v1` (apps/api/src/app.ts:158, :161) | Con la base `/api/v1` de §5.1 la fila se leería como `/api/v1/docs`; `openapi.json` no figura en 01 |
| `GET /direcciones/:id` | No | direcciones.routes.ts:105 | Su criterio de aceptación de E2-H05 la supone |
| `GET /inventario/bodega` | No | inventario.routes.ts:117 | Could de E3-H06; su SP sí está en 02 §5 |
| `POST /admin/pedidos/:id/cancelar` | No | pedidos.routes.ts:190 | E6-H03: «Operador lo mismo desde gestión», sin la ruta |
| `GET /admin/exportaciones`, `GET /admin/exportaciones/:id`, `GET /admin/exportaciones/:id/archivo` | No (01 solo cita el `POST` en A-24) | exportaciones.routes.ts:51-53 | Alcance de E7-H05; el módulo `exportaciones` tampoco está en 01 §4.2 ni §5.2 |
| `GET /admin/productos`, `GET /admin/productos/:id` | No: 01 dice «`POST/PATCH/DELETE /admin/productos…`» | catalogo.routes.ts:354-355 | E3-H03 |
| `PUT /admin/productos/:id/imagenes`, `POST /admin/productos/:id/variantes` | Solo dentro de «…» | catalogo.routes.ts:361-362 | Ningún documento los escribe con su método |
| `GET /admin/variantes/:id/precios` y el resto de `/admin/variantes…`, `/admin/categorias…`, `/admin/atributos…` | Solo como resumen «…» | catalogo.routes.ts:344-369 | E3-H01 a E3-H04 |

### 3.2 Catálogo de SPs de 02 vs database/

123 de los 124 SPs de 02 §5 existen, y los 123 `R__SP_*` están en §5. Vistas: 8 de 9 en 02. Funciones: 11 de 14. Triggers: 1 de 10 con su nombre (los otros 9 se describen por tabla en §3.10 y las tablas coinciden). Los 110 SPs que la API invoca por nombre existen. No se cuentan los 85 objetos de `database/test/`.

| Objeto | En 02 | En database/ |
|---|---|---|
| `SP_Inventario_ReservarExistencia` | Sí (§5, «interno, nombre del enunciado») | **Resuelto en f66a955:** existe y es el único que inserta en `Reserva` |
| `VW_Cupones_Admin` | No | `R__VW_Cupones_Admin.sql` (la usan `SP_Cupones_Listar` y `SP_Cupones_Obtener`) |
| `VW_Exportaciones_Solicitudes` | Solo en §5, no en la tabla de §4 | `R__VW_Exportaciones_Solicitudes.sql` |
| `FU_Catalogo_PatronBusqueda` | No | `R__FU_Catalogo_PatronBusqueda.sql` (A-10) |
| `FU_Cupones_RestriccionViolada` | No | `R__FU_Cupones_RestriccionViolada.sql` |
| `FU_Inventario_Movimientos` | No | `R__FU_Inventario_Movimientos.sql` |
| 9 triggers `TR_*_Bitacora` | Sin nombre (descritos por tabla en §3.10) | `database/programmability/R__TR_*_Bitacora.sql` |
| `TR_Bitacora_Inmutable` | Solo como ejemplo de nomenclatura en §1.1 | **Resuelto en 3c09179:** el ejemplo ahora es `TR_Pedidos_ValidarTransicion`; el resto de las vistas, funciones y triggers de esta tabla también se documentaron en 02 |

### 3.3 Códigos de 02 §8 vs catalogo.ts

63 de 63 códigos coinciden en nombre, número y HTTP. 49 números se lanzan desde un SP y los 49 tienen su `numeroSql` (43 con `THROW` literal; 6 por `THROW @NumeroError` desde `FU_Cupones_Validar`).

| Código | 02 §8 | catalogo.ts | THROW en SPs | Diferencia |
|---|---|---|---|---|
| `PAGO_RECHAZADO` | 50604 (402) | `numeroSql: 50604` (catalogo.ts:190) | Ninguno | Nace en la API (checkout.pago.ts:373); `catalogo.ts:3` dice que `numeroSql` se omite en ese caso |
| `PAGO_SIN_CONFIRMAR` | 50606 (504) | `numeroSql: 50606` (catalogo.ts:197) | Ninguno | Igual (checkout.pago.ts:249) |
| `PAGO_NO_COMPLETADO` | 50607 (409) | `numeroSql: 50607` (catalogo.ts:204) | Ninguno | El SP lo guarda como texto en `CodigoRespuesta` (R__SP_Checkout_ResolverIntentoConciliado.sql:86) |

### 3.4 IDs citados en comentarios que no existen en docs/

59 IDs distintos citados en `apps/`, `packages/` y `database/` (A-01 a A-24 salvo A-03 y A-17; M-01, M-03, M-04, M-07, M-08; N-01 a N-19; RF-01 a RF-09; RNF-1 a RNF-4). Los 59 están definidos (los RF en `docs/enunciado-shopcart.md`). Ningún archivo cita un D-xx.

Sin diferencias.

### 3.5 Decisiones de docs/ que no están implementadas

60 decisiones (D-01 a D-05, RNF-1 a RNF-4, N-01 a N-19, A-01 a A-24, M-01 a M-08), todas ✅ salvo N-02 ✏️. 55 con evidencia completa de su parte de Fase 1; las de la tabla son parciales, diferidas o con texto desalineado.

| ID | Decisión (resumen) | Estado en docs | Evidencia en el código o «no encontrada» |
|---|---|---|---|
| RNF-1 | Semilla media + script opcional de 50k pedidos | Carga pesada en F5 | Semilla: `S006__datos_demo.sql`. **No encontrada:** `database/load/L001__carga_pesada.sql` (la carpeta solo tiene `.gitkeep`), aunque 02 §7 la lista como existente. La medición de §7 usó el mismo generador en una base desechable |
| RNF-2 | Redis «solo contadores de rate limiting y caché de reportes» | Sin estado | Implementada; Redis guarda además la versión de sesión (`versiones-sesion-redis.ts`, A-07), que 01 §3 sí menciona |
| RNF-4 | OpenTelemetry + Grafana LGTM (perfil `observabilidad`) | ✅ | Implementado en E9-H01 (§E9) |
| A-16 | Librerías, incluida OpenTelemetry; «cada una se justifica en el README» | ✅ | Los paquetes `@opentelemetry` e `import-in-the-middle` están en `apps/api/package.json` con su versión en A-16 y en la tabla del README (E9-H01) |
| A-03 / A-07 / A-08 | nginx sirve la SPA; access token en memoria del frontend; esquemas compartidos con el frontend | ✅ | La parte del backend está; la SPA es un placeholder de Fase 2 (`apps/web/public/index.html`) |
| A-11 | Caché de reportes con una versión | ✅ | El código usa una versión por dominio (`reportes.cache.ts`); el texto de A-11 quedó desactualizado frente a 01 §9 |
| A-24 | Exportación asíncrona + barrido de huérfanos | ✅ | Implementada; `docs/04-verificacion-fase-1.md:41` todavía dice «Abierto: … requiere decidir un barrido» |
| N-03 | «Capturar al despachar» como mejora | ✅ | No figura en README §8 |
| N-04 | Tarifa por zona «como mejora documentada en el README» | ✅ | No figura en el README |
| N-06 / N-10 / N-16 | Límite de compra por cliente, solicitud de devolución del cliente, costo y valoración del inventario | ✅ | Exclusiones o mejoras que no figuran en README §8 |
| N-18 | FEL de la SAT fuera de alcance «(mencionado en el README)» | ✅ | **No encontrado** en el README |
| M-01 | Ledger + verificación criptográfica para la defensa | ✅ | Ledger en V005, V008 y V009, probado en `esquema/ledger.test.ts`. Verificar: ningún script ejecuta `sp_verify_database_ledger` |
| D-04 | Kubernetes diferido | Diferida | Sin manifiestos, como se espera; está en README §8 |

## 4. Todo lo diferido

| Ítem | Estado o fase | Dónde está escrito |
|---|---|---|
| Frontend SPA (Vite + React): tienda, backoffice y dashboard | Fase 2 (F1–F4) | 00:53; 03-backlog §4 (:643-652); README:5, :331; 01:498, :521 |
| Pantallas de revisión manual de pagos (`EnRevision`, reembolsos `Fallido`) | Fase 2 (hoy solo API) | README:336 |
| OpenTelemetry, trazas y Grafana LGTM (perfil `observabilidad`) | **Hecho en E9-H01** | §E9 |
| Script de carga pesada (`database/load/L001`) | F5 (el generador ya acepta `@Pedidos`) | 00:157; 02 §7; 03-backlog:653; README:334 |
| Índice para el filtro de carritos abandonados | F5 | 03-backlog:653; README:334 |
| Correo (puerto `Notificador` + Mailpit): exportación terminada y recuperar contraseña | Fuera de la Fase 1 | 00:196 (N-15); README:332; planes/E7-H05:103 |
| Dashboard en tiempo real (SSE) | **Hecho en E9-H02** (falta la pantalla: Fase 2) | §E9; 01 A-25 |
| Pasarela real (adaptador y webhooks firmados) | Mejora documentada | README:337; 00:174 (N-03); 01:570 |
| Captura al despachar | Mejora documentada | 00:174 (N-03); 01:570 |
| Kubernetes | Diferido (D-04) | 00:151; 01:83, :572; README:338 |
| Producción: SQL Server con licencia, HTTPS, secretos en un vault | Mejora documentada | README:339; 01:467, :572 |
| nginx punto único de falla → Ingress o ALB | Mejora de producción | 01:77 |
| Almacén de exportaciones en S3 o Azure Blob | Mejora de producción | 01:557 (A-24); planes/E7-H05:47; docker-compose.yml:48 |
| Tarifa de envío por zona | Mejora documentada | 00:175 (N-04) |
| Límite de compra por cliente | Fuera de alcance | 00:177 (N-06) |
| Solicitud de devolución por el cliente | Mejora documentada | 00:186 (N-10) |
| Agregar una dimensión de atributos a un producto con historial | Fuera de alcance | 00:195 (N-14) |
| Costo y valoración del inventario | Mejora documentada | 00:197 (N-16) |
| Factura electrónica FEL | Fuera de alcance | 00:199 (N-18) |
| Full-Text Search u OpenSearch | Mejora documentada (A-10) | 01:542, :571 |
| Vistas indexadas o agregados para el dashboard | Si el sistema crece | 01:565 |
| Invalidar `carritos` solo si el carrito ya estaba abandonado | Si el sistema crece | 01:566 |
| Particionar y archivar kardex y bitácora | Si el sistema crece | 01:567 |
| Jobs en un worker aparte; outbox → broker | Si el sistema crece | 01:568 |
| Caché del catálogo y réplica de lectura | Si el sistema crece | 01:569 |
| F6: README final, ensayo de la demo, preguntas de defensa | Fase 2 | 03-backlog:654 |
| Aprobación del PO de E7-H04, E7-H05 y E8 | En revisión | 03-backlog:703-707 |

La conciliación de pagos, la caché de reportes y la exportación asíncrona estaban en F5 y pasaron a la Fase 1 (03-backlog:483, :590, :601).

## 5. Puntos calientes de calidad

### 5.1 Funciones más complejas (complejidad ciclomática, ESLint `complexity`)

| # | Función | Ubicación | Complejidad |
|---|---|---|---|
| 1 | `recorrerLinea` (separa lotes por `GO`, ignora comentarios y cadenas) | database/migrator/src/scripts.ts:103 | 13 |
| 2 | `actualizar` (parámetros opcionales del cupón) | apps/api/src/modules/cupones/cupones.repository.ts:96 | 12 |
| 3 | `archivo` (descarga de una exportación) | apps/api/src/modules/exportaciones/exportaciones.service.ts:83 | 11 |
| 4 | `aRegistro` (fila del intento → dominio) | apps/api/src/modules/checkout/checkout.repository.ts:105 | 11 |
| 5 | `pagar` | apps/api/src/modules/checkout/checkout.pago.ts:324 | 11 |
| 6 | `resolverSegunPasarela` | apps/api/src/modules/checkout/checkout.conciliacion.ts:80 | 11 |
| 7 | `actualizar` (configuración) | apps/api/src/modules/configuracion/configuracion.repository.ts:47 | 10 |
| 8 | `ejecutarSPMultiple` | apps/api/src/shared/db/ejecutar-sp.ts:49 | 8 |
| 9 | `parametrosCambios` | apps/api/src/modules/direcciones/direcciones.repository.ts:50 | 8 |
| 10 | `actualizarIntento` | apps/api/src/modules/checkout/checkout.repository.ts:236 | 8 |

### 5.2 Funciones más largas (líneas sin vacías ni comentarios, ESLint `max-lines-per-function`)

Las más largas son fábricas que agrupan los métodos de un servicio: el largo es la suma de sus métodos.

| # | Función | Ubicación | Líneas |
|---|---|---|---|
| 1 | `crearPagoService` | apps/api/src/modules/checkout/checkout.pago.ts:54 | 262 |
| 2 | `crearReembolsosService` | apps/api/src/modules/pedidos/pedidos.reembolsos.ts:56 | 169 |
| 3 | `crearProcesadorExportaciones` | apps/api/src/modules/exportaciones/exportaciones.procesador.ts:49 | 128 |
| 4 | `crearCatalogoController` | apps/api/src/modules/catalogo/catalogo.controller.ts:89 | 128 |
| 5 | `crearAuthService` | apps/api/src/modules/auth/auth.service.ts:55 | 111 |
| 6 | `crearConciliacionService` | apps/api/src/modules/checkout/checkout.conciliacion.ts:38 | 99 |
| 7 | `crearApp` | apps/api/src/app.ts:73 | 85 |
| 8 | `crearExportacionesService` | apps/api/src/modules/exportaciones/exportaciones.service.ts:32 | 84 |
| 9 | `iniciar` (arranque y apagado) | apps/api/src/server.ts:44 | 82 |
| 10 | `crearPasarelaSimulada` | apps/api/src/shared/adapters/pasarela-simulada.ts:82 | 68 |

### 5.3 SPs más largos (líneas sin vacías ni comentarios; ramas = IF + WHEN + WHILE)

| # | SP | Líneas | Ramas |
|---|---|---|---|
| 1 | SP_Semilla_GenerarDatosDemo (solo semilla) | 387 | 42 |
| 2 | SP_Checkout_IniciarSesion | 148 | 12 |
| 3 | SP_Pedidos_RegistrarDevolucion | 138 | 18 |
| 4 | SP_Pedidos_CrearPedido | 129 | 11 |
| 5 | SP_Carrito_Fusionar | 128 | 11 |
| 6 | SP_Checkout_RegistrarIntentoPago | 127 | 24 |
| 7 | SP_Carrito_Obtener | 111 | 13 |
| 8 | SP_Cupones_Actualizar | 106 | 17 |
| 9 | SP_Carrito_AgregarLinea | 98 | 14 |
| 10 | SP_Checkout_ResolverIntentoConciliado | 88 | 17 |

### 5.4 Duplicación

| Duplicación | Dónde | Nota |
|---|---|---|
| Esquema OpenAPI del sobre de paginación (`pagina`, `tamano`, `total`, `totalPaginas`) | 8 archivos `*.routes.ts`: bitacora, catalogo, cupones, exportaciones, inventario, pedidos, reportes, usuarios | **Resuelto en 2d6f6fb:** `respuestaPaginadaSchema(fila)` en `shared/openapi`, con una prueba que impide declarar otro |
| Bloques de 6 líneas repetidos entre archivos de `src/` | 5 bloques, todos del punto anterior (resueltos con él) | Barrido por ventanas de 6 líneas sobre `apps/api/src` |

### 5.5 Excepciones a las reglas de CLAUDE.md vigentes

| Regla | Excepción | Dónde | Justificación escrita |
|---|---|---|---|
| Sin `any`, `@ts-ignore`, `eslint-disable` | Ninguna | `apps/`, `packages/`, `database/migrator/src` | — |
| Sin `!` de no nulo | Ninguno | — | — |
| Casts `as` | 5: `primero as T[]` | apps/api/src/shared/db/ejecutar-sp.ts:83 | El único cast de filas del backend (A-18, skill modulo-express §3) |
| | `as Partial<T>` | apps/api/src/shared/db/index.ts:47 | El mismo cast, para varios conjuntos |
| | `Object.create(null) as Record<…>` | apps/api/src/shared/http/cookies.ts:6 | Objeto sin prototipo contra `__proto__` |
| | `entrada as Entrada<E>` | apps/api/src/shared/http/manejar.ts:71 | Tipos derivados de los esquemas que acaban de validar |
| | `rol as RolDeUsuario` | apps/api/src/shared/http/token-acceso.ts:97 | Tras verificar el valor contra la lista |
| Prohibido concatenar en SQL | `CREATE DATABASE`, `ALTER DATABASE` y `CREATE/ALTER LOGIN` con `QUOTENAME` | database/migrator/sql/preparar-servidor.sql, recrear-base.sql | Excepción documentada (skill sqlserver-sp §11): identificadores y contraseñas no aceptan parámetros |
| `console.log` | Ninguno (solo un comentario) | apps/api/src/shared/errors/middleware.ts:35 | — |

## 6. Seguridad

| Punto | Estado | Evidencia |
|---|---|---|
| Login: correo inexistente vs existente con contraseña incorrecta | Mismo tiempo: p50 35 ms vs 34 ms, media 39 vs 38 ms, p95 60 vs 62 ms (40 intentos de cada uno, alternados, a través de nginx). Ambos `401` con el mismo cuerpo | `argon2.verify(hash ?? HASH_DE_RELLENO, …)`: apps/api/src/modules/auth/auth.contrasenas.ts:25 |
| Algoritmo del JWT fijado | HS256 al firmar y `algorithms: ['HS256']` al verificar; secreto de ≥ 32 caracteres validado al arrancar y rechazado si es el de ejemplo en `production` | apps/api/src/shared/http/token-acceso.ts:9, :59, :69; apps/api/src/shared/config/index.ts:13, :110 |
| Parámetros de argon2 | argon2id, memoria 19 MiB, 2 iteraciones, paralelismo 1 (OWASP) | apps/api/src/modules/auth/auth.contrasenas.ts:5-8 |
| Cookie `refresh` | `HttpOnly`, `Secure`, `SameSite=Strict`, `Path=/api/v1/auth`, 7 días | apps/api/src/modules/auth/auth.controller.ts:34-38 |
| Cookie `carrito_invitado` | `HttpOnly`, `Secure`, `SameSite=Lax`, `Path=/api/v1`, 365 días (el carrito de invitado vence en la base por inactividad) | apps/api/src/modules/carrito/carrito.controller.ts:73-89 |
| CORS | Lista de `CORS_ORIGINS` (.env), `credentials: true`, nunca `*`; un origen fuera de la lista no recibe `Access-Control-Allow-Origin` | apps/api/src/app.ts:108; prueba test/entorno/seguridad-http.test.ts |
| Encabezados | helmet (CSP con `frame-ancestors 'none'`, HSTS, nosniff, COOP, CORP, Referrer-Policy…), sin `X-Powered-By`, nginx con `server_tokens off` (también en sus páginas de error) | apps/api/src/app.ts:89-107; infra/nginx/nginx.conf:13; prueba de entorno |
| Errores | Un 500 real (SQL Server en pausa) responde solo `codigo`, `mensaje` y `requestId` con `NODE_ENV=development`; el detalle va al log | prueba de entorno; apps/api/src/shared/errors/middleware.ts |
| Límites de tamaño | JSON 100 KB en la API, 1 MB en nginx; cuerpo comprimido ilegible → 400 (corregido hoy, f62b7ea) | apps/api/src/app.ts:40; infra/nginx/nginx.conf:35 |
| Rate limiting | Login 5/min por IP y correo; registro 3/min por IP; cambio de contraseña 5/min por usuario; carritos de invitado 20/min por IP; exportaciones por usuario | docs/01-arquitectura.md §10 |
| Usuario no root en las imágenes | API y migrador: `USER node`. SQL Server: `mssql`. nginx: maestro `root` y workers `nginx` (imagen oficial). Redis: `redis` desde 380fae3, con prueba de entorno | apps/api/Dockerfile:30; database/migrator/Dockerfile:21; `ps` en cada contenedor |
| Versiones de imágenes fijadas | SQL Server fijado al CU exacto con digest (`2022-CU27-GDR1-ubuntu-22.04@sha256:…`, fa31800, con prueba: ninguna imagen usa `latest`). El resto por versión mayor/menor, sin digest: `node:24-alpine`, `nginx:1.28-alpine`, `redis:7-alpine` | Dockerfiles; docker-compose.yml:56, :107 |
| `pnpm audit` | 4 moderadas, 0 altas, 0 críticas (2 avisos). Producción: 3 moderadas, todas transitivas de `exceljs`: `uuid <11.1.1` (GHSA-w5hq-g745-h8pq: solo con el parámetro `buf`, que exceljs no usa) y `minimatch <11.0.1` (GHSA-g3hv-75wg-m249, vía `archiver`: los globs no vienen del cliente). Desarrollo: `minimatch` vía `eslint` | `pnpm audit`, 2026-11-02 |
| Login del migrador vs `shopcart_app` | `shopcart_app`: solo `EXECUTE` en `dbo`, con `DENY SELECT/INSERT/UPDATE/DELETE` sobre el esquema y sin roles de servidor. `shopcart_migrator`: `db_owner` de `ShopCart`, sin roles de servidor. `shopcart_busqueda` (usuario sin login): solo `SELECT` sobre `VW_Catalogo_ProductosTienda`, para la búsqueda dinámica | `sys.database_permissions` y `sys.server_role_members` en `ShopCart` |
| Aislamiento entre clientes | Barrido sobre las rutas del router real: 7 rutas de cliente con ID → 404 con el ID de otro cliente; ninguna entrada de cliente acepta `idUsuario`; toda ruta declara roles o es pública conocida | test/integracion/seguridad/aislamiento.api.test.ts |
| Secretos en el historial | Ningún `.env`, `JWT_SECRETO` real ni PDF en los 189 commits; los valores de `.env` que aparecen son los de ejemplo de `.env.example` | `git log --all -S…` |

## 7. Rendimiento

Generador `SP_Semilla_GenerarDatosDemo @Pedidos = 50000, @Dias = 90` en una base desechable (`shopcart_carga`, migrada sin S006 y borrada después): 50 000 pedidos, 200 clientes, 108 825 movimientos de kardex, 109 628 filas de bitácora, conciliación vacía; tardó 21 min. 30 peticiones secuenciales por caso, cada una con una página o un rango de fechas distinto (los reportes nunca aciertan en la caché). "Directo": la API compilada en el host (`node dist/server.js`); "nginx": las dos réplicas de Docker a través de `http://127.0.0.1:8080`. Tiempos en ms, del lado del cliente.

| Listado o reporte | Semilla (1 500 pedidos) directo p95 | Semilla nginx p95 | 50k directo p50 / p95 | 50k nginx p50 / p95 / máx |
|---|---|---|---|---|
| Pedidos · cliente (mis pedidos, 269 del cliente) | 10 | 14 | 16 / 28 | 17 / 21 / 22 |
| Pedidos · gestión, primeras páginas | 34 | 35 | 29 / 43 | 29 / 41 / 233 |
| Pedidos · gestión, última página (OFFSET 49 800) | 24 | 30 | 320 / 811² | 326 / 373 / 374 |
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

² En la primera ronda directa hubo un pico aislado de 9.6 s (máx.) en esa página; 40 repeticiones posteriores dieron p50 315 ms, p95 358 ms y máx. 456 ms. Causa probable: la actualización automática de estadísticas tras la carga masiva. En SQL, la última página cuesta ~320 ms porque `SP_Pedidos_Listar` arma cada fila (artículos, estado de pago y cliente) antes de descartar las 49 800 anteriores; la de bitácora, ~350 ms.

**Resultado:** ningún listado ni reporte pasa de 1 s con 50 000 pedidos (RNF-1); no se cambió ningún índice ni SP. Lo más lento es el dashboard sin caché (resumen, p95 451 ms a través de nginx) y las últimas páginas de listados grandes (~370 ms).

## 8. Riesgos abiertos

| Riesgo | Origen | Estado | Evidencia |
|---|---|---|---|
| Redis corría como `root` (el `command: sh -c …` se saltaba la bajada de privilegios) | Verificación de entrega | **Resuelto en 380fae3** (`user: redis`). Un entorno anterior puede tener un `dump.rdb` de root: el README indica cómo recrear Redis | `entorno/contenedores.test.ts` |
| La imagen de SQL Server no estaba fijada (`2022-latest`) | Verificación de entrega | **Resuelto en fa31800**; el resto de las imágenes sigue fijado por versión menor sin digest | `penalizaciones.test.ts` › imágenes fijadas |
| Respaldo de `git filter-branch` con 4 commits de E0 con `Co-Authored-By` | Verificación del historial | **Resuelto** (borrado, reflog expirado y `gc`; solo era local) | `git log --all` sin `Co-Authored-By` |
| Filas de un SP sin validar en ejecución (`as T[]`) | Revisión de E0 | Mitigado: política aceptada; montos convertidos y probados | ejecutar-sp.ts:83; integracion/shared/montos.test.ts |
| nginx es punto único de falla | E0-H05 | Abierto (aceptado; mejora de producción) | 01:77 |
| Con Redis caído, la revocación por versión de sesión espera hasta 15 min | E2 (N-15) | Mitigado (acotado y documentado) | 01:243; integracion/adaptadores/versiones-sesion.test.ts |
| Con Redis caído, el rate limiting pasa a memoria por réplica (el límite efectivo se multiplica por 2) | E2 | Mitigado (degradación documentada) | 01:245; integracion/adaptadores/limitador-redis.test.ts |
| Último tramo de listados grandes: la última página de pedidos o bitácora cuesta ~350 ms con 50k, y crece lineal con el OFFSET; hubo un pico aislado de 9.6 s | Rendimiento (2026-11-02) | Mitigado: bajo 1 s en estado estable; candidato a paginar las llaves antes de armar las filas en `SP_Pedidos_Listar` | §7 |
| El filtro de carritos abandonados no tiene índice | Cierre de E6/E7 | Mitigado: 15 ms con 50k; el índice sigue en F5 | 03-backlog:653; §7 |
| 3 vulnerabilidades moderadas transitivas en producción (`uuid`, `minimatch` vía `exceljs`) | Verificación de entrega | Abierto; ninguna recibe entrada del usuario | `pnpm audit --prod` |
| Documentación desalineada con el código | Inventario (§3) | **Resuelto en 3c09179 y a2a841e** (README con FEL, tarifa por zona y el resto de exclusiones) | §0 |
| Sobre de paginación duplicado en 8 esquemas OpenAPI | Inventario (§5.4) | **Resuelto en 2d6f6fb** | §5.4 |
| Un `.tmp` de una exportación que una réplica dejaba a medias al morir no lo recogía el barrido de huérfanos | Guía de defensa (E9-H03) | **Resuelto** (decisión del PO): la purga horaria borra los `.tmp` con más de 24 h | `almacen-disco.test.ts`, `purga.test.ts` |
| Se podían desactivar todos los métodos de envío y entonces todo checkout fallaba con 404 | Guía de defensa (E9-H03) | **Resuelto** (decisión del PO): siempre queda uno activo, 50901 bajo bloqueo de las filas de `MetodoEnvio` (N-04) | `secuencial/configuracion-envios.api.test.ts` |
| La espera máxima del apagado (10 s) es igual al plazo de `docker stop`, y el compose no define `stop_grace_period` | Guía de defensa (E9-H03) | Abierto (menor): con una petición de casi 10 s, el SIGKILL compite con la salida forzada | `server.ts:36` |
| Cambiar el rol sube la versión de sesión pero no revoca los refresh tokens; el refresh siguiente emite el token con el rol nuevo | Guía de defensa (E9-H03) | Por confirmar: N-15 dice «los que correspondan» | `R__SP_Usuarios_Actualizar.sql:61` |
| El orden de capas dentro de un módulo (`routes → controller → service → repository`) no lo verifica el lint, solo las fronteras entre módulos | Guía de defensa (E9-H03) | Abierto: hoy se cumple (revisado a mano); CLAUDE.md dice que el lint lo verifica | `eslint.config.mjs` |
| Redis usa `redis:7-alpine` sin digest | Guía de defensa (E9-H03) | Abierto (SQL Server y Grafana LGTM sí lo llevan) | `docker-compose.yml` |
| El cierre de un stream SSE por token vencido o sesión revocada llega en el siguiente latido (hasta 15 s después) | Revisión de E9 | Aceptado y documentado en A-25 | `reportes.eventos.ts` (`revisar`) |

Se descartaron 71 riesgos y dudas de los reportes de cierre de E0 a E8 por estar resueltos y verificados contra el código, las pruebas o un commit. Entre ellos están los 5 resueltos hoy (15ffc5f, 176d889, 4a9f80e, 609af26), y 3 se cerraron por decisión del PO sin riesgo residual.
