# ShopCart — Visión y contexto del proyecto

> Documento vivo y fuente de verdad del proyecto. Se actualiza cada vez que se confirma una decisión.
> Enunciado oficial completo: [`enunciado-shopcart.md`](./enunciado-shopcart.md).

---

## 1. Qué estamos construyendo

ShopCart es la tienda en línea de una cadena de tiendas que hoy solo vende en puntos físicos. Es una plataforma web de nivel productivo con base de datos, API y frontend:

- **Clientes:** navegan el catálogo, arman su carrito (también como invitados), aplican un cupón, eligen dirección y envío, pagan y dan seguimiento a sus pedidos.
- **Operadores:** preparan y despachan pedidos, gestionan inventario y registran devoluciones.
- **Administradores:** además gestionan catálogo, precios, cupones, usuarios, reportes y la bitácora.

Es el reto técnico **Tech Challenge 360 (Grupo Pentandra / Don Arturo)**, nivel Middle/Senior, individual. Se evalúa sobre 100 puntos (se aprueba con 70) y se valora más la **calidad y corrección** que la cantidad de pantallas. Al final hay una **defensa técnica** en vivo: hay que poder explicar y modificar cualquier parte del código.

---

## 2. Cómo trabajamos

### Roles

| Rol | Quién | Responsabilidad |
|---|---|---|
| Product Owner y Arquitecto | Diego, con Claude (chat del proyecto) | Definir reglas de negocio, arquitectura, modelo de datos y backlog |
| Desarrollador | Claude Code en VS Code | Implementar **solo** historias definidas y aprobadas en el backlog |

### Etapas

El diseño sigue el marco de la skill `engineering:system-design`: requerimientos → diseño de alto nivel → detalle → escala y confiabilidad → trade-offs.

1. **Decisiones de negocio y requerimientos** (funcionales, no funcionales y restricciones) ✅ *cerrada el 29 oct*
2. **Diseño de arquitectura:** componentes, modelo de datos (ER), flujos críticos, contratos de la API, escala y trade-offs ✅ *cerrada el 29 oct*
3. **Backlog:** ← *estamos aquí* épicas por módulo, cada una con historias que tengan alcance y criterios de aceptación (estilo Jira).
4. **Desarrollo** historia por historia.

### Reglas

- **Nada pasa a desarrollo sin estar en papel.** Toda historia tiene alcance y criterios de aceptación antes de implementarse.
- Si el desarrollador encuentra una ambigüedad o necesita una decisión de negocio o de arquitectura, **se detiene y la reporta**. No la decide por su cuenta.
- **Ninguna propuesta es una decisión hasta que se analiza.** Cada una se revisa con sus alternativas, sus trade-offs y las preguntas que podría hacer el evaluador. Solo después el PO la confirma o la modifica.
- Toda decisión confirmada se registra en este documento con un ID (`D-xx` generales, `RNF-xx` no funcionales, `N-xx` negocio, `A-xx` arquitectura). Más adelante se documenta en el README, porque las decisiones abiertas forman parte de la evaluación.

---

## 3. Calendario y capacidad

| Hito | Fecha | Alcance |
|---|---|---|
| Inicio | Lun 26 oct 2026 | — |
| **Fase 1** | **Lun 2 nov, 23:59** | Base de datos y backend |
| **Fase 2** | **Lun 9 nov, 23:59** | Frontend y proyecto completo |
| Defensa | 11–18 nov | Demo en vivo y defensa técnica |

Cada fase se evalúa con el último commit anterior a su fecha límite. No se aceptan commits tardíos.

**Capacidad de Diego:** lunes a jueves unas 5 h/día, viernes unas 8 h, sábado unas 5 h, domingo entre 5 y 8 h (para afinar). **Los lunes de entrega se trabaja lo mínimo**, así que todo debe estar listo el domingo.

**Entorno de desarrollo:** Windows con Docker Desktop sobre WSL2, 16 GB de RAM. SQL Server corre nativo (x64), sin emulación. Se recomienda asignar unos 10 GB a WSL2 (`.wslconfig`).

---

## 4. Restricciones fijas del enunciado (no negociables)

### Stack
- **Base de datos:** Microsoft SQL Server 2019 o superior.
- **Backend:** Node.js 24 LTS o superior, Express y TypeScript en modo `strict`.
- **Frontend:** React 18 o superior con TypeScript.

### Base de datos
- **Todo** el acceso a datos (lectura, creación y edición) se hace mediante stored procedures. **Sin ORM y sin SQL en el código del backend.**
- Parámetros tipados. No se concatenan valores en cadenas SQL, ni en el backend ni dentro de los SPs. El SQL dinámico solo se permite con `sp_executesql` y parámetros.
- Modelo normalizado con PK, FK, `UNIQUE`, `NOT NULL` y `CHECK` donde aplique.
- Montos y cantidades en `DECIMAL` o `INT` con precisión definida. **Nunca `FLOAT` ni `REAL`.**
- Scripts SQL versionados y numerados que crean la base, sus objetos y las semillas de forma reproducible. Ningún objeto puede generarse con un ORM.
- **Nomenclatura obligatoria:**

| Objeto | Formato | Ejemplo |
|---|---|---|
| Stored procedure | `SP_Modulo_Proceso` | `SP_Pedidos_CrearPedido` |
| Vista | `VW_Modulo_Proceso` | `VW_Dashboard_VentasPorCategoria` |
| Función tipo tabla | `FU_Modulo_Proceso` | `FU_Cupones_CalculoDescuento` |
| PK autoincrementable | `ID` + Nombre | `IDProducto`, `IDPedido` |

### Backend
- Arquitectura por capas: rutas o controladores, servicios (con la lógica de negocio) y acceso a datos.
- Validación de esquemas en la API.
- Manejo centralizado de errores, con respuestas consistentes y los códigos HTTP correctos (401 para token expirado, 403 para acceso no permitido).
- Configuración por variables de entorno, con un archivo `.env.example`.
- Documentación de la API (está en la rúbrica).

### Frontend
- Rutas protegidas y menús según el rol.
- Formularios con validación.
- Tablas con paginación, ordenamiento y filtros del lado del servidor.
- Gráficas en el dashboard.
- Estados de carga, vacío y error en todas las vistas.
- Renovación transparente del token.
- Diseño responsive.

### No funcionales
- Listados y reportes en menos de 1 s con los datos semilla.
- Sin credenciales en el repositorio.
- CORS y cabeceras de seguridad configurados.
- Contraseñas con hash.
- Ninguna operación deja datos a medias.
- Las reglas críticas también se protegen en la base de datos.
- Concurrencia segura en checkout, cupones e inventario.
- Sin lógica de negocio en controladores ni en componentes visuales.
- El proyecto corre en una máquina limpia siguiendo solo el README.

### Penalizaciones directas
- Funcionalidad que no corre en el ambiente entregado.
- Un cliente puede ver o modificar datos de otro.
- Código que el participante no entiende.
- ORM, SQL en el backend o riesgo de SQL injection.
- Problemas de rendimiento.

### Entregables
- Repositorio Git con acceso para el evaluador.
- README con instalación, decisiones técnicas, diagrama ER y credenciales de prueba.
- Diagrama de estados del pedido.
- Historial de commits progresivo.

---

## 5. Los problemas de negocio que guían el diseño

| Problema | Módulos | Decisiones relacionadas |
|---|---|---|
| Cero sobreventa, aun con compras simultáneas de la última unidad | RF-03, RF-06 | N-01, N-06, N-07, RNF-3 |
| Precio y descuento congelados al confirmar | RF-02, RF-06 | N-02 |
| Sin pedidos ni cobros duplicados (doble clic o reintento) | RF-06 | N-01, N-03 |
| Ventas, más vendidos y carritos abandonados al momento | RF-08 | N-11, N-13, RNF-1 |
| Trazabilidad de quién cambió precios, existencias y pedidos | RF-07, RF-09 | RNF-4 |
| Kardex siempre cuadrado | RF-03 | N-07, N-16 |

---

## 6. Decisiones confirmadas

### Generales

| ID | Decisión |
|---|---|
| D-01 | El ambiente entregado se levanta con **Docker Compose** en local. La nube es opcional. |
| D-02 | El backend es **modular por dominio**, con capas dentro de cada módulo. |
| D-03 | El proceso es PO/Arquitecto (chat) → Dev (Claude Code), y nada se desarrolla sin estar definido en papel. |
| D-05 | **Buenas prácticas con un kit propio del proyecto** en `.claude/`: skills `sqlserver-sp` y `modulo-express` y agente `revisor-shopcart`, escritos a partir de estos documentos. Del kit de Diego (`Dart18-80/claude-kit`) se instala solo `stack-typescript` y los plugins base oficiales (TDD, verificación, revisión, seguridad); `stack-nextjs` se agrega en la Fase 2. **No se usan** `stack-nestjs`, `stack-redis`, `stack-prisma` ni `stack-postgres`. Ante cualquier diferencia, `docs/` y `CLAUDE.md` mandan. Después del reto, lo genérico del kit propio se publica en claude-kit como `stack-sqlserver` y `stack-express`. |
| D-04 | **Kubernetes queda diferido.** Solo se evalúa después de completar todo lo obligatorio. El diseño stateless (RNF-2) lo deja preparado. |

### Requerimientos no funcionales

| ID | Decisión |
|---|---|
| RNF-1 | **Volumen medio de datos, diseño para volumen alto.** La semilla por defecto es de unos 60 productos / 250 variantes, 200 clientes y 1,500 pedidos repartidos en 90 días, para que el entorno arranque rápido y el dashboard tenga datos reales. El diseño asume volumen alto: índices pensados para cada consulta, paginación y filtros en el servidor, y reportes sin escaneos completos. Un **script opcional de carga pesada** (por ejemplo 50k pedidos) demuestra en la defensa que el rendimiento se sostiene. |
| RNF-2 | **API stateless, lista para varias réplicas.** El ambiente corre **2 réplicas de la API** detrás de nginx como balanceador. **Redis** guarda solo estado que se puede perder (contadores de rate limiting y caché de reportes). Las reglas críticas viven en SQL Server: idempotencia (`UNIQUE`), reservas, stock y refresh tokens. Si Redis cae, el sistema se degrada pero nunca vende de más ni cobra dos veces. El job de liberación de reservas usa `sp_getapplock` para que solo una ejecución avance a la vez, aunque corra en ambas réplicas. |
| RNF-3 | **Test de concurrencia automatizado como entregable.** Escenario 1: 20 checkouts simultáneos sobre la última unidad de una variante. Escenario 2: 20 usos simultáneos de un cupón con 1 uso restante. Pasa si hay exactamente 1 éxito, los demás reciben un rechazo claro y el kardex cuadra. |
| RNF-4 | **Observabilidad con OpenTelemetry y Grafana LGTM** (Loki para logs, Tempo para trazas, Grafana para visualizar; imagen `grafana/otel-lgtm`). La API emite logs estructurados en JSON y trazas que muestran el recorrido de cada petición (nginx → réplica → SP). Cada petición lleva un `requestId`, que también llega a los SPs vía `SESSION_CONTEXT`. Endpoint `/health` que verifica la base mediante un SP. Se levanta en un **perfil opcional de Docker Compose** (`--profile observability`) para que una falla en la observabilidad no afecte el ambiente evaluado. Se descartan Datadog (requiere cuenta y API key) y ELK (más pesado en RAM). |

---

## 7. Decisiones de negocio

Estado: 🟡 Propuesta (sin analizar) · 🔍 En análisis · ✅ Confirmada · ✏️ Modificada por el PO

### Bloque 1 — Flujo de compra

| ID | Tema | Propuesta / decisión | Estado |
|---|---|---|---|
| N-01 | ¿Cuándo nace el pedido? | El pedido **solo existe cuando el pago se confirma** (coincide con el glosario: "Pedido = compra confirmada"). "Iniciar pago" crea una **sesión de checkout** (módulo Checkout) con las reservas de 15 minutos, el resumen congelado y sus **intentos de pago** (`IntentoPago`, con la llave de idempotencia como `UNIQUE`; también sirve de historial de rechazos y de auditoría). "Confirmar pago" crea en una sola transacción el pedido, su detalle, la salida en el kardex, el uso del cupón y el consumo de las reservas (módulo Pedidos). Si el pago falla o la sesión vence, no se crea ningún pedido. La sesión tiene su propio ciclo: `Activa → Pagada / Expirada / Cancelada`. | ✅ |
| N-02 | Congelamiento de precio y descuento | **Dos capas.** **(1) Garantía de precio en el carrito.** Cada línea apunta a la versión de precio vigente al agregarse (`PrecioVariante`) y la garantiza durante **3 días**, plazo configurable por el Admin y contado desde que se agregó la línea. **Solo protege contra subidas:** el precio de la línea es el menor entre el garantizado y el vigente. Si el precio baja, se aplica la baja y se avisa al cliente del cambio a favor. Mientras la garantía está vigente y el precio subió, se muestra *"Precio garantizado hasta <fecha>"*. Al vencer, si el vigente es mayor, la línea se actualiza y aparece la alerta *"El precio de X cambió de Q… a Q…"*. Cambiar la cantidad conserva el precio de la línea y no renueva la garantía. En la fusión de carritos (N-05) se conserva la garantía vigente más favorable. **Un precio mal capturado se considera error humano: las garantías se respetan.** Como mitigación, el Admin puede desactivar la variante, y la bitácora identifica quién hizo el cambio. **(2) Congelamiento al iniciar el pago.** La sesión de checkout copia el precio efectivo de cada línea, el descuento ya repartido por línea (el centavo sobrante va a la línea de mayor monto) y el envío. Eso es lo que se cobra. El **uso del cupón se reserva al iniciar el pago**, igual que el stock, y se consume al confirmar. Hay **una sola sesión activa por cliente**: si el carrito no cambió, se reutiliza; si cambió, la anterior se cancela y libera sus reservas. **Modelo de precios versionados:** tabla `PrecioVariante` con vigencias y función `FU_Catalogo_PrecioVigente`. **Durante los 15 minutos la sesión queda congelada en ambas direcciones:** si el precio baja, no cambian ni el monto, ni el cupón reservado, ni el intento de pago. El cliente puede volver al carrito y reiniciar el pago para obtener la baja. | ✏️ |
| N-03 | Pago | **Pasarela simulada como adaptador:** interfaz `PasarelaPago` (puerto) y adaptador `PasarelaSimulada`, de modo que una pasarela real sería un adaptador nuevo sin tocar el checkout. Tarjetas de prueba: `4242 4242 4242 4242` aprobada, `4000 0000 0000 0002` rechazada (fondos insuficientes) y `4000 0000 0000 0119` con tiempo de espera agotado (para demostrar el reintento). **Orden: autorizar → crear pedido (transacción atómica) → capturar.** Si la creación del pedido falla, la autorización se anula y nunca hubo cobro. **Idempotencia:** el frontend envía un UUID por intento en el header `Idempotency-Key`. Misma llave y misma solicitud devuelve el resultado guardado; misma llave con otro contenido devuelve `422`; una llave nueva mientras otro intento de la sesión está en curso devuelve `409`; si la sesión ya está pagada, se devuelve el pedido existente. **Datos de tarjeta:** nunca se guardan; solo la marca y los últimos 4 dígitos, y los logs ocultan número y CVV. **Máximo 5 intentos rechazados por sesión;** al llegar al límite, la sesión se cancela y libera sus reservas. **Solo pago con tarjeta.** **Captura inmediata** después de crear el pedido, por lo que una cancelación siempre es un reembolso; capturar al despachar queda como mejora documentada. **Los reembolsos se hacen contra el ID de transacción de la pasarela**, que el pedido guarda junto con la marca y los últimos 4 dígitos. | ✅ |
| N-04 | Envío | **Dos métodos con tarifa fija configurable por el Admin** (tabla `MetodoEnvio`): Estándar (por ejemplo Q35, 3–5 días) y Express (por ejemplo Q75, 24 h). La tarifa por zona queda como mejora documentada en el README. **Envío gratis a partir de un monto configurable**, evaluado sobre el subtotal de productos **después del cupón**; el carrito muestra cuánto falta para alcanzarlo. **El cupón no aplica sobre el envío.** El envío **incluye IVA** y entra en el desglose del pedido (N-18). Su costo se congela en la sesión y en el pedido (N-02). **Al cancelar se reembolsa el envío; en una devolución no** (se confirma en N-09/N-10). Cada método tiene días estimados, y el pedido guarda una **fecha estimada de entrega**. Los cambios de tarifas se registran en la bitácora. | ✅ |
| N-05 | Carrito de invitado | **Token** aleatorio de 256 bits en una **cookie httpOnly**; en la base se guarda su hash. **La API nunca expone el ID del carrito:** los endpoints son `/carrito` y `/carrito/lineas/:idLinea`, el carrito se resuelve desde la sesión o el token, y el SP valida que la línea pertenezca a ese carrito. Una línea ajena responde `404`. **Creación perezosa:** el carrito se crea al agregar el primer producto. **Fusión al iniciar sesión:** se suman las cantidades con la existencia disponible como tope, con aviso si hubo ajuste; el precio es la garantía vigente más favorable (N-02); el carrito de invitado pasa a `Fusionado` y se borra la cookie; una sesión de checkout activa se cancela. Al registrarse, el carrito de invitado pasa a ser el del nuevo cliente. **El checkout exige sesión.** **Un solo carrito activo por cliente** (índice único filtrado). **Solo el rol Cliente tiene carrito y compra;** Operador y Admin reciben `403`. Un carrito de invitado con **30 días sin actividad pasa a `Expirado`** (sin borrado físico). **Máximo 50 líneas por carrito**, cantidad por línea limitada por la existencia disponible y rate limiting en Redis para la creación de carritos de invitado. | ✅ |
| N-06 | Existencia en el carrito | **El carrito valida pero no reserva:** al agregar o modificar, la cantidad debe ser ≤ disponible (física − reservas vigentes). Si dos clientes tienen la última unidad, la compra el primero que inicia el pago. **Al consultar el carrito, cada línea tiene un estado:** `Disponible`, `CantidadExcedida` (con la acción "Ajustar a X"), `Agotado` o `NoDisponible` (producto o variante desactivada; solo se puede eliminar). **No se modifica la cantidad automáticamente.** **El checkout se bloquea** mientras haya líneas que no estén `Disponible`. **Al cliente se le muestra** "Disponible", "Últimas X unidades" (umbral configurable, 5 por defecto) o "Agotado"; Operador y Admin ven la cifra exacta. **Reserva todo o nada al iniciar el pago:** una sola transacción que bloquea las variantes **siempre en orden de `IDVariante`** (para evitar deadlocks); si una línea falla, no se reserva ninguna y la respuesta indica qué líneas fallaron y cuánto hay disponible. Si un producto se desactiva durante una sesión de pago, la sesión se respeta. **Fuera de alcance:** límite de compra por cliente (mejora documentada). | ✅ |

### Bloque 2 — Pedidos, inventario y reportes

| ID | Tema | Propuesta | Estado |
|---|---|---|---|
| N-07 | ¿Cuándo sale el stock? | **La salida en el kardex ocurre al confirmar el pago**, que es la venta; despachar solo cambia el estado del pedido. Se deriva del enunciado: RF-06 incluye los movimientos de inventario en la creación atómica del pedido, y RF-07 exige que cancelar reintegre la existencia con un movimiento. Para conciliar con el conteo físico, la vista `VW_Inventario_ExistenciaBodega` muestra existencia física + unidades de pedidos pagados no despachados. **Kardex:** tipos `EntradaCompra`, `SalidaVenta`, `AjustePositivo`, `AjusteNegativo`, `ReingresoCancelacion` y `ReingresoDevolucion`. Cada movimiento guarda tipo, cantidad, usuario, fecha, motivo, referencia (pedido, devolución o factura), **existencia anterior y resultante**. El kardex es **inmutable**: los errores se corrigen con ajustes compensatorios. Las reservas no son movimientos del kardex. `VW_Inventario_Conciliacion` compara la física con la suma del kardex y debe devolver cero filas (se verifica también en el test de RNF-3). **Un ajuste negativo no puede dejar la existencia física por debajo de lo reservado vigente**, con un mensaje que indica el máximo ajustable. En una salida por venta, el usuario registrado es el cliente que compró. | ✅ |
| N-08 | Ciclo de vida del pedido | **Estados:** `Pagado` (inicial, lo crea el sistema al confirmar el pago) → `EnPreparacion` → `Despachado` → `Entregado` (los mueve el Operador) → `DevueltoParcial` / `Devuelto` (los deriva el sistema al registrar devoluciones). `Cancelado` (final) solo desde `Pagado` o `EnPreparacion`. **No se saltan estados.** Cancelan el Cliente y el Operador, con motivo obligatorio; el Admin hereda todo lo del Operador. No hay transiciones automáticas. **Las devoluciones son una entidad aparte** (`Devolucion` con sus líneas); el SP que la registra calcula el estado del pedido en la misma transacción. **Validación en dos capas:** mapa de transiciones en el backend (`409` con mensaje claro) y tabla `TransicionEstadoPedido (EstadoOrigen, EstadoDestino, Rol)` en la base, que el SP consulta y que un **trigger sobre `Pedido`** hace cumplir ante cualquier `UPDATE`. Un test verifica que el mapa y la tabla coinciden. **`HistorialEstadoPedido`** (estado anterior, nuevo, usuario, fecha y hora, motivo) se escribe en la misma transacción; la primera fila es `(ninguno) → Pagado`. Alimenta `VW_Pedidos_Historial`. **Concurrencia optimista:** el cambio solo procede si el pedido sigue en el estado esperado; si no, `409` con "El pedido cambió de estado". | ✅ |
| N-09 | Cancelación | El Cliente y el Operador cancelan desde `Pagado` o `EnPreparacion` (N-08), con motivo obligatorio. **Se cancela el pedido completo**, nunca líneas sueltas. **Una sola transacción:** estado `Cancelado` con su historial, `ReingresoCancelacion` en el kardex por línea, liberación del uso del cupón (aunque el cupón ya haya vencido) y registro de un `Reembolso` en estado `Pendiente` por el total, envío incluido. **El reembolso se ejecuta después del commit:** si la pasarela falla, la cancelación no se revierte; un job reintenta cada 5 minutos (con `sp_getapplock`) y tras 5 fallos el reembolso pasa a `Fallido` y aparece en una lista del Admin para resolverlo manualmente. | ✅ |
| N-10 | Devoluciones | **Las registra el Operador**, hasta **30 días** después de que el pedido pasó a `Entregado`. La solicitud del cliente con aprobación queda como mejora documentada. **Totales o parciales por línea, y varias por pedido.** "No devolver más de lo vendido" se garantiza en la base: cada línea del pedido tiene `CantidadDevuelta` con `CHECK (CantidadDevuelta <= Cantidad)`, actualizada en la misma transacción con bloqueo de las líneas. **El producto siempre reingresa** (`ReingresoDevolucion`); si llegó dañado, el Operador registra después un `AjusteNegativo` con motivo de merma. **Reembolso por línea** = precio efectivo pagado − descuento repartido por línea (N-02), por la cantidad devuelta, con IVA incluido; el envío no se reembolsa. Mismo flujo de reembolso que N-09, con llave de idempotencia y la regla de nunca superar lo capturado. | ✅ |
| N-11 | Qué cuenta como venta en los reportes | **Venta = pedido no cancelado, contado en la fecha de pago** (coincide con el glosario: ticket promedio sobre pedidos pagados). **Monto de ventas** = productos neto de descuento, con IVA incluido y **sin envío** (el envío se reporta aparte). **Las devoluciones se restan en la fecha en que ocurren**, no en la de la venta original (criterio contable: un periodo ya reportado no cambia). **Ticket promedio** = monto neto / número de pedidos del periodo. Estas definiciones se documentan en el README. | ✅ |
| N-12 | Reglas finas de cupones | **El cupón se aplica en el carrito** como vista previa (RF-04) y se revalida en cada consulta; si deja de ser válido, se quita con aviso del motivo. El uso **se reserva al iniciar el pago y se consume al confirmar** (N-02). **El monto mínimo se evalúa sobre el subtotal de todo el carrito**, incluso en cupones por categoría. En un cupón por categoría, el descuento solo aplica a las líneas de esa categoría, y un monto fijo nunca supera ese subtotal (el total nunca baja de cero). **Tope opcional en cupones de porcentaje** (`MontoMaximoDescuento`). **El límite por cliente cuenta usos confirmados más reservados vigentes.** Una cancelación devuelve el uso y una devolución no. **Un cupón ya usado no puede cambiar su tipo ni su valor**; solo vigencia, límites o desactivación. Código único sin distinguir mayúsculas. **Un mensaje específico por causa de rechazo:** no existe, inactivo, aún no vigente, vencido, agotado, límite por cliente alcanzado, mínimo no alcanzado (indicando cuánto falta) y sin productos de la categoría. | ✅ |
| N-13 | Carrito abandonado | Carrito activo con productos y **24 horas sin cambios** (plazo configurable por el Admin), de invitado o de cliente. La actividad es cualquier cambio en el carrito, no solo consultarlo. Un carrito que inició una sesión de pago y no la completó cuenta como abandonado si no hay más actividad. **El dashboard muestra** la cantidad de carritos abandonados en el periodo y el **monto potencial perdido** a precio vigente. | ✅ |

### Bloque 3 — Catálogo, usuarios y datos maestros

| ID | Tema | Propuesta | Estado |
|---|---|---|---|
| N-14 | Catálogo: borrado y variantes | **Borrado físico solo sin historial** (sin ventas, movimientos de kardex ni reservas; sus líneas de carrito se eliminan en la misma transacción). Con historial, solo se desactiva. Una variante inactiva no se muestra, y un producto sin variantes activas tampoco. **Categorías de un solo nivel:** no se desactivan con productos activos y solo se borran sin productos. **SKU único global**, no modificable una vez que la variante tiene movimientos. **Atributos normalizados:** `Atributo` → `ValorAtributo` → `VarianteValorAtributo`; el Admin puede crear atributos nuevos sin cambiar el esquema. La combinación única por producto se garantiza con la columna `FirmaAtributos` (IDs de valores ordenados) y `UNIQUE (IDProducto, FirmaAtributos)`. | ✅ |
| N-15 | Usuarios | El registro público solo crea Clientes; el Admin crea Operadores y Admins con una contraseña inicial. **Un rol por usuario.** Correo único sin distinguir mayúsculas. Contraseña de mínimo 8 caracteres con letras y números, guardada con argon2. El login responde con un mensaje genérico y tiene rate limiting. **Desactivar** revoca los refresh tokens y agrega el usuario a una **lista de revocados en Redis** (TTL de 15 min) que el middleware verifica en cada petición; si Redis cae, el riesgo queda acotado a la ventana del access token. Un Admin no puede desactivarse a sí mismo y el sistema nunca queda sin Admins activos. El cliente edita nombre y teléfono y cambia su contraseña (revoca sus otras sesiones). **Fuera de alcance:** recuperación de contraseña por correo (requiere SMTP). | ✅ |
| N-16 | Entradas de inventario | Sin módulo de proveedores ni de compras. El Operador registra cada entrada con cantidad, motivo y una referencia opcional (por ejemplo, el número de factura). **No se maneja el costo** (sin costo promedio ni valoración; mejora documentada). | ✅ |
| N-17 | Direcciones | **Catálogo de los 22 departamentos y 340 municipios de Guatemala** en la semilla, y cada dirección se liga a su municipio con una FK. Campos: nombre de quien recibe, teléfono (8 dígitos), municipio, dirección y referencia. **Varias direcciones por cliente y una sola predeterminada** (índice único filtrado). **El pedido copia la dirección al crearse**, de modo que editar o borrar una dirección no afecta pedidos pasados y se permite el borrado físico. | ✅ |
| N-18 | IVA | Los precios y el envío incluyen IVA. El desglose se calcula **sobre el total del pedido** (base = total / 1.12, IVA = total − base, redondeado a 2 decimales) y se guarda en el pedido. **Fuera de alcance:** factura electrónica FEL de la SAT (mencionado en el README). | ✅ |
| N-19 | Imágenes | Se guardan URLs, **varias por producto**, con orden y una principal. **Las imágenes de la semilla se sirven localmente** desde el contenedor web (`/static/productos/…`, SVG generados por categoría) para que la demo no dependa de un sitio externo. | ✅ |

---

## 8. Propuestas técnicas preliminares

Son solo para dar contexto. **Se deciden en la etapa 2**, después de cerrar las decisiones de negocio. Lo ya confirmado está en la sección 6.

- **Repositorio:** monorepo con pnpm: `apps/api`, `apps/web`, `database/` (scripts numerados) y `packages/shared` (esquemas Zod compartidos).
- **Backend:** un módulo por dominio (auth, usuarios, catálogo, inventario, carrito, cupones, checkout, pedidos, reportes, bitácora), cada uno con rutas, controlador, servicio, repositorio y esquemas. El repositorio solo invoca SPs mediante un helper tipado. Los SPs lanzan errores de negocio con `THROW 50xxx` y un middleware los traduce a HTTP.
- **Concurrencia:** transacciones dentro de los SPs con bloqueo de fila (`UPDLOCK`) en variante y cupón, y un `UNIQUE` sobre la llave de idempotencia.
- **Bitácora:** triggers que reciben el usuario mediante `SESSION_CONTEXT`. Para la inmutabilidad, un trigger que rechaza `UPDATE`/`DELETE` y `DENY` al login de la aplicación, que solo tiene `EXECUTE` sobre los SPs.
- **Autenticación:** access token JWT de 15 minutos y refresh token en una cookie httpOnly, con rotación y detección de reúso. Contraseñas con argon2.
- **Liberación de reservas:** el disponible ignora las reservas vencidas, y un job periódico (protegido con `sp_getapplock`) las marca como liberadas.
- **Infraestructura:** Docker Compose con SQL Server 2022, un migrador de un solo uso, Redis, 2 réplicas de la API detrás de nginx y el web servido con nginx, usando healthchecks. Perfil opcional `observability` con `grafana/otel-lgtm`.
- **Extras candidatos:** rate limiting en auth con Redis (Fase 1), exportación a Excel (Fase 2) y, si sobra tiempo, SSE y caché de reportes en Redis.

---

## 9. Próximos documentos

| Documento | Contenido | Etapa |
|---|---|---|
| `01-arquitectura.md` ✅ | Componentes, diagrama de despliegue, módulos y flujos críticos (checkout, reservas, idempotencia) | 2 |
| `02-modelo-datos.md` ✅ | Diagrama ER, tablas, constraints, índices y catálogo de SPs, vistas y funciones | 2 |
| `03-backlog.md` 🟡 | Épicas por módulo e historias con alcance y criterios de aceptación | 3 |
| `CLAUDE.md` 🟡 | Instrucciones breves para el desarrollador (Claude Code), apuntando a estos documentos | 3 |
