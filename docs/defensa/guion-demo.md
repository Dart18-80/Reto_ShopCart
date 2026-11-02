# Guion de demo (10 minutos)

Ocho pasos con los comandos exactos y lo que debe aparecer. Cada comando se ensayó contra el entorno de Docker. Los comandos son de **Git Bash** (en Windows) o de cualquier Bash, desde la raíz del repositorio. Usan `curl` y `node` (ya instalados para el proyecto), sin `jq`.

| Minuto | Paso | Qué demuestra |
|---|---|---|
| 0:00 | 1. Entorno y balanceo | Dos réplicas stateless detrás de nginx (A-03, RNF-2) |
| 1:00 | 2. Compra con la respuesta perdida | Pago idempotente: un solo cobro aunque el cliente reintente (N-03, A-05) |
| 3:30 | 3. Aislamiento entre clientes | Un pedido ajeno responde 404, igual que uno inexistente (RF-01) |
| 4:00 | 4. Compra simultánea | 20 clientes por la última unidad y por el último uso de un cupón (RNF-3) |
| 5:30 | 5. Una réplica se cae | La tienda sigue atendiendo desde la otra (RNF-2) |
| 6:30 | 6. Dashboard en tiempo real | Un cambio en una réplica llega al stream abierto en la otra (A-25) |
| 8:00 | 7. La compra en Grafana | La traza del pago: réplica, SPs y pasarela (RNF-4) |
| 9:30 | 8. Bitácora y ledger | Quién cambió qué y en qué petición (`requestId`, el mismo de su traza), y que nadie la alteró (RF-09, A-18, M-01) |

## Antes de empezar (no cuenta en los 10 minutos)

```bash
docker compose --profile observabilidad up -d
docker compose ps --format '{{.Service}} {{.State}} {{.Health}}'
```

Espera a que `api-1`, `api-2`, `redis`, `sqlserver` y `web` estén `running healthy` (desde cero tarda unos minutos: ver README §1). Abre dos pestañas del navegador: Swagger en <http://localhost:8080/api/docs> y Grafana en <http://localhost:3001>. Abre **dos terminales** de Git Bash en la raíz del repositorio y pega en **las dos**:

```bash
API=http://localhost:8080/api/v1
campo() { node -e "const d = JSON.parse(require('fs').readFileSync(0, 'utf8')); console.log($1)"; }
```

`campo` lee el JSON de la respuesta y muestra lo que se le pide (`d` es la respuesta completa).

## 1. Entorno y balanceo (0:00)

**Di:** dos réplicas idénticas de la API detrás de nginx en round-robin; ninguna guarda estado en memoria.

```bash
for i in 1 2 3 4; do curl -s -D - -o /dev/null $API/health | grep -i x-instancia; done
```

Salida esperada:

```text
X-Instancia: api-1
X-Instancia: api-2
X-Instancia: api-1
X-Instancia: api-2
```

**Si preguntan cómo se balancea:** [nginx.conf:29](../../infra/nginx/nginx.conf#L29 "server api-1:3000 max_fails=3 fail_timeout=10s") y la decisión en [infraestructura](transversal/infraestructura.md).

## 2. Compra con la respuesta perdida (1:00)

**Di:** la tarjeta `4000000000000119` hace que la pasarela autorice pero que la respuesta «se pierda». El cliente reintenta con la misma `Idempotency-Key` y se cobra una sola vez.

Terminal 1, la cuenta, el carrito, la dirección y la sesión de pago:

```bash
TOKEN=$(curl -s -X POST $API/auth/registro -H 'Content-Type: application/json' \
  -d "{\"correo\":\"ana-$(date +%s)@ejemplo.gt\",\"contrasena\":\"Ensayo2026!\",\"nombre\":\"Ana Pérez\"}" | campo d.datos.accessToken)
AUTH="Authorization: Bearer $TOKEN"
curl -s -X POST $API/carrito/lineas -H "$AUTH" -H 'Content-Type: application/json' \
  -d '{"idVariante":14,"cantidad":1}' | campo d.datos.lineas.length
ID_DIRECCION=$(curl -s -X POST $API/direcciones -H "$AUTH" -H 'Content-Type: application/json' \
  -d '{"nombreRecibe":"Ana Pérez","telefonoRecibe":"55551234","idMunicipio":1,"direccionLinea":"5a avenida 10-20, zona 1"}' | campo d.datos.idDireccion)
curl -s -X POST $API/checkout/sesion -H "$AUTH" -H 'Content-Type: application/json' \
  -d "{\"idDireccion\":$ID_DIRECCION,\"idMetodoEnvio\":1}" | campo '`total ${d.datos.total}, reservado hasta ${d.datos.expiraEn}`'
```

Salida esperada: `1` (una línea en el carrito) y `total 234.00, reservado hasta …` (el total queda congelado y la unidad reservada 15 minutos).

El pago, tres veces con la **misma** llave:

```bash
LLAVE=$(node -pe "crypto.randomUUID()")
TARJETA='{"numeroTarjeta":"4000000000000119","mesVencimiento":12,"anioVencimiento":2030,"cvv":"123"}'
pagar() {
  local r
  r=$(curl -s -w '\n%{http_code}' -X POST $API/checkout/sesion/pagos -H "$AUTH" \
    -H 'Content-Type: application/json' -H "Idempotency-Key: $LLAVE" -d "$TARJETA")
  echo "HTTP ${r##*$'\n'} $(echo "${r%$'\n'*}" |
    campo 'd.error ? `${d.error.codigo} requestId=${d.error.requestId}` : `${d.datos.numeroPedido} ${d.datos.estado}`')"
}
pagar
pagar
pagar
```

Salida esperada (el número de pedido y el `requestId` cambian en cada ensayo):

```text
HTTP 504 PAGO_SIN_CONFIRMAR requestId=60e783f2-8023-4ff7-b2ea-e3a9be7f3b20
HTTP 201 SC-003013 Pagado
HTTP 200 SC-003013 Pagado
```

**Anota el `requestId` del 504** para el paso 7. **Di:** el 504 llegó con el cobro ya autorizado; el reintento encontró el intento registrado con esa llave, la pasarela devolvió la misma autorización y se creó el pedido con un solo cobro; el tercero devuelve el mismo pedido sin tocar la pasarela. Los detalles (arrendamiento, token de fencing, la pasarela fuera de la transacción) están en [checkout](modulos/checkout.md).

## 3. Aislamiento entre clientes (3:30)

```bash
ID_PEDIDO=$(curl -s $API/pedidos -H "$AUTH" | campo d.datos[0].idPedido)
TOKEN2=$(curl -s -X POST $API/auth/login -H 'Content-Type: application/json' \
  -d '{"correo":"cliente2@shopcart.gt","contrasena":"Cliente2026!"}' | campo d.datos.accessToken)
curl -s -o /dev/null -w 'ajeno: %{http_code}\n' $API/pedidos/$ID_PEDIDO -H "Authorization: Bearer $TOKEN2"
curl -s -o /dev/null -w 'inexistente: %{http_code}\n' $API/pedidos/999999999 -H "Authorization: Bearer $TOKEN2"
```

Salida esperada: `ajeno: 404` e `inexistente: 404`. **Di:** el `IDUsuario` nunca llega en la petición: sale del token y el SP filtra con él; un recurso ajeno no se distingue de uno inexistente. Cada ruta de cliente con un ID tiene su caso en [aislamiento.api.test.ts:226](../../apps/api/test/integracion/seguridad/aislamiento.api.test.ts#L226 "cada ruta de cliente que recibe un ID tiene su caso de aislamiento").

## 4. Compra simultánea (4:00)

```bash
pnpm test:concurrencia --reporter=verbose
```

Salida esperada (unos 5 s):

```text
✓ … escenario 1: 20 clientes por la última unidad → 1 pedido y 19 × 409 STOCK_INSUFICIENTE
✓ … escenario 2: 20 clientes por el último uso de un cupón → 1 pedido con cupón y 19 × 422 CUPON_AGOTADO
```

**Di:** 20 clientes a la vez a través de nginx, contra las dos réplicas. La prueba verifica además la existencia final, la conciliación del inventario vacía y el contador del cupón ([checkout.concurrencia.test.ts:55](../../apps/api/test/concurrencia/checkout.concurrencia.test.ts#L55 "escenario 1: 20 clientes por la última unidad")). Por qué no hay sobreventa: [concurrencia](transversal/concurrencia.md).

## 5. Una réplica se cae (5:30)

```bash
docker compose stop api-1
for i in 1 2 3 4 5 6; do curl -s -D - -o /dev/null $API/health | grep -i x-instancia; done
docker compose start api-1
```

Salida esperada: `stop` termina en unos 5 s (apagado ordenado: cierra las conexiones y la telemetría, sin llegar a la espera máxima de 10 s), las seis respuestas dicen `X-Instancia: api-2` y el `start` vuelve a correr el migrador, que no aplica nada nuevo, antes de levantar `api-1`. Unos 15 s después, el ciclo del paso 1 vuelve a alternar. **Di:** nginx reintenta en la otra réplica solo ante un error de conexión, nunca un POST que ya llegó ([nginx.conf:71](../../infra/nginx/nginx.conf#L71 "proxy_next_upstream       error timeout;")). La prueba automática: [rnf2.test.ts:40](../../apps/api/test/entorno/rnf2.test.ts#L40 "peticiones seguidas a través de nginx responden 200 desde api-2").

## 6. Dashboard en tiempo real (6:30)

Terminal 2, el stream del Admin (déjalo abierto):

```bash
TA=$(curl -s -X POST $API/auth/login -H 'Content-Type: application/json' \
  -d '{"correo":"admin@shopcart.gt","contrasena":"Admin2026!"}' | campo d.datos.accessToken)
curl -N -i -H "Authorization: Bearer $TA" $API/admin/reportes/eventos
```

Salida esperada: `HTTP/1.1 200 OK`, `Content-Type: text/event-stream`, `X-Instancia: api-1` o `api-2`, y el evento inicial:

```text
id: ventas3.carritos152
event: versiones
data: {"versiones":{"ventas":3,"carritos":152},"recargar":false}
```

Terminal 1, un cambio en el carrito de Ana (lo atiende cualquiera de las dos réplicas):

```bash
curl -s -X POST $API/carrito/lineas -H "$AUTH" -H 'Content-Type: application/json' \
  -d '{"idVariante":15,"cantidad":1}' | campo d.datos.lineas.length
```

En la terminal 2 aparece enseguida un evento `cambio` del dominio `carritos` con la versión siguiente (`data: {"dominio":"carritos","version":153}`); cada 15 s llega un latido (`: latido`). **Di:** el token va en el encabezado, nunca en la URL; los eventos solo avisan y el dashboard vuelve a pedir el reporte, que sale de la caché ([reportes](modulos/reportes.md), A-25). Cierra el stream con `Ctrl+C`.

## 7. La compra en Grafana (8:00)

En Grafana: **Explore** → fuente **Tempo** → **TraceQL**:

```text
{ span.shopcart.request_id = "<el requestId del 504>" }
```

La traza muestra la petición `POST /api/v1/checkout/sesion/pagos` en su réplica (`service.instance.id`), los SPs en orden (`EXECUTE SP_…`, con el nombre del SP y sin los valores de sus parámetros) y el span `pasarela.autorizar`. En cualquier span, **Logs for this span** abre en Loki las líneas de esa petición con el mismo `trace_id`. **Dashboards → ShopCart** muestra latencia y errores por endpoint, peticiones por réplica y pagos por resultado (el `PAGO_SIN_CONFIRMAR` del paso 2 incluido). Detalles: [observabilidad](transversal/observabilidad.md).

## 8. Bitácora y ledger (9:30)

Terminal 2 (la que tiene el token del Admin en `TA`):

```bash
curl -s "$API/bitacora?modulo=Inventario&tamano=1" -H "Authorization: Bearer $TA" |
  campo '`${d.datos[0].accion} ${d.datos[0].entidad} por ${d.datos[0].usuario.nombre}: existencia ${d.datos[0].valorAnterior.ExistenciaFisica} → ${d.datos[0].valorNuevo.ExistenciaFisica}, requestId ${d.datos[0].requestId}`'
```

Salida esperada: el último movimiento de inventario, con quién lo hizo y el `requestId` de esa petición (en mayúsculas, como lo guarda SQL Server). **Di:** los triggers de bitácora escriben en una tabla ledger append-only, con el usuario y el `requestId` que cada SP fija en `SESSION_CONTEXT`; ni el propio sistema puede editarla ([base de datos](transversal/base-de-datos.md)).

Y la prueba criptográfica (M-01), en cualquiera de las dos terminales:

```bash
pnpm ledger:verificar
```

Salida esperada: una línea de log con `"msg":"Ledger verificado: ninguna tabla ledger cambió desde los digests guardados"` y cuántos digests hay en `.ledger/`. **Di:** el digest del ledger se guarda fuera de la base y SQL Server recalcula los hashes de la bitácora, el kardex y el historial contra todos los guardados; un cambio a cualquier bloque anterior haría fallar la verificación ([verificar-ledger.sql:4](../../database/migrator/sql/verificar-ledger.sql#L4 "EXEC sys.sp_verify_database_ledger @digests = @Digests;")).

## Si algo falla durante la demo

| Síntoma | Causa probable | Qué hacer |
|---|---|---|
| `campo` muestra `undefined` o un error de JSON | La petición devolvió un error (por ejemplo, el token venció: dura 15 min) | Repite el comando sin `| campo …` para ver el error; vuelve a iniciar sesión |
| El paso 2 responde `409 STOCK_INSUFICIENTE` | La variante 14 se agotó en ensayos anteriores | Usa otra variante: `GET /api/v1/productos/{id}` en Swagger, una con `estadoExistencia` distinto de `Agotado` |
| El paso 2 responde `409 SESION_VENCIDA` | Pasaron más de 15 minutos desde la sesión de pago | Repite el bloque de la sesión de pago |
| `pnpm test:concurrencia` responde `429` | El login admite 5 intentos por minuto por IP y correo | Espera un minuto |
| Grafana no abre | El perfil no está levantado | `docker compose --profile observabilidad up -d` |
