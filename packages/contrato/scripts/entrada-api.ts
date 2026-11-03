// Cada *.routes.ts registra sus endpoints en registroOpenApi al cargarse, así que importar app.ts basta para
// tener el documento completo: no se llama a crearApp, no se lee .env y no se conecta a la base ni a Redis.
// Las dos importaciones viven en este módulo para compartir la misma instancia del registro.
import '../../../apps/api/src/app.js';

export { generarDocumentoOpenApi } from '../../../apps/api/src/shared/openapi/index.js';
