# Plan E7-H05 · Exportación asíncrona de reportes (Excel y PDF)

Historia grande (CLAUDE.md, flujo por historia). Alcance aprobado por el PO al cierre de E6 y E7. Decisiones: A-24 (nueva), A-16 (exceljs y pdfmake), A-04, RNF-2.

## 1. Modelo de datos (`V021__exportaciones.sql`)

- **`EstadoExportacion`** (catálogo, A-15): `IDEstadoExportacion TINYINT` con IDs fijos 1 `Pendiente`, 2 `Procesando`, 3 `Completada`, 4 `Fallida`, 5 `Expirada`; `UQ` por código.
- **`SolicitudExportacion`**:
  - `IDSolicitudExportacion BIGINT IDENTITY` y `IDUsuario` (FK).
  - `Reporte` (`CK` con los cinco reportes del dashboard) y `Formato` (`CK IN ('xlsx','pdf')`).
  - `Filtros NVARCHAR(1000)` (`CK ISJSON`) y `HashFiltros BINARY(32)`.
  - `IDEstadoExportacion` (FK) e `Intentos TINYINT` (`CK 0..10`).
  - `TokenArrendamiento` y `ArrendadoHasta`: fencing, como en `IntentoPago`.
  - `UltimoError NVARCHAR(500)`, `ReferenciaArchivo VARCHAR(100)` y `TamanoBytes BIGINT` (`CK ≥ 0`).
  - Fechas: `FechaCreacion`, `FechaFinalizacion`, `FechaExpiracion` y `FechaActualizacion`.
- **`CHECK` de coherencia por estado:**
  - `Procesando` ⇒ token y arrendamiento.
  - `Completada` ⇒ archivo, tamaño, finalización y expiración.
  - `Fallida` ⇒ error y finalización.
- **Índices:**
  - `IX_SolicitudExportacion_Cola (IDEstadoExportacion, ArrendadoHasta, IDSolicitudExportacion)`, para la toma.
  - `IX_SolicitudExportacion_Agrupacion (IDUsuario, Reporte, Formato, HashFiltros) INCLUDE (IDEstadoExportacion, FechaExpiracion)`, para la agrupación y el máximo de pendientes.
  - `IX_SolicitudExportacion_Usuario (IDUsuario, FechaCreacion DESC, IDSolicitudExportacion DESC)`, para el listado.
  - `IX_SolicitudExportacion_Vencimiento (FechaExpiracion) WHERE IDEstadoExportacion = 3`, para la purga.
- **Errores 50800–50899 (Exportaciones):**
  - `50801 EXPORTACIONES_PENDIENTES_MAXIMAS` (429);
  - `50802 EXPORTACION_NO_LISTA` (409);
  - `50803 EXPORTACION_EXPIRADA` (410).

## 2. Stored procedures

| SP | Rol | Qué hace |
|---|---|---|
| `SP_Exportaciones_Solicitar` | Administrador | Bloquea la fila del usuario (`UPDLOCK`) para serializar sus solicitudes. Si hay una igual (reporte, formato y hash) `Pendiente`, `Procesando` o `Completada` vigente, la devuelve (`Nueva = 0`). Si no, con `@MaxPendientes` alcanzado → 50801; si no, la crea |
| `SP_Exportaciones_Obtener`, `SP_Exportaciones_Listar` | Administrador | Solo las propias (`@IDUsuarioActor`); una ajena no existe (RF-01) |
| `SP_Exportaciones_Tomar` | Sistema | Pasa a `Fallida` las `Procesando` vencidas que agotaron los intentos. Toma **una** `Pendiente`, o una `Procesando` con el arrendamiento vencido, con `UPDLOCK, READPAST, ROWLOCK`: token nuevo, arrendamiento e `Intentos + 1`. Sin `sp_getapplock`: las dos réplicas consumen en competencia |
| `SP_Exportaciones_Completar` | Sistema | Compare-and-set del token: `Procesando` → `Completada`, con el archivo, el tamaño y la expiración a 24 h. Devuelve `Aplicado` |
| `SP_Exportaciones_RegistrarFallo` | Sistema | Compare-and-set del token. Un error definitivo, o un intento que llega al máximo, → `Fallida`; si no → `Pendiente`. Devuelve el estado y `Aplicado` |
| `SP_Exportaciones_Expirar` | Sistema, `sp_getapplock` (job A-04) | Pasa a `Expirada` las `Completada` vencidas y devuelve las `Expirada` que todavía tienen archivo |
| `SP_Exportaciones_QuitarArchivo` | Sistema | Deja `ReferenciaArchivo` en `NULL` cuando el archivo ya se borró |

## 3. Backend

- **Puerto `AlmacenArchivos`** (`shared/almacen`): `guardar(nombre, origen: Readable) → { tamanoBytes }`, `leer(nombre) → Readable` y `borrar(nombre)`, idempotente.
  - Adaptador `crearAlmacenEnDisco(directorio)`: escribe en `nombre.tmp` y renombra (atómico), y solo acepta nombres `^[\w-]+\.(xlsx|pdf)$`, generados por el servidor.
  - En Docker es un volumen con nombre, compartido por `api-1` y `api-2` (`ALMACEN_DIR`).
  - En producción se sustituye por S3 o Azure Blob sin tocar el servicio.
- **Módulo `exportaciones`:** `routes`, `controller`, `service`, `repository`, `schemas`, `types`, `procesador` (toma, genera, completa), `generadores` (mapa formato → generador), `tablas` (mapa reporte → tabla) y `tareas`.
- **Generación:** reutiliza el servicio de reportes (con su caché, A-11), en nombre del Administrador que pidió la exportación (`SP_Dashboard_*` es solo para el Admin).
  - Cada reporte se convierte en una tabla neutra (columnas tipadas texto / entero / monto / fecha, filas y totales).
  - Excel con `exceljs` en modo streaming (`WorkbookWriter`); PDF con `pdfmake` (Helvetica, sin archivos de fuente).
  - El formato se elige con el mapa `GENERADORES: Record<Formato, Generador>`.
  - Límite de filas por formato: `LIMITE_FILAS_EXCEL = 50_000` y `LIMITE_FILAS_PDF = 2_000`. Si se pasa, es un error definitivo con su causa, sin truncar en silencio.
  - Encabezado "Datos al dd/mm/aaaa hh:mm (hora de Guatemala)".
  - Montos como celdas numéricas con formato `#,##0.00`; fechas en hora de Guatemala.
- **Inyección de fórmulas:** un texto que empieza con `=`, `+`, `-`, `@`, tabulador o retorno de carro se escribe con un apóstrofo delante (OWASP).
- **Procesador:**
  - **Concurrencia:** `CONCURRENCIA_MAXIMA_POR_REPLICA = 2`, un contador local de la réplica que no es estado compartido.
  - **Tiempos e intentos:** `SEGUNDOS_ARRENDAMIENTO_EXPORTACION = 120` y `MAX_INTENTOS_EXPORTACION = 3`.
  - **Arranque:** después de un POST que crea una solicitud, la réplica intenta procesar de inmediato, sin esperar el ciclo. La tarea del planificador corre cada 10 s.
  - **Resultado de una réplica desplazada:** si `Completar` no aplica (token desplazado), borra su archivo, así queda uno solo.
  - **Rol:** las SPs de la cola corren como Sistema, fuera del contexto de la petición.
- **Purga:** tarea cada hora (`alIniciar`). Primero marca `Expirada`, después borra el archivo y quita la referencia; un borrado fallido se reintenta en la siguiente purga.

## 4. API (solo Admin)

- `POST /api/v1/admin/reportes/{reporte}/exportaciones` con `{ formato, filtros }`. Los filtros se validan con el mismo esquema Zod del reporte.
  - Responde `202` con la solicitud, `Location` y `Retry-After`.
  - Pasar el máximo de pendientes (`MAX_EXPORTACIONES_PENDIENTES = 3`) responde `429`. Además aplica el limitador de Redis por usuario (`LIMITE_EXPORTACIONES`, 10 por minuto).
- `GET /api/v1/admin/exportaciones` (propias, paginado) y `GET /api/v1/admin/exportaciones/{id}`, con `Retry-After` mientras está `Pendiente` o `Procesando`.
- `GET /api/v1/admin/exportaciones/{id}/archivo`:
  - descarga por streaming con `Content-Disposition: attachment; filename="<reporte>_<aaaa-mm-dd_hhmm local>.<ext>"`;
  - `409` si no está lista y `410` si expiró;
  - una ajena responde `404`.
- Ninguna respuesta incluye una ruta del sistema: solo el enlace del endpoint del archivo.

## 5. Pruebas (TDD)

- **Unitarias:**
  - el procesador: toma, completa, reintenta, falla definitivo, token desplazado (borra su archivo) y concurrencia máxima;
  - los generadores: tabla → Excel leído con exceljs (totales, montos numéricos, fórmula escapada) y tabla → definición del PDF (totales y "datos al");
  - las tablas por reporte;
  - el almacén en disco (nombres inválidos y escritura atómica).
- **Integración** (`test/integracion/secuencial/exportaciones.api.test.ts`, secuencial porque la cola es global):
  - el `202` inmediato y el estado que avanza hasta `Completada`;
  - la agrupación y el `429`;
  - el archivo generado en una réplica que se descarga desde la otra;
  - la réplica que muere a mitad: arrendamiento vencido, otra la retoma y queda un solo archivo, y la muerta no puede completar;
  - los totales de Excel y PDF contra el JSON;
  - `=HYPERLINK(...)` en el nombre de un producto;
  - `404` ajena, `403` para Operador y Cliente;
  - la purga.

## 6. Documentación

- **A-24** en `01-arquitectura.md`, con las alternativas descartadas:
  - generar en la petición, porque bloquea la réplica;
  - una cola en Redis, porque se puede perder (RNF-2);
  - el disco de una réplica, porque rompe la API stateless.
- **A-16:** exceljs y pdfmake, con su justificación.
- **01 §8:** las tareas nuevas.
- **02:** las tablas, los SPs y los códigos de error.
- **README:** endpoints y mejoras. El correo queda fuera, con el puerto `Notificador` y Mailpit en desarrollo, porque requiere SMTP igual que la recuperación de contraseña (N-15). SSE también queda fuera, porque con dos réplicas necesita un canal de avisos entre ellas.

## 7. Verificación contra el encargo

Cada punto del mensaje del PO tiene su lugar arriba:

- V### con catálogo de estados, fencing, constraints e índices (§1);
- endpoints, agrupación, 429 y rate limit (§4);
- consumidores en competencia sin applock, concurrencia por réplica, procesamiento inmediato tras el POST, reintentos y fencing (§2–3);
- streaming con límites, "datos al", montos numéricos, fechas locales y el mapa formato → generador (§3);
- puerto de almacenamiento con volumen compartido y purga (§3);
- seguridad: fórmulas, sin rutas y nombres generados por el servidor (§3–4);
- todas las pruebas pedidas (§5);
- A-24, A-16, correo y SSE (§6).

Sin ambigüedades que requieran detenerse.
