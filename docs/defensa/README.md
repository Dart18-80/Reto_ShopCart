# Guía de defensa de ShopCart

Material para defender el proyecto en vivo: qué hace cada parte, dónde vive cada regla y qué abrir cuando el evaluador pregunta. Nada de lo que dice es aspiracional: cada afirmación cita la línea de código, el script SQL o la prueba que la respalda.

## Cómo usarla

1. **Antes de la defensa:** lee [las 30 preguntas más difíciles](preguntas-dificiles.md) y ensaya el [guion de demo de 10 minutos](guion-demo.md) con el entorno levantado.
2. **Durante la defensa:** busca el módulo o el tema de la pregunta en las tablas de abajo. Cada documento termina con sus preguntas probables y un «Muéstralo en» con el archivo y la línea exactos.
3. **Si el código cambia:** corre `pnpm test` (o solo `npx vitest run test/unit/defensa.test.ts` desde `apps/api`). La prueba falla si una cita ya no apunta a su línea.

## Formato de las citas

`[checkout.pago.ts:51](../../apps/api/src/modules/checkout/checkout.pago.ts#L51 "Ninguna llamada a")`: el texto es `archivo:línea`, el enlace lleva a esa línea y el título (visible al pasar el cursor) es un fragmento literal de ella. [defensa.test.ts](../../apps/api/test/unit/defensa.test.ts) comprueba que cada fragmento esté en su línea, que cada enlace exista, que cada módulo tenga sus secciones y de 10 a 15 preguntas, y que las preguntas difíciles sean 30.

## Módulos

Cada uno tiene: qué hace, su flujo crítico en un diagrama de secuencia, la tabla regla → dónde vive → archivo:línea → decisión, qué pasa con dos peticiones simultáneas y con una réplica que muere, los modos de falla, las alternativas descartadas y sus preguntas probables.

| Módulo | Lo central para la defensa |
|---|---|
| [checkout](modulos/checkout.md) | Sesión de pago con total congelado y reservas; pago idempotente con `Idempotency-Key`, arrendamiento y token de fencing; la pasarela fuera de las transacciones; conciliación |
| [pedidos](modulos/pedidos.md) | Máquina de estados, historial ledger, cancelación con reembolso, devoluciones parciales |
| [inventario](modulos/inventario.md) | Un solo SP toca la existencia y el kardex; reservas todo o nada en orden de `IDVariante`; conciliación |
| [carrito](modulos/carrito.md) | Invitado y cliente, garantía de precio, avisos, límite de líneas, orden de bloqueo |
| [cupones](modulos/cupones.md) | Límite total con contador y `CHECK`, límite por cliente, reservas del uso |
| [catalogo](modulos/catalogo.md) | Variantes, precios con historial, búsqueda con SQL dinámico seguro |
| [envios](modulos/envios.md) | Métodos, costo y envío gratis congelados en la sesión y el pedido |
| [reportes](modulos/reportes.md) | Dashboard sobre una sola definición de venta, caché por versión de dominio y tiempo real con SSE |
| [exportaciones](modulos/exportaciones.md) | Cola en SQL Server consumida por las dos réplicas, arrendamiento con fencing, Excel y PDF |
| [auth](modulos/auth.md) | JWT de 15 min, refresh rotado por familia con detección de reúso, versión de sesión, límite de intentos |
| [usuarios](modulos/usuarios.md) | Perfil, administración, último Admin, revocación al cambiar el rol |
| [direcciones](modulos/direcciones.md) | Aislamiento entre clientes (recurso ajeno = 404), límite de 10 |
| [bitacora](modulos/bitacora.md) | Triggers con `SESSION_CONTEXT` sobre una tabla ledger append-only |
| [configuracion](modulos/configuracion.md) | `ParametroSistema` de una sola fila, tipado |
| [sistema](modulos/sistema.md) | Health con base y Redis, `X-Instancia`, apagado ordenado |

## Temas transversales

| Tema | Lo central para la defensa |
|---|---|
| [arquitectura](transversal/arquitectura.md) | Monolito modular, capas, puertos y adaptadores, dónde vive cada regla (A-02), dinero, API stateless |
| [base de datos](transversal/base-de-datos.md) | Sin SQL en el backend, `ejecutarSP`, plantilla de SP, errores 5xxxx, ledger, migrador |
| [concurrencia](transversal/concurrencia.md) | Bloqueos, orden global, contadores con `CHECK`, `UNIQUE` como candado, `sp_getapplock`, arrendamientos |
| [seguridad](transversal/seguridad.md) | Tokens, aislamiento RF-01, datos de tarjeta, redacción de logs, secretos, contenedores sin root |
| [pruebas](transversal/pruebas.md) | Qué prueba cada suite y qué prueba demuestra cada requisito |
| [infraestructura](transversal/infraestructura.md) | Compose, subred con IPs fijas, nginx, arranque y apagado ordenados, qué pasa al detener cada pieza |
| [observabilidad](transversal/observabilidad.md) | OpenTelemetry, trazas sin datos sensibles, métricas, logs correlacionados en Grafana |

## Para cerrar la defensa

- [Las 30 preguntas más difíciles](preguntas-dificiles.md)
- [Guion de demo de 10 minutos](guion-demo.md)
- Estado del backend, riesgos abiertos y mejoras: [docs/revision/estado-backend.md](../revision/estado-backend.md) y [README §8](../../README.md)
